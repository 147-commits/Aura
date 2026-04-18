/**
 * Craft Engine — orchestrates generation of all craft types.
 *
 * Binary crafts (PDF, DOCX, PPTX, XLSX) → saved to /tmp/crafts/, referenced in DB
 * Inline crafts (HTML, React, SVG, Markdown, Code) → content stored directly in DB
 *
 * "Crafts" is Aura's brand language. Not "exports", not "documents".
 */

import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { generatePDF, generateDOCX, generatePPTX, generateXLSX, type DocumentRequest } from "./document-engine";
import { query, queryOne } from "./db";
import { encrypt, safeDecrypt } from "./encryption";
import type { CraftKind, CraftRequest, CraftResult, Craft } from "../shared/schema";

const CRAFTS_DIR = path.join(process.env.CRAFTS_STORAGE_DIR || "/tmp", "crafts");

const BINARY_KINDS = new Set<CraftKind>(["pdf", "docx", "pptx", "xlsx"]);

const MIME_TYPES: Record<CraftKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  html: "text/html",
  react: "text/plain",
  svg: "image/svg+xml",
  markdown: "text/markdown",
  code: "text/plain",
};

const FILE_EXTENSIONS: Record<CraftKind, string> = {
  pdf: ".pdf",
  docx: ".docx",
  pptx: ".pptx",
  xlsx: ".xlsx",
  html: ".html",
  react: ".tsx",
  svg: ".svg",
  markdown: ".md",
  code: ".txt",
};

function ensureCraftsDir(): void {
  if (!fs.existsSync(CRAFTS_DIR)) {
    fs.mkdirSync(CRAFTS_DIR, { recursive: true });
  }
}

function sanitizeFilename(title: string, kind: CraftKind): string {
  const clean = title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").slice(0, 60);
  return `${clean}${FILE_EXTENSIONS[kind]}`;
}

/** Convert CraftRequest → DocumentRequest for PDF/DOCX backward compatibility */
function adaptToDocRequest(req: CraftRequest): DocumentRequest {
  return {
    type: req.kind as "pdf" | "docx",
    title: req.title,
    filename: req.filename || sanitizeFilename(req.title, req.kind),
    sections: req.sections || [],
    tables: req.tables,
    sources: req.sources,
  };
}

/** Generate a craft and persist it to database */
export async function generateCraft(userId: string, request: CraftRequest): Promise<CraftResult> {
  ensureCraftsDir();
  const craftId = randomUUID();
  const filename = request.filename || sanitizeFilename(request.title, request.kind);

  if (BINARY_KINDS.has(request.kind)) {
    let buffer: Buffer;
    switch (request.kind) {
      case "pdf":
        buffer = await generatePDF(adaptToDocRequest(request));
        break;
      case "docx":
        buffer = await generateDOCX(adaptToDocRequest(request));
        break;
      case "pptx":
        buffer = await generatePPTX(request);
        break;
      case "xlsx":
        buffer = await generateXLSX(request);
        break;
      default:
        throw new Error(`Unsupported binary craft kind: ${request.kind}`);
    }

    const filePath = path.join(CRAFTS_DIR, `${craftId}${FILE_EXTENSIONS[request.kind]}`);
    fs.writeFileSync(filePath, buffer);

    await query(
      `INSERT INTO crafts (id, user_id, conversation_id, kind, title_encrypted, is_encrypted, file_path, filename, metadata)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8)`,
      [craftId, userId, request.conversationId || null, request.kind,
        encrypt(request.title), filePath, filename, JSON.stringify({})]
    );

    const craft: Craft = {
      id: craftId, userId, kind: request.kind, title: request.title,
      filePath, filename, createdAt: new Date().toISOString(),
    };
    return { craft, downloadUrl: `/api/crafts/${craftId}/download` };

  } else {
    const content = request.content || "";

    await query(
      `INSERT INTO crafts (id, user_id, conversation_id, kind, title_encrypted, is_encrypted, content, filename, metadata)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8)`,
      [craftId, userId, request.conversationId || null, request.kind,
        encrypt(request.title), content, filename, JSON.stringify({})]
    );

    const craft: Craft = {
      id: craftId, userId, kind: request.kind, title: request.title,
      content, filename, createdAt: new Date().toISOString(),
    };
    return { craft, content };
  }
}

