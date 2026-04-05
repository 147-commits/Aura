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
          content: `You are Aura's memory extraction system. Be AGGRESSIVE about detecting useful context. Extract 0–5 memory candidates from this message. It's better to save too much than too little — the user wants Aura to remember things.

Message: "${message}"

EXTRACT THESE (be generous):
→ preferences: "I prefer...", "I like...", "I don't want...", "I always use...", "I'm a fan of...", coding preferences, tool preferences, communication style, even implicit ones like "I use TypeScript for everything" → preference
→ goals: "I want to...", "My goal is...", "I'm trying to...", "I plan to...", aspirations, targets
→ projects: "I'm building...", "I'm working on...", project names, tech stacks, product descriptions
→ constraints: "I can't...", "My budget is...", "I only have...", deadlines, team size, resources
→ context: job titles, company names, locations, industry, team composition, experience level, role

FORCE SAVE (always extract regardless of confidence):
→ If user says "remember this", "don't forget", "save this to memory", "keep in mind" — ALWAYS extract it

DO NOT STORE:
→ greetings, "hello", "thanks", small talk
→ questions without personal context (e.g., "what is Python?" has no personal info)
→ sensitive data: passwords, SSNs, credit card numbers, medical diagnoses, financial account numbers
→ anything marked as "private", "secret", or "don't remember"

RULES:
→ When in doubt, STORE with Medium confidence — users want to be remembered
→ Memory text should be concise but faithful (≤20 words)
→ Extract from implicit statements too: "We use Next.js" → project context
→ Multiple extractions from one message are encouraged

Return ONLY valid JSON:
{"shouldRemember": boolean, "items": [{"text": "concise memory", "category": "preference|goal|project|constraint|context", "confidence": "High|Medium|Low"}]}

If truly nothing worth remembering: {"shouldRemember": false, "items": []}`,
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

// ─── Conversation Management ────────────────────────────────────────────────

export async function createConversation(userId: string, title?: string): Promise<string> {
  const result = await queryOne<{ id: string }>(
    "INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id",
    [userId, title || "New chat"]
  );
  return result!.id;
}

export async function listConversations(userId: string, limit: number = 50): Promise<Array<{
  id: string;
  title: string;
  updatedAt: string;
  lastMessage?: string;
}>> {
  const rows = await query<any>(
    `SELECT c.id, c.title, c.updated_at,
     (SELECT content_encrypted FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg_enc,
     (SELECT is_encrypted FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg_encrypted
     FROM conversations c
     WHERE c.user_id = $1
     ORDER BY c.updated_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updated_at,
    lastMessage: r.last_msg_enc ? safeDecrypt(r.last_msg_enc, r.last_msg_encrypted)?.slice(0, 100) : undefined,
  }));
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  const result = await query(
    "DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id",
    [conversationId, userId]
  );
  return result.length > 0;
}

export async function updateConversationTitle(conversationId: string, title: string): Promise<void> {
  await query("UPDATE conversations SET title = $1 WHERE id = $2", [title, conversationId]);
}

export async function generateConversationTitle(firstMessage: string, openai: any): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `Generate a 3-6 word title for a conversation that starts with: "${firstMessage.slice(0, 200)}". Return ONLY the title, nothing else. No quotes.` }],
      max_completion_tokens: 20,
    });
    return response.choices[0]?.message?.content?.trim() || "New chat";
  } catch {
    return firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "..." : "");
  }
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
