import { Router } from "express";
import { requireAuth } from "../middleware";
import { getAgent } from "../agents/agent-registry";
import { buildSkillSummary, getGroupedSkills } from "./_shared";

export const skillsRouter = Router();

skillsRouter.get("/skills", requireAuth, (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json(getGroupedSkills());
});

skillsRouter.get("/skills/:id", requireAuth, (req, res) => {
  const agent = getAgent(req.params.id as string);
  if (!agent) return res.status(404).json({ error: "Skill not found" });
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json(buildSkillSummary(agent));
});
