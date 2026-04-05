import { query, queryOne } from "./db";
import { encrypt, safeDecrypt } from "./encryption";
import OpenAI from "openai";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "high" | "medium" | "low";
  dueDate: string | null;
  projectId: string | null;
  projectName?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed";
  color: string;
  taskCount?: number;
  createdAt: string;
}

export interface DailyPlan {
  id: string;
  date: string;
  summary: string;
  taskIds: string[];
  createdAt: string;
}

export interface ActionItem {
  type: "task" | "project" | "memory" | "decision";
  title: string;
  description: string;
  priority?: "high" | "medium" | "low";
}

const PROJECT_COLORS = [
  "#3B82F6", "#8B5CF6", "#06B6D4", "#10B981",
  "#F59E0B", "#EF4444", "#EC4899", "#6366F1",
];

// ─── Tasks ───────────────────────────────────────────────────────────────

export async function createTask(
  userId: string,
  title: string,
  description: string = "",
  priority: "high" | "medium" | "low" = "medium",
  dueDate?: string,
  projectId?: string
): Promise<Task> {
  const encTitle = encrypt(title);
  const encDesc = description ? encrypt(description) : "";
  const row = await queryOne<any>(
    `INSERT INTO tasks (user_id, title_encrypted, description_encrypted, is_encrypted, priority, due_date, project_id)
     VALUES ($1, $2, $3, TRUE, $4, $5, $6)
     RETURNING id, status, priority, due_date, project_id, created_at`,
    [userId, encTitle, encDesc, priority, dueDate || null, projectId || null]
  );
  return {
    id: row.id,
    title,
    description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    projectId: row.project_id,
    createdAt: row.created_at,
  };
}

export async function getTasks(
  userId: string,
  filters?: { status?: string; projectId?: string }
): Promise<Task[]> {
  let sql = `SELECT t.id, t.title_encrypted, t.description_encrypted, t.is_encrypted,
             t.status, t.priority, t.due_date, t.project_id, t.created_at,
             p.name_encrypted as project_name_enc, p.is_encrypted as project_is_enc
             FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.user_id = $1`;
  const params: any[] = [userId];

  if (filters?.status) {
    params.push(filters.status);
    sql += ` AND t.status = $${params.length}`;
  }
  if (filters?.projectId) {
    params.push(filters.projectId);
    sql += ` AND t.project_id = $${params.length}`;
  }

  sql += ` ORDER BY
    CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
    t.created_at DESC`;

  const rows = await query<any>(sql, params);
  return rows.map((r) => ({
    id: r.id,
    title: safeDecrypt(r.title_encrypted, r.is_encrypted),
    description: safeDecrypt(r.description_encrypted, r.is_encrypted),
    status: r.status,
    priority: r.priority,
    dueDate: r.due_date,
    projectId: r.project_id,
    projectName: r.project_name_enc ? safeDecrypt(r.project_name_enc, r.project_is_enc ?? true) : undefined,
    createdAt: r.created_at,
  }));
}

export async function updateTask(
  userId: string,
  taskId: string,
  updates: Partial<{ title: string; description: string; status: string; priority: string; dueDate: string | null; projectId: string | null }>
): Promise<Task | null> {
  const sets: string[] = [];
  const params: any[] = [taskId, userId];

  if (updates.title !== undefined) {
    params.push(encrypt(updates.title));
    sets.push(`title_encrypted = $${params.length}, is_encrypted = TRUE`);
  }
  if (updates.description !== undefined) {
    params.push(encrypt(updates.description));
    sets.push(`description_encrypted = $${params.length}`);
  }
  if (updates.status !== undefined) {
    params.push(updates.status);
    sets.push(`status = $${params.length}`);
  }
  if (updates.priority !== undefined) {
    params.push(updates.priority);
    sets.push(`priority = $${params.length}`);
  }
  if (updates.dueDate !== undefined) {
    params.push(updates.dueDate);
    sets.push(`due_date = $${params.length}`);
  }
  if (updates.projectId !== undefined) {
    params.push(updates.projectId);
    sets.push(`project_id = $${params.length}`);
  }

  if (sets.length === 0) return null;
  sets.push("updated_at = NOW()");

  const row = await queryOne<any>(
    `UPDATE tasks SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2
     RETURNING id, title_encrypted, description_encrypted, is_encrypted, status, priority, due_date, project_id, created_at`,
    params
  );
  if (!row) return null;
  return {
    id: row.id,
    title: safeDecrypt(row.title_encrypted, row.is_encrypted),
    description: safeDecrypt(row.description_encrypted, row.is_encrypted),
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    projectId: row.project_id,
    createdAt: row.created_at,
  };
}