/** List all crafts for a user, newest first */
export async function listCrafts(userId: string): Promise<Craft[]> {
  const rows = await query<any>(
    `SELECT id, kind, title_encrypted, is_encrypted, content, file_path, filename, created_at
     FROM crafts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    userId,
    kind: r.kind,
    title: safeDecrypt(r.title_encrypted, r.is_encrypted),
    content: r.content || undefined,
    filePath: r.file_path || undefined,
    filename: r.filename,
    createdAt: r.created_at,
  }));
}

/** Get a single craft by ID (verifies ownership) */
export async function getCraft(userId: string, craftId: string): Promise<Craft | null> {
  const r = await queryOne<any>(
    `SELECT id, kind, title_encrypted, is_encrypted, content, file_path, filename, created_at
     FROM crafts WHERE id = $1 AND user_id = $2`,
    [craftId, userId]
  );
  if (!r) return null;
  return {
    id: r.id, userId, kind: r.kind,
    title: safeDecrypt(r.title_encrypted, r.is_encrypted),
    content: r.content || undefined,
    filePath: r.file_path || undefined,
    filename: r.filename,
    createdAt: r.created_at,
  };
}

/** Get file path for binary craft download (verifies ownership) */
export async function getCraftFilePath(
  userId: string,
  craftId: string
): Promise<{ filePath: string; filename: string; kind: CraftKind } | null> {
  const r = await queryOne<any>(
    `SELECT file_path, filename, kind FROM crafts WHERE id = $1 AND user_id = $2 AND file_path IS NOT NULL`,
    [craftId, userId]
  );
  if (!r || !r.file_path) return null;
  return { filePath: r.file_path, filename: r.filename, kind: r.kind };
}

/** Delete a craft (verifies ownership, removes file if binary) */
export async function deleteCraft(userId: string, craftId: string): Promise<boolean> {
  const r = await queryOne<any>(
    `SELECT file_path FROM crafts WHERE id = $1 AND user_id = $2`,
    [craftId, userId]
  );
  if (!r) return false;

  if (r.file_path) {
    try { fs.unlinkSync(r.file_path); } catch {}
  }

  await query(`DELETE FROM crafts WHERE id = $1 AND user_id = $2`, [craftId, userId]);
  return true;
}

/** Get MIME type for a craft kind */
export function getMimeType(kind: CraftKind): string {
  return MIME_TYPES[kind] || "application/octet-stream";
}

/** Generate an HTML preview of a binary craft for in-app viewing */
export async function generateCraftPreview(
  userId: string,
  craftId: string
): Promise<{ previewType: "html" | "markdown" | "code"; content: string } | null> {
  const craft = await getCraft(userId, craftId);
  if (!craft) return null;

  // Inline crafts: return content directly
  if (craft.content) {
    if (craft.kind === "markdown") return { previewType: "markdown", content: craft.content };
    if (craft.kind === "code" || craft.kind === "react") return { previewType: "code", content: craft.content };
    if (craft.kind === "html" || craft.kind === "svg") return { previewType: "html", content: craft.content };
  }

  // Binary crafts: convert to HTML for WebView
  if (!craft.filePath || !fs.existsSync(craft.filePath)) return null;

  try {
    if (craft.kind === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ path: craft.filePath });
      const html = wrapPreviewHtml(craft.title, result.value);
      return { previewType: "html", content: html };
    }

    if (craft.kind === "xlsx") {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(craft.filePath);

      let html = "";
      workbook.eachSheet((sheet) => {
        html += `<h2 style="margin:16px 0 8px;font-family:sans-serif;color:#333">${sheet.name}</h2>`;
        html += '<table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">';
        sheet.eachRow((row, rowNum) => {
          const tag = rowNum === 1 ? "th" : "td";
          const bgStyle = rowNum === 1 ? "background:#6B8C54;color:#fff;font-weight:600;" : rowNum % 2 === 0 ? "background:#f5f5f0;" : "";
          html += "<tr>";
          row.eachCell((cell) => {
            html += `<${tag} style="padding:8px 12px;border:1px solid #ddd;${bgStyle}">${cell.text || ""}</${tag}>`;
          });
          html += "</tr>";
        });
        html += "</table>";
      });
      return { previewType: "html", content: wrapPreviewHtml(craft.title, html) };
    }

    if (craft.kind === "pptx") {
      // Simple text extraction for preview
      const html = `<div style="font-family:sans-serif;padding:20px;color:#333">
        <h1 style="color:#6B8C54">${craft.title}</h1>
        <p style="color:#666">Presentation preview — download for full slides</p>
        <p style="font-size:14px">File: ${craft.filename}</p>
      </div>`;
      return { previewType: "html", content: wrapPreviewHtml(craft.title, html) };
    }

    if (craft.kind === "pdf") {
      const html = `<div style="font-family:sans-serif;padding:20px;color:#333;text-align:center">
        <h2>${craft.title}</h2>
        <p style="color:#666">PDF preview — download to view full document</p>
      </div>`;
      return { previewType: "html", content: wrapPreviewHtml(craft.title, html) };
    }
  } catch (err) {
    console.error(`[craft-preview] Failed for ${craftId}:`, err);
  }

  return null;
}

function wrapPreviewHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { margin: 0; padding: 16px; font-family: -apple-system, sans-serif; background: #fafaf5; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
  img { max-width: 100%; }
</style>
</head><body>${body}</body></html>`;
}
