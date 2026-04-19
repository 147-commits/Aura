import { Router } from "express";
import { requireAuth, memoryRateLimit } from "../middleware";
import {
  getMemories,
  addMemory,
  deleteMemory,
  deleteAllMemories,
} from "../memory-engine";
import { getConsolidationStatus } from "../memory-consolidator";

export const memoryRouter = Router();

memoryRouter.get("/memories", async (req, res) => {
  try {
    if (!req.userId) return res.json([]);
    const memories = await getMemories(req.userId);
    res.json(memories);
  } catch (err) {
    console.error("Get memories error:", err);
    res.status(500).json({ error: "Failed to fetch memories" });
  }
});

memoryRouter.post("/memories", requireAuth, memoryRateLimit, async (req, res) => {
  try {
    const { text, category = "context", confidence = "High" } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const memory = await addMemory(req.userId!, text, category, confidence);
    res.json(memory);
  } catch (err) {
    console.error("Add memory error:", err);
    res.status(500).json({ error: "Failed to add memory" });
  }
});

memoryRouter.delete("/memories/:id", requireAuth, async (req, res) => {
  try {
    await deleteMemory(req.userId!, req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete memory error:", err);
    res.status(500).json({ error: "Failed to delete memory" });
  }
});

memoryRouter.delete("/memories", requireAuth, async (req, res) => {
  try {
    await deleteAllMemories(req.userId!);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete all memories error:", err);
    res.status(500).json({ error: "Failed to clear memories" });
  }
});

memoryRouter.get("/memory/consolidation-status", requireAuth, async (req, res) => {
  try {
    const status = await getConsolidationStatus(req.userId!);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: "Failed to get consolidation status" });
  }
});
