import { query, queryOne } from "./db";
import { encrypt, safeDecrypt } from "./encryption";
import OpenAI from "openai";

export interface MemoryItem {
  id: string;
  text: string;
  category: string;
  confidence: string;
  createdAt: string;
}

export async function getOrCreateUser(deviceId: string): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE device_id = $1",
    [deviceId]
  );
  if (existing) return existing.id;

  const created = await queryOne<{ id: string }>(
    "INSERT INTO users (device_id) VALUES ($1) RETURNING id",
    [deviceId]
  );
  return created!.id;
}

export async function getMemories(userId: string): Promise<MemoryItem[]> {
  const rows = await query<any>(
    `SELECT id, encrypted_text, is_encrypted, category, confidence, created_at 
     FROM memories WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    text: safeDecrypt(row.encrypted_text, row.is_encrypted),
    category: row.category,
    confidence: row.confidence,
    createdAt: row.created_at,
  }));
}

export async function addMemory(
  userId: string,
  text: string,
  category: string,
  confidence: string = "High"
): Promise<MemoryItem> {
  const ciphertext = encrypt(text);
  const row = await queryOne<any>(
    `INSERT INTO memories (user_id, encrypted_text, is_encrypted, category, confidence)
     VALUES ($1, $2, TRUE, $3, $4) RETURNING id, category, confidence, created_at`,
    [userId, ciphertext, category, confidence]
  );
  return {
    id: row.id,
    text, // Return the original plaintext to the caller
    category: row.category,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
  await query(
    "DELETE FROM memories WHERE id = $1 AND user_id = $2",
    [memoryId, userId]
  );
  return true;
}

export async function deleteAllMemories(userId: string): Promise<void> {
  await query("DELETE FROM memories WHERE user_id = $1", [userId]);
}

export async function extractAndSaveMemories(
  userId: string,
  message: string,
  openai: OpenAI
): Promise<MemoryItem[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `You are Aura's memory extraction system. Extract 0–3 stable, helpful memory candidates from this message.

Message: "${message}"

STORE ONLY:
- preferences (tone, brevity, explain style, communication style)
- goals (what the user wants to achieve)
- projects (ongoing work the user is doing)
- constraints (budget, schedule, location, device, team size)

DO NOT STORE:
- greetings, casual remarks, or small talk
- questions the user asks
- one-off casual comments with no long-term utility
- sensitive personal data (health details, financial account info, passwords, private legal matters)
- anything the user marked as private, secret, or "don't remember"
- vague or ambiguous statements

ACCURACY RULES:
- Memory text must accurately reflect what the user ACTUALLY said
- Do not overgeneralize from a single sentence
- Keep memory text concise but faithful
- When in doubt, do NOT store

Only extract if confidence >= 0.7.

Return ONLY valid JSON:
{"shouldRemember": boolean, "items": [{"text": "concise fact in ≤15 words", "category": "preference|goal|project|constraint", "confidence": "High|Medium|Low"}]}

If nothing worth remembering: {"shouldRemember": false, "items": []}`,
        },
      ],
      max_completion_tokens: 300,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const data = JSON.parse(cleaned);

    if (!data.shouldRemember || !data.items?.length) return [];

    const saved: MemoryItem[] = [];
    for (const item of data.items) {
      const memory = await addMemory(userId, item.text, item.category, item.confidence || "High");
      saved.push(memory);
    }
    return saved;
  } catch {
    return [];
  }
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  options: {
    type?: string;
    mode?: string;
    confidence?: string;
    explainLevel?: string;
    rememberFlag?: boolean;
    isPrivate?: boolean;
    metadata?: Record<string, any>;
  } = {}
): Promise<string> {
  const ciphertext = encrypt(content);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO messages (conversation_id, role, content_encrypted, is_encrypted, type, mode, confidence, explain_level, remember_flag, is_private, metadata)
     VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      conversationId,
      role,
      ciphertext,
      options.type || "text",
      options.mode || "chat",
      options.confidence || null,
      options.explainLevel || "normal",
      options.rememberFlag !== false,
      options.isPrivate || false,
      JSON.stringify(options.metadata || {}),
    ]
  );
  return row!.id;
}

export async function getOrCreateConversation(userId: string): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1",
    [userId]
  );
  if (existing) return existing.id;

  const created = await queryOne<{ id: string }>(
    "INSERT INTO conversations (user_id, title) VALUES ($1, 'Aura Chat') RETURNING id",
    [userId]
  );
  return created!.id;
}

export async function getConversationHistory(
  conversationId: string,
  limit: number = 20
): Promise<{ role: string; content: string }[]> {
  const rows = await query<any>(
    `SELECT role, content_encrypted, is_encrypted FROM messages 
     WHERE conversation_id = $1 AND is_private = FALSE AND type = 'text'
     ORDER BY created_at DESC LIMIT $2`,
    [conversationId, limit]
  );
  return rows
    .reverse()
    .map((row) => ({
      role: row.role,
      content: safeDecrypt(row.content_encrypted, row.is_encrypted),
    }));
}

export async function saveCitations(
  messageId: string,
  citations: { url: string; title: string; snippet: string }[]
): Promise<void> {
  for (const c of citations) {
    await query(
      "INSERT INTO citations (message_id, url, title, snippet) VALUES ($1, $2, $3, $4)",
      [messageId, c.url, c.title || "", c.snippet || ""]
    );
  }
}