export async function deleteTask(userId: string, taskId: string): Promise<boolean> {
  await query("DELETE FROM tasks WHERE id = $1 AND user_id = $2", [taskId, userId]);
  return true;
}

// ─── Projects ────────────────────────────────────────────────────────────

export async function createProject(
  userId: string,
  name: string,
  description: string = ""
): Promise<Project> {
  const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
  const encName = encrypt(name);
  const encDesc = description ? encrypt(description) : "";
  const row = await queryOne<any>(
    `INSERT INTO projects (user_id, name_encrypted, description_encrypted, is_encrypted, color)
     VALUES ($1, $2, $3, TRUE, $4)
     RETURNING id, status, color, created_at`,
    [userId, encName, encDesc, color]
  );
  return {
    id: row.id,
    name,
    description,
    status: row.status,
    color: row.color,
    taskCount: 0,
    createdAt: row.created_at,
  };
}

export async function getProjects(userId: string): Promise<Project[]> {
  const rows = await query<any>(
    `SELECT p.id, p.name_encrypted, p.description_encrypted, p.is_encrypted, p.status, p.color, p.created_at,
     (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done')::int as task_count
     FROM projects p WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: safeDecrypt(r.name_encrypted, r.is_encrypted),
    description: safeDecrypt(r.description_encrypted, r.is_encrypted),
    status: r.status,
    color: r.color,
    taskCount: r.task_count,
    createdAt: r.created_at,
  }));
}

export async function updateProject(
  userId: string,
  projectId: string,
  updates: Partial<{ name: string; description: string; status: string }>
): Promise<Project | null> {
  const sets: string[] = [];
  const params: any[] = [projectId, userId];

  if (updates.name !== undefined) {
    params.push(encrypt(updates.name));
    sets.push(`name_encrypted = $${params.length}`);
  }
  if (updates.description !== undefined) {
    params.push(encrypt(updates.description));
    sets.push(`description_encrypted = $${params.length}`);
  }
  if (updates.status !== undefined) {
    params.push(updates.status);
    sets.push(`status = $${params.length}`);
  }

  if (sets.length === 0) return null;
  sets.push("updated_at = NOW()");

  const row = await queryOne<any>(
    `UPDATE projects SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2
     RETURNING id, name_encrypted, description_encrypted, is_encrypted, status, color, created_at`,
    params
  );
  if (!row) return null;
  return {
    id: row.id,
    name: safeDecrypt(row.name_encrypted, row.is_encrypted),
    description: safeDecrypt(row.description_encrypted, row.is_encrypted),
    status: row.status,
    color: row.color,
    createdAt: row.created_at,
  };
}

export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  await query("DELETE FROM projects WHERE id = $1 AND user_id = $2", [projectId, userId]);
  return true;
}

// ─── Daily Plans ─────────────────────────────────────────────────────────

export async function getDailyPlan(userId: string, date?: string): Promise<DailyPlan | null> {
  const d = date || new Date().toISOString().split("T")[0];
  const row = await queryOne<any>(
    "SELECT id, plan_date, summary_encrypted, is_encrypted, task_ids, created_at FROM daily_plans WHERE user_id = $1 AND plan_date = $2",
    [userId, d]
  );
  if (!row) return null;
  return {
    id: row.id,
    date: row.plan_date,
    summary: safeDecrypt(row.summary_encrypted, row.is_encrypted),
    taskIds: row.task_ids || [],
    createdAt: row.created_at,
  };
}

export async function generateDailyPlan(
  userId: string,
  openai: OpenAI
): Promise<DailyPlan> {
  const tasks = await getTasks(userId, { status: "todo" });
  const inProgress = await getTasks(userId, { status: "in_progress" });
  const allPending = [...inProgress, ...tasks];
  const today = new Date().toISOString().split("T")[0];

  if (allPending.length === 0) {
    const existing = await getDailyPlan(userId, today);
    if (existing) return existing;

    const summaryText = "No pending tasks. A good day to plan ahead or reflect.";
    const row = await queryOne<any>(
      `INSERT INTO daily_plans (user_id, plan_date, summary_encrypted, is_encrypted, task_ids)
       VALUES ($1, $2, $3, TRUE, $4)
       ON CONFLICT (user_id, plan_date) DO UPDATE SET summary_encrypted = $3, is_encrypted = TRUE, task_ids = $4
       RETURNING id, plan_date, task_ids, created_at`,
      [userId, today, encrypt(summaryText), JSON.stringify([])]
    );
    return { id: row.id, date: today, summary: summaryText, taskIds: [], createdAt: row.created_at };
  }

  const taskList = allPending.map((t) =>
    `- [${t.priority.toUpperCase()}] ${t.title}${t.projectName ? ` (${t.projectName})` : ""}${t.status === "in_progress" ? " [IN PROGRESS]" : ""}`
  ).join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a concise productivity assistant. Given a list of tasks, create a brief daily plan. Be direct, no fluff. Format: 2-3 sentence summary of priorities, then suggest an order. Max 100 words.`,
      },
      {
        role: "user",
        content: `Here are my pending tasks for today:\n${taskList}\n\nCreate a brief daily plan.`,
      },
    ],
    max_completion_tokens: 300,
  });

  const summary = completion.choices[0]?.message?.content || "Focus on your highest priority tasks first.";
  const prioritizedIds = allPending.map((t) => t.id);

  const encSummary = encrypt(summary);
  const row = await queryOne<any>(
    `INSERT INTO daily_plans (user_id, plan_date, summary_encrypted, is_encrypted, task_ids)
     VALUES ($1, $2, $3, TRUE, $4)
     ON CONFLICT (user_id, plan_date) DO UPDATE SET summary_encrypted = $3, is_encrypted = TRUE, task_ids = $4
     RETURNING id, plan_date, task_ids, created_at`,
    [userId, today, encSummary, JSON.stringify(prioritizedIds)]
  );

  return { id: row.id, date: today, summary, taskIds: prioritizedIds, createdAt: row.created_at };
}

