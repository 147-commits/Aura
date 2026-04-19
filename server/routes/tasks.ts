import { Router } from "express";
import { requireAuth } from "../middleware";
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  createProject,
  getProjects,
  updateProject,
  deleteProject,
  getDailyPlan,
  generateDailyPlan,
} from "../productivity-engine";
import { getMemories } from "../memory-engine";
import { getBackgroundModel } from "../model-router";
import { openai } from "./_shared";

export const tasksRouter = Router();

// ─── TASKS ────────────────────────────────────────────────────────────

tasksRouter.get("/tasks", async (req, res) => {
  try {
    if (!req.userId) return res.json([]);
    const status = req.query.status as string | undefined;
    const projectId = req.query.project_id as string | undefined;
    const tasks = await getTasks(req.userId, { status, projectId });
    res.json(tasks);
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

tasksRouter.post("/tasks", requireAuth, async (req, res) => {
  try {
    const { title, description, priority, dueDate, projectId } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    const task = await createTask(req.userId!, title, description, priority, dueDate, projectId);
    res.json(task);
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

tasksRouter.patch("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const task = await updateTask(req.userId!, req.params.id as string, req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

tasksRouter.delete("/tasks/:id", requireAuth, async (req, res) => {
  try {
    await deleteTask(req.userId!, req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// ─── PROJECTS ─────────────────────────────────────────────────────────

tasksRouter.get("/projects", async (req, res) => {
  try {
    if (!req.userId) return res.json([]);
    const projects = await getProjects(req.userId);
    res.json(projects);
  } catch (err) {
    console.error("Get projects error:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

tasksRouter.post("/projects", requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const project = await createProject(req.userId!, name, description);
    res.json(project);
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

tasksRouter.patch("/projects/:id", requireAuth, async (req, res) => {
  try {
    const project = await updateProject(req.userId!, req.params.id as string, req.body);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

tasksRouter.delete("/projects/:id", requireAuth, async (req, res) => {
  try {
    await deleteProject(req.userId!, req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ─── PROJECT CONNECTIONS ──────────────────────────────────────────────

tasksRouter.get("/projects/:id/overview", requireAuth, async (req, res) => {
  try {
    const { getProjectOverview } = await import("../productivity-engine");
    const overview = await getProjectOverview(req.params.id as string, req.userId!);
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch project overview" });
  }
});

tasksRouter.post("/projects/:id/conversations", requireAuth, async (req, res) => {
  try {
    const { linkConversationToProject } = await import("../productivity-engine");
    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ error: "conversationId required" });
    await linkConversationToProject(conversationId, req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to link conversation" });
  }
});

tasksRouter.get("/projects/:id/conversations", requireAuth, async (req, res) => {
  try {
    const { getProjectConversations } = await import("../productivity-engine");
    const conversations = await getProjectConversations(req.params.id as string, req.userId!);
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

tasksRouter.get("/projects/:id/crafts", requireAuth, async (req, res) => {
  try {
    const { getProjectCrafts } = await import("../productivity-engine");
    const crafts = await getProjectCrafts(req.params.id as string, req.userId!);
    res.json(crafts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch crafts" });
  }
});

tasksRouter.patch("/projects/:id/notes", requireAuth, async (req, res) => {
  try {
    const { updateProjectNotes } = await import("../productivity-engine");
    await updateProjectNotes(req.params.id as string, req.userId!, req.body.notes || "");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update notes" });
  }
});

// ─── TODAY / DAILY PLAN ───────────────────────────────────────────────

tasksRouter.get("/today", async (req, res) => {
  try {
    if (!req.userId) return res.json({ plan: null, tasks: [] });
    const plan = await getDailyPlan(req.userId);
    const tasks = await getTasks(req.userId);
    const pendingTasks = tasks.filter((t) => t.status !== "done");
    res.json({ plan, tasks: pendingTasks });
  } catch (err) {
    console.error("Get today error:", err);
    res.status(500).json({ error: "Failed to fetch today's plan" });
  }
});

tasksRouter.post("/today/generate", requireAuth, async (req, res) => {
  try {
    const plan = await generateDailyPlan(req.userId!, openai);
    const tasks = await getTasks(req.userId!);
    const pendingTasks = tasks.filter((t) => t.status !== "done");
    res.json({ plan, tasks: pendingTasks });
  } catch (err) {
    console.error("Generate plan error:", err);
    res.status(500).json({ error: "Failed to generate daily plan" });
  }
});

// ─── DAILY BRIEF ──────────────────────────────────────────────────────

tasksRouter.post("/brief", async (req, res) => {
  try {
    const { memory: clientMemory = [], recentMessages = [] } = req.body;
    const userId = req.userId;
    const hour = new Date().getHours();
    const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    let dbMemory = clientMemory;
    if (userId) {
      const memories = await getMemories(userId);
      if (memories.length > 0) {
        dbMemory = memories.map((m) => ({ text: m.text, category: m.category }));
      }
    }

    const memoryContext = dbMemory.length > 0
      ? `Memory: ${dbMemory.map((m: any) => m.text).join("; ")}`
      : "";
    const chatContext = recentMessages.length > 0
      ? `Recent conversation themes: ${recentMessages.slice(-6).map((m: any) => m.content).join(" | ")}`
      : "";

    const response = await openai.chat.completions.create({
      model: getBackgroundModel(),
      messages: [
        {
          role: "user",
          content: `Generate a ${period} brief for this person. ${memoryContext} ${chatContext}

Return ONLY valid JSON (no markdown): {"reflection":"one sentence that mirrors something real about them","pattern":"one observation about their week or habits","action":"one concrete small action for today"}

Keep each field under 15 words. Be specific and personal. Never invent facts you don't have.`,
        },
      ],
      max_completion_tokens: 256,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    res.json({ ...JSON.parse(cleaned), period });
  } catch (err) {
    console.error("Brief error:", err);
    res.status(500).json({
      reflection: "Every day is data. You're building something.",
      pattern: "You keep showing up. That's the habit.",
      action: "One honest conversation today.",
      period: "day",
    });
  }
});
