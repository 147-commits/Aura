import { Router } from "express";
import { requireAuth, budgetCheck } from "../middleware";
import { generatePDF, type DocumentRequest } from "../document-engine";
import {
  generateCraft,
  listCrafts,
  getCraft,
  getCraftFilePath,
  getMimeType,
  deleteCraft,
  generateCraftPreview,
} from "../craft-engine";
import { getTemplates } from "../craft-templates";
import type { CraftKind, CraftRequest } from "../../shared/schema";

export const craftsRouter = Router();

// ─── DOCUMENT EXPORT (legacy single-shot PDF) ─────────────────────────

craftsRouter.post("/export", async (req, res) => {
  try {
    const docRequest: DocumentRequest = req.body;
    if (!docRequest.title || !docRequest.sections?.length) {
      return res.status(400).json({ error: "title and sections are required" });
    }
    if (docRequest.sections.length > 20) {
      return res.status(400).json({ error: "Too many sections (max 20)" });
    }
    const totalLength = docRequest.sections.reduce((sum, s) => sum + (s.content_markdown?.length || 0), 0);
    if (totalLength > 50000) {
      return res.status(400).json({ error: "Content too large (max 50k chars)" });
    }

    const pdfBuffer = await generatePDF(docRequest);
    const filename = docRequest.filename || `${docRequest.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Failed to generate document" });
  }
});

// ─── CRAFTS (generate + CRUD) ─────────────────────────────────────────

craftsRouter.post("/crafts/generate", requireAuth, budgetCheck, async (req, res) => {
  try {
    const request: CraftRequest = req.body;

    if (!request.kind || !request.title) {
      return res.status(400).json({ error: "kind and title are required" });
    }

    const validKinds: CraftKind[] = ["pdf", "docx", "pptx", "xlsx", "html", "react", "svg", "markdown", "code"];
    if (!validKinds.includes(request.kind)) {
      return res.status(400).json({ error: `Invalid kind. Valid: ${validKinds.join(", ")}` });
    }

    if (["pdf", "docx"].includes(request.kind)) {
      if (!request.sections?.length) return res.status(400).json({ error: "sections required for document crafts" });
      if (request.sections.length > 20) return res.status(400).json({ error: "Too many sections (max 20)" });
      const totalLen = request.sections.reduce((s, sec) => s + (sec.content_markdown?.length || 0), 0);
      if (totalLen > 50000) return res.status(400).json({ error: "Content too large (max 50k chars)" });
    }
    if (request.kind === "pptx" && request.slides && request.slides.length > 30) {
      return res.status(400).json({ error: "Too many slides (max 30)" });
    }
    if (request.kind === "xlsx" && request.sheets && request.sheets.length > 10) {
      return res.status(400).json({ error: "Too many sheets (max 10)" });
    }
    if (["html", "react", "svg", "markdown", "code"].includes(request.kind)) {
      if (!request.content) return res.status(400).json({ error: "content required for inline crafts" });
      if (request.content.length > 100000) return res.status(400).json({ error: "Content too large (max 100k chars)" });
    }

    const result = await generateCraft(req.userId!, request);
    res.json(result);
  } catch (err) {
    console.error("Craft generation error:", err);
    res.status(500).json({ error: "Aura couldn't craft that right now. Please try again." });
  }
});

craftsRouter.get("/crafts", requireAuth, async (req, res) => {
  try {
    const crafts = await listCrafts(req.userId!);
    res.json(crafts);
  } catch (err) {
    console.error("List crafts error:", err);
    res.status(500).json({ error: "Failed to fetch crafts" });
  }
});

craftsRouter.get("/crafts/:id/download", requireAuth, async (req, res) => {
  try {
    const result = await getCraftFilePath(req.userId!, req.params.id as string);
    if (!result) return res.status(404).json({ error: "Craft not found" });

    const { filePath, filename, kind } = result;
    const fs = await import("fs");
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Craft file not found" });

    const buffer = fs.readFileSync(filePath);
    res.setHeader("Content-Type", getMimeType(kind));
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length.toString());
    res.send(buffer);
  } catch (err) {
    console.error("Craft download error:", err);
    res.status(500).json({ error: "Failed to download craft" });
  }
});

craftsRouter.get("/crafts/:id/preview", requireAuth, async (req, res) => {
  try {
    const preview = await generateCraftPreview(req.userId!, req.params.id as string);
    if (!preview) return res.status(404).json({ error: "Preview not available" });
    res.json(preview);
  } catch (err) {
    console.error("Craft preview error:", err);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

craftsRouter.get("/crafts/:id", requireAuth, async (req, res) => {
  try {
    const craft = await getCraft(req.userId!, req.params.id as string);
    if (!craft) return res.status(404).json({ error: "Craft not found" });
    res.json(craft);
  } catch (err) {
    console.error("Get craft error:", err);
    res.status(500).json({ error: "Failed to fetch craft" });
  }
});

craftsRouter.delete("/crafts/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await deleteCraft(req.userId!, req.params.id as string);
    if (!deleted) return res.status(404).json({ error: "Craft not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete craft error:", err);
    res.status(500).json({ error: "Failed to delete craft" });
  }
});

craftsRouter.get("/craft-templates", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json(getTemplates());
});

// ─── DATA EXPORT (GDPR Article 20) ────────────────────────────────────

craftsRouter.get("/export/all", requireAuth, async (req, res) => {
  try {
    const { exportUserData, tasksToCSV, projectsToCSV } = await import("../export-engine");
    const data = await exportUserData(req.userId!);

    const exportPackage = {
      metadata: data.metadata,
      conversations: data.conversations,
      memories: data.memories,
      tasks: data.tasks,
      projects: data.projects,
      crafts: data.crafts.map((c) => ({ ...c, filePath: undefined })),
      tasks_csv: tasksToCSV(data.tasks),
      projects_csv: projectsToCSV(data.projects),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="aura-export-${new Date().toISOString().split("T")[0]}.json"`);
    res.json(exportPackage);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Failed to export data" });
  }
});