export async function extractActionItems(
  message: string,
  assistantResponse: string,
  openai: OpenAI
): Promise<ActionItem[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You detect actionable items from conversations. Return a JSON array of items, or an empty array if nothing actionable.

Each item: {"type": "task"|"project"|"memory", "title": "short title", "description": "brief description", "priority": "high"|"medium"|"low"}

Rules:
- Only extract CLEAR, SPECIFIC action items. Do not invent tasks.
- "task": something to do
- "project": a multi-step initiative
- "memory": a useful fact to remember
- Max 3 items per message. Often 0.
- Simple Q&A, greetings, factual lookups = return []
- Return ONLY the JSON array, nothing else.`,
        },
        {
          role: "user",
          content: `User said: "${message}"\n\nAssistant replied: "${assistantResponse.slice(0, 500)}"`,
        },
      ],
      max_completion_tokens: 300,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "[]";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const items = JSON.parse(cleaned);
    if (!Array.isArray(items)) return [];
    return items.filter((i: any) => i.type && i.title).slice(0, 3);
  } catch {
    return [];
  }
}

// ─── Project Connections ────────────────────────────────────────────────────

export async function linkConversationToProject(conversationId: string, projectId: string): Promise<void> {
  await query("UPDATE conversations SET project_id = $1 WHERE id = $2", [projectId, conversationId]);
}

export async function getProjectConversations(projectId: string, userId: string): Promise<any[]> {
  return query(
    `SELECT c.id, c.title, c.created_at, c.updated_at,
       (SELECT content_plaintext FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
     FROM conversations c WHERE c.project_id = $1 AND c.user_id = $2 ORDER BY c.updated_at DESC`,
    [projectId, userId]
  );
}

export async function getProjectCrafts(projectId: string, userId: string): Promise<any[]> {
  return query(
    `SELECT id, kind, title_encrypted, is_encrypted, filename, created_at
     FROM crafts WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
    [projectId, userId]
  );
}

export async function getProjectOverview(projectId: string, userId: string): Promise<{
  conversations: number;
  crafts: number;
  tasks: number;
}> {
  const [convs, crafts, tasks] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*)::text as count FROM conversations WHERE project_id = $1 AND user_id = $2", [projectId, userId]),
    queryOne<{ count: string }>("SELECT COUNT(*)::text as count FROM crafts WHERE project_id = $1 AND user_id = $2", [projectId, userId]),
    queryOne<{ count: string }>("SELECT COUNT(*)::text as count FROM tasks WHERE project_id = $1 AND user_id = $2", [projectId, userId]),
  ]);
  return {
    conversations: parseInt(convs?.count || "0"),
    crafts: parseInt(crafts?.count || "0"),
    tasks: parseInt(tasks?.count || "0"),
  };
}

export async function updateProjectNotes(projectId: string, userId: string, notes: string): Promise<void> {
  await query("UPDATE projects SET notes = $1 WHERE id = $2 AND user_id = $3", [notes, projectId, userId]);
}
