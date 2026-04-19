import { Router } from "express";
import { chatRateLimit, researchRateLimit, memoryRateLimit, budgetCheck } from "../middleware";
import { runResearch } from "../research-engine";
import { getMemories, addMemory } from "../memory-engine";
import { extractActionItems } from "../productivity-engine";
import { getBackgroundModel, trackCompletion } from "../model-router";
import { upload } from "./uploads";
import { openai } from "./_shared";
import { handleChatStream } from "./_chat-stream";

export const chatRouter = Router();

// ─── CHAT (streaming, truth-first, with model routing) ────────────────

chatRouter.post(
  "/chat",
  chatRateLimit,
  budgetCheck,
  upload.array("attachments", 5),
  handleChatStream
);

// ─── RESEARCH (non-streaming) ─────────────────────────────────────────

chatRouter.post("/research", researchRateLimit, budgetCheck, async (req, res) => {
  try {
    const { query: searchQuery, memory: clientMemory = [] } = req.body;
    const userId = req.userId;

    let dbMemory = clientMemory;
    if (userId) {
      const memories = await getMemories(userId);
      dbMemory = memories.map((m) => ({ text: m.text, category: m.category }));
    }

    const result = await runResearch(searchQuery, openai, dbMemory);
    if (userId) trackCompletion(userId, searchQuery, result.content);
    res.json(result);
  } catch (err) {
    console.error("Research error:", err);
    res.status(500).json({ error: "Research failed" });
  }
});

// ─── EXTRACT MEMORY ───────────────────────────────────────────────────

chatRouter.post("/extract-memory", memoryRateLimit, async (req, res) => {
  try {
    const { message, save = false } = req.body;

    const response = await openai.chat.completions.create({
      model: getBackgroundModel(),
      messages: [
        {
          role: "user",
          content: `Extract memory-worthy facts from this message. Only extract stable, safe facts (goals, habits, preferences, projects).

Message: "${message}"

Return ONLY valid JSON: {"shouldRemember": boolean, "items": [{"text": "concise fact", "category": "goal|habit|preference|project|context", "confidence": "High|Medium|Low"}]}

If nothing worth remembering: {"shouldRemember": false, "items": []}`,
        },
      ],
      max_completion_tokens: 300,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const data = JSON.parse(cleaned);

    if (save && data.shouldRemember && data.items?.length && req.userId) {
      for (const item of data.items) {
        await addMemory(req.userId, item.text, item.category, item.confidence || "High");
      }
    }

    res.json(data);
  } catch {
    res.json({ shouldRemember: false, items: [] });
  }
});

// ─── EXTRACT ACTION ITEMS ─────────────────────────────────────────────

chatRouter.post("/extract-actions", async (req, res) => {
  try {
    const { message, assistantResponse } = req.body;
    if (!message || !assistantResponse) {
      return res.status(400).json({ error: "message and assistantResponse are required" });
    }
    const items = await extractActionItems(message, assistantResponse, openai);
    res.json(items);
  } catch (err) {
    console.error("Extract actions error:", err);
    res.status(500).json({ error: "Failed to extract action items" });
  }
});
