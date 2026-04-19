import { Router } from "express";
import { requireAuth, budgetCheck } from "../middleware";

export const builderRouter = Router();

const builderImports = {
  engine: require("../builder-engine") as typeof import("../builder-engine"),
  prompts: require("../builder-prompts") as typeof import("../builder-prompts"),
};

builderRouter.post("/builder/generate", requireAuth, budgetCheck, async (req, res) => {
  try {
    const { projectId, prompt, type = "website", name } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.flushHeaders();

    let project;
    if (projectId) {
      project = await builderImports.engine.getBuilderProject(projectId, req.userId!);
      if (!project) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Project not found" })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    } else {
      project = await builderImports.engine.createBuilderProject(
        req.userId!, type, name || "Untitled Website"
      );
    }

    const systemPrompt = type === "mobile-app"
      ? builderImports.prompts.MOBILE_APP_BUILDER_PROMPT
      : builderImports.prompts.WEBSITE_BUILDER_PROMPT;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (project.currentHtml) {
      messages.push({ role: "assistant", content: project.currentHtml });
    }

    messages.push({ role: "user", content: prompt });

    const { createStream: streamAI } = await import("../ai-provider");
    const stream = streamAI("gpt-4o-mini", messages, 8192);

    let fullHtml = "";
    for await (const chunk of stream) {
      if (chunk.content) {
        fullHtml += chunk.content;
        res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk.content })}\n\n`);
      }
    }

    const files = { ...project.files, "index.html": fullHtml };
    await builderImports.engine.updateProjectFiles(project.id, files, fullHtml);

    res.write(`data: ${JSON.stringify({
      type: "complete",
      project: { id: project.id, name: project.name, type: project.type },
    })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Builder generate error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Aura couldn't build that right now" });
    else { res.write("data: [DONE]\n\n"); res.end(); }
  }
});

builderRouter.get("/builder/projects", requireAuth, async (req, res) => {
  try {
    const projects = await builderImports.engine.getUserBuilderProjects(req.userId!);
    res.json(projects);
  } catch (err) {
    console.error("List builder projects error:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

builderRouter.get("/builder/projects/:id", requireAuth, async (req, res) => {
  try {
    const project = await builderImports.engine.getBuilderProject(req.params.id as string, req.userId!);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    console.error("Get builder project error:", err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

builderRouter.delete("/builder/projects/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await builderImports.engine.deleteBuilderProject(req.params.id as string, req.userId!);
    if (!deleted) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete builder project error:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

builderRouter.post("/builder/projects/:id/deploy", requireAuth, async (req, res) => {
  try {
    const { vercelToken } = req.body;
    if (!vercelToken) return res.status(400).json({ error: "vercelToken is required" });

    const project = await builderImports.engine.getBuilderProject(req.params.id as string, req.userId!);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!project.files || Object.keys(project.files).length === 0) {
      return res.status(400).json({ error: "No files to deploy" });
    }

    const { deployToVercel, saveDeployUrl } = await import("../deploy-engine");
    const result = await deployToVercel(project.name, project.files, vercelToken);
    await saveDeployUrl(project.id, result.url);

    res.json({ success: true, url: result.url, deploymentId: result.deploymentId });
  } catch (err) {
    console.error("Deploy error:", err);
    res.status(500).json({ error: "Deployment failed — check your Vercel token" });
  }
});
