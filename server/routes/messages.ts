import { Router } from "express";
import { requireAuth } from "../middleware";
import {
  getOrCreateConversation,
  getConversationHistory,
} from "../memory-engine";

export const messagesRouter = Router();

messagesRouter.get("/messages", async (req, res) => {
  try {
    if (!req.userId) return res.json([]);
    const conversationId = await getOrCreateConversation(req.userId);
    const history = await getConversationHistory(conversationId, 50);
    res.json(history);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ─── CONVERSATION BRANCHING ────────────────────────────────────────────

messagesRouter.post("/conversations/branch", requireAuth, async (req, res) => {
  try {
    const { conversationId, messageId } = req.body;
    if (!conversationId || !messageId) {
      return res.status(400).json({ error: "conversationId and messageId required" });
    }

    const { query: dbQuery, queryOne: dbQueryOne } = await import("../db");

    // Verify ownership
    const conv = await dbQueryOne<any>(
      "SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2",
      [conversationId, req.userId]
    );
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    // Create branch conversation
    const branch = await dbQueryOne<any>(
      `INSERT INTO conversations (user_id, title, parent_conversation_id, branch_point_message_id)
       VALUES ($1, $2, $3, $4) RETURNING id, title, created_at`,
      [req.userId, `Branch of: ${conv.title}`, conversationId, messageId]
    );

    // Copy messages up to the branch point into the new conversation
    await dbQuery(
      `INSERT INTO messages (conversation_id, role, content_plaintext, content_encrypted, is_encrypted, type, mode, confidence, created_at)
       SELECT $1, role, content_plaintext, content_encrypted, is_encrypted, type, mode, confidence, created_at
       FROM messages WHERE conversation_id = $2 AND created_at <= (SELECT created_at FROM messages WHERE id = $3)
       ORDER BY created_at`,
      [branch.id, conversationId, messageId]
    );

    res.json({ branchId: branch.id, title: branch.title });
  } catch (err) {
    console.error("Branch error:", err);
    res.status(500).json({ error: "Failed to create branch" });
  }
});

// ─── FEEDBACK ──────────────────────────────────────────────────────────

messagesRouter.post("/feedback", requireAuth, async (req, res) => {
  try {
    const { messageId, conversationId, rating, comment } = req.body;
    if (!rating || !["up", "down"].includes(rating)) {
      return res.status(400).json({ error: "rating must be 'up' or 'down'" });
    }
    const { query: dbQuery } = await import("../db");
    await dbQuery(
      `INSERT INTO feedback (user_id, message_id, conversation_id, rating, comment) VALUES ($1, $2, $3, $4, $5)`,
      [req.userId, messageId || null, conversationId || null, rating, comment || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

messagesRouter.get("/feedback/summary", requireAuth, async (req, res) => {
  try {
    const { query: dbQuery } = await import("../db");
    const rows = await dbQuery<{ rating: string; count: string }>(
      `SELECT rating, COUNT(*)::text as count FROM feedback WHERE user_id = $1 GROUP BY rating`,
      [req.userId]
    );
    const summary: Record<string, number> = { up: 0, down: 0 };
    for (const r of rows) summary[r.rating] = parseInt(r.count);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch feedback summary" });
  }
});
