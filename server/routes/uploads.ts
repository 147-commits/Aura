/**
 * Upload-related routes + shared multer configuration.
 *
 * Exports:
 *   - uploadsRouter — /api/knowledge/ingest (text corpus ingestion)
 *   - upload — configured multer instance shared with chat.ts for
 *     attachment handling on POST /api/chat
 */

import { Router } from "express";
import multer from "multer";
import { requireAuth, budgetCheck } from "../middleware";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

export const uploadsRouter = Router();

uploadsRouter.post("/knowledge/ingest", requireAuth, budgetCheck, async (req, res) => {
  try {
    const { content, sourceUrl, sourceTitle, sourceType = "user_provided" } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }
    if (content.length > 200000) {
      return res.status(400).json({ error: "Content too large (max 200k chars)" });
    }
    const validTypes = ["academic", "government", "news", "documentation", "blog", "user_provided"];
    if (!validTypes.includes(sourceType)) {
      return res.status(400).json({ error: `Invalid sourceType. Valid: ${validTypes.join(", ")}` });
    }

    const { randomUUID } = await import("crypto");
    const { chunkAndEmbed } = await import("../embedding-engine");
    const { scoreSourceQuality } = await import("../retrieval-engine");

    const parentDocumentId = randomUUID();
    const qualityScore = scoreSourceQuality(sourceType, sourceUrl);
    const chunksCreated = await chunkAndEmbed(content, {
      sourceUrl, sourceTitle, sourceType, qualityScore, parentDocumentId,
    });

    res.json({ success: true, parentDocumentId, chunksCreated });
  } catch (err) {
    console.error("Knowledge ingestion error:", err);
    res.status(500).json({ error: "Failed to ingest knowledge" });
  }
});
