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
