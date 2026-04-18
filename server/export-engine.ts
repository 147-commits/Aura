/**
 * Export Engine — "Export my Aura" data portability.
 *
 * Packages all user data into a zip file:
 * - conversations.json
 * - memories.json
 * - tasks.json
 * - projects.json
 * - crafts/ (original files)
 * - metadata.json (export info)
 *
 * Complies with GDPR Article 20 (data portability).
 */

import * as fs from "fs";
import * as path from "path";
import { query } from "./db";
import { safeDecrypt } from "./encryption";

export interface ExportResult {
  zipPath: string;
  fileCount: number;
  totalSize: number;
}

/**
 * Export all user data to a zip-compatible directory structure.
 * Returns path to the export directory (caller creates the zip).
 */
export async function exportUserData(userId: string): Promise<{
  conversations: any[];
  memories: any[];
  tasks: any[];
  projects: any[];
  crafts: any[];
  metadata: Record<string, unknown>;
}> {
  // Conversations + messages
  const conversations = await query<any>(
    `SELECT c.id, c.title, c.created_at, c.updated_at,
       (SELECT json_agg(json_build_object(
         'role', m.role,
         'content', COALESCE(m.content_plaintext, ''),
         'content_encrypted', m.content_encrypted,
         'is_encrypted', m.is_encrypted,
         'type', m.type,
         'mode', m.mode,
         'confidence', m.confidence,
         'created_at', m.created_at
       ) ORDER BY m.created_at)
       FROM messages m WHERE m.conversation_id = c.id
       ) as messages
     FROM conversations c WHERE c.user_id = $1 ORDER BY c.updated_at DESC`,
    [userId]
  );

  // Decrypt message content
  const decryptedConversations = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    messages: (c.messages || []).map((m: any) => ({
      role: m.role,
      content: m.is_encrypted ? safeDecrypt(m.content_encrypted, true) : (m.content || ""),
      type: m.type,
      mode: m.mode,
      confidence: m.confidence,
      createdAt: m.created_at,
    })),
  }));

  // Memories
  const memoryRows = await query<any>(
    `SELECT id, encrypted_text, is_encrypted, category, confidence, created_at
     FROM memories WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  const memories = memoryRows.map((m) => ({
    id: m.id,
    text: safeDecrypt(m.encrypted_text, m.is_encrypted),
    category: m.category,
    confidence: m.confidence,
    createdAt: m.created_at,
  }));

  // Tasks
  const taskRows = await query<any>(
    `SELECT id, title_encrypted, description_encrypted, is_encrypted, status, priority, due_date, project_id, created_at
     FROM tasks WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  const tasks = taskRows.map((t) => ({
    id: t.id,
    title: safeDecrypt(t.title_encrypted, t.is_encrypted),
    description: safeDecrypt(t.description_encrypted, t.is_encrypted),
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date,
    projectId: t.project_id,
    createdAt: t.created_at,
  }));

  // Projects
  const projectRows = await query<any>(
    `SELECT id, name_encrypted, description_encrypted, is_encrypted, status, color, created_at
     FROM projects WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  const projects = projectRows.map((p) => ({
    id: p.id,
    name: safeDecrypt(p.name_encrypted, p.is_encrypted),
    description: safeDecrypt(p.description_encrypted, p.is_encrypted),
    status: p.status,
    color: p.color,
    createdAt: p.created_at,
  }));

  // Crafts
  const craftRows = await query<any>(
    `SELECT id, kind, title_encrypted, is_encrypted, content, file_path, filename, created_at
     FROM crafts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  const crafts = craftRows.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: safeDecrypt(c.title_encrypted, c.is_encrypted),
    content: c.content || undefined,
    filePath: c.file_path || undefined,
    filename: c.filename,
    createdAt: c.created_at,
  }));

  const metadata = {
    exportedAt: new Date().toISOString(),
    userId,
    counts: {
      conversations: decryptedConversations.length,
      messages: decryptedConversations.reduce((s, c) => s + (c.messages?.length || 0), 0),
      memories: memories.length,
      tasks: tasks.length,
      projects: projects.length,
      crafts: crafts.length,
    },
    version: "1.0",
    format: "aura-export-v1",
  };

  return {
    conversations: decryptedConversations,
    memories,
    tasks,
    projects,
    crafts,
    metadata,
  };
}

/**
 * Convert tasks to CSV format.
 */
export function tasksToCSV(tasks: any[]): string {
  const headers = ["ID", "Title", "Description", "Status", "Priority", "Due Date", "Created At"];
  const rows = tasks.map((t) => [
    t.id,
    `"${(t.title || "").replace(/"/g, '""')}"`,
    `"${(t.description || "").replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    t.dueDate || "",
    t.createdAt,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Convert projects to CSV format.
 */
export function projectsToCSV(projects: any[]): string {
  const headers = ["ID", "Name", "Description", "Status", "Color", "Created At"];
  const rows = projects.map((p) => [
    p.id,
    `"${(p.name || "").replace(/"/g, '""')}"`,
    `"${(p.description || "").replace(/"/g, '""')}"`,
    p.status,
    p.color,
    p.createdAt,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
