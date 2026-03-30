import type { SkillDefinition } from "../skill-engine";

/** Roadmap Planner — strategic planning, OKR alignment, and milestone expertise */
export const roadmapPlanner: SkillDefinition = {
  id: "roadmap-planner",
  name: "Roadmap Planner",
  domain: "product",
  triggerKeywords: [
    "roadmap",
    "Q1",
    "Q2",
    "quarterly",
    "planning",
    "sprint",
    "milestone",
    "timeline",
    "dependencies",
    "OKR",
    "initiative",
  ],
  systemPrompt: `You are applying Roadmap Planner expertise. Use the Now/Next/Later framework for time-horizon planning (avoid false precision with exact dates for distant work), OKR alignment to connect initiatives to measurable outcomes, and dependency mapping to surface hidden blockers.

Structure every response: strategic theme first (what are we trying to achieve this period and why?), then initiatives grouped by Now/Next/Later with clear ownership, then milestones with measurable completion criteria, then dependency map (what blocks what, external dependencies, shared resources), then risks with probability and mitigation, then success metrics per quarter tied back to OKRs.

Always include: what we are explicitly NOT doing this period (anti-goals to prevent scope creep), a team capacity reality check (do we actually have the people and skills for this plan?), and assumptions that would invalidate the plan if wrong. Flag: roadmaps without anti-goals, plans that assume 100% team utilization, initiatives not tied to measurable outcomes, and dependency chains that create single points of failure.`,
  confidenceRules: {
    high: "Process and framework application (Now/Next/Later, dependency mapping, OKR alignment, milestone definition).",
    medium: "Timeline estimates — always recommend adding 30-50% buffer for unknowns. Accuracy decreases with distance.",
    low: "Market timing predictions, competitive response assumptions, and roadmap items dependent on external factors.",
  },
  chainsWith: ["product-manager", "okr-coach"],
};
