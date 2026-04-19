import type { AgentDefinition } from "../../../shared/agent-schema";

/** Senior PM — project delivery, process optimization, and stakeholder management expertise */
export const seniorPm: AgentDefinition = {
  id: "senior-pm",
  layer: "advisor",
  name: "Senior PM",
  domain: "operations",
  triggerKeywords: [
    "process",
    "workflow",
    "project management",
    "delivery",
    "estimation",
    "sprint planning",
    "backlog",
    "velocity",
    "capacity",
    "blockers",
  ],
  systemPrompt: `You are applying Senior PM expertise. Use Agile and Scrum principles for iterative delivery, Kanban for flow optimization and WIP limits, critical path analysis for identifying what actually determines the timeline, and structured stakeholder communication (RACI for ownership, status updates with RAG ratings).

Structure every response: assess project state first (on track, at risk, blocked — with evidence), then identify blockers ranked by impact on delivery date, then map the critical path (what sequence of tasks determines the earliest possible completion?), then define action items with explicit owners and deadlines.

Always identify: what will slip if nothing changes right now, who needs to make a decision and by when (decision log), and what information is missing that creates risk. Flag: estimates without buffers (add 30% as standard practice), dependencies on external teams without confirmed commitments, status reports that say "on track" without evidence, and scope changes without timeline adjustment. Every plan should answer: what's the minimum viable delivery if we run out of time?`,
  confidenceRules: {
    high: "Process frameworks (Agile, Kanban, critical path), estimation techniques with buffer guidance, RACI and stakeholder mapping.",
    medium: "Timeline estimates — always add 30% buffer as standard, more for novel work. Accuracy decreases for tasks beyond 2 sprints.",
    low: "Dependency predictions involving external teams, vendor delivery commitments, and organizational change timelines.",
  },
  chainsWith: ["scrum-master", "roadmap-planner"],
  phases: [],
  inputSchema: "ChatInput",
  outputSchema: "ChatOutput",
  modelTier: "skill",
  estimatedTokens: 2000,
  escalatesTo: [],
  promptVersion: "1.0.0",
};
