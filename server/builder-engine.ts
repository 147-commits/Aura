/**
 * Builder Engine — project CRUD for website and mobile app generation.
 */

import { query, queryOne } from "./db";
import type { BuilderProject, BuilderProjectType } from "../shared/schema";

/** Create a new builder project */
export async function createBuilderProject(
  userId: string,
  type: BuilderProjectType,
  name: string,
  conversationId?: string
): Promise<BuilderProject> {
  const row = await queryOne<any>(
    `INSERT INTO builder_projects (user_id, type, name, files, conversation_id)
     VALUES ($1, $2, $3, '{}', $4)
     RETURNING id, type, name, files, current_html, deploy_url, conversation_id, created_at, updated_at`,
    [userId, type, name, conversationId || null]
  );
  return mapRow(userId, row);
}

/** Update project files and optionally the current HTML preview */
export async function updateProjectFiles(
  projectId: string,
  files: Record<string, string>,
  currentHtml?: string
): Promise<void> {
  if (currentHtml !== undefined) {
    await query(
      `UPDATE builder_projects SET files = $1, current_html = $2, updated_at = NOW() WHERE id = $3`,
      [JSON.stringify(files), currentHtml, projectId]
    );
  } else {
    await query(
      `UPDATE builder_projects SET files = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(files), projectId]
    );
  }
}

/** Get a project by ID (verifies ownership) */
export async function getBuilderProject(
  projectId: string,
  userId: string
): Promise<BuilderProject | null> {
  const row = await queryOne<any>(
    `SELECT id, type, name, files, current_html, deploy_url, conversation_id, created_at, updated_at
     FROM builder_projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  if (!row) return null;
  return mapRow(userId, row);
}

/** List all projects for a user */
export async function getUserBuilderProjects(
  userId: string
): Promise<BuilderProject[]> {
  const rows = await query<any>(
    `SELECT id, type, name, files, current_html, deploy_url, conversation_id, created_at, updated_at
     FROM builder_projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`,
    [userId]
  );
  return rows.map((r) => mapRow(userId, r));
}

/** Delete a project (verifies ownership) */
export async function deleteBuilderProject(
  projectId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM builder_projects WHERE id = $1 AND user_id = $2 RETURNING id`,
    [projectId, userId]
  );
  return result.length > 0;
}

/** Map a DB row to BuilderProject */
function mapRow(userId: string, row: any): BuilderProject {
  return {
    id: row.id,
    userId,
    type: row.type,
    name: row.name,
    files: typeof row.files === "string" ? JSON.parse(row.files) : (row.files || {}),
    currentHtml: row.current_html || undefined,
    deployUrl: row.deploy_url || undefined,
    conversationId: row.conversation_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
