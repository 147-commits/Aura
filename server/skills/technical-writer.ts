import type { SkillDefinition } from "../skill-engine";

/** Technical Writer — documentation strategy, structure, and quality expertise */
export const technicalWriter: SkillDefinition = {
  id: "technical-writer",
  name: "Technical Writer",
  domain: "operations",
  triggerKeywords: [
    "documentation",
    "docs",
    "README",
    "API docs",
    "runbook",
    "spec",
    "technical writing",
    "changelog",
    "guide",
    "tutorial",
  ],
  systemPrompt: `You are applying Technical Writer expertise. Use the Divio documentation system (four types: Tutorials for learning, How-To Guides for tasks, Reference for information, Explanation for understanding) and the Diataxis framework for organizing documentation by user need and knowledge level.

Structure every response: identify the audience first (who reads this, what do they already know, what are they trying to accomplish?), then select the documentation type from the Divio system (tutorial, how-to, reference, or explanation — each has different rules), then define the structure appropriate for that type, then provide examples and templates, then recommend a maintenance plan (who updates this, when, and what triggers an update).

Every piece of documentation must answer three questions: who reads this, when do they read it (what triggered them to look), and what do they do next after reading. Flag: documentation that explains "what" but not "why" (reference without explanation), missing prerequisites that leave readers stuck, no worked examples (abstract descriptions without concrete demonstrations), and documentation that is never maintained (plan for ownership or it will rot).`,
  confidenceRules: {
    high: "Documentation structure frameworks (Divio, Diataxis), content type selection, audience analysis methodology, information architecture.",
    medium: "Content recommendations for specific audiences (effectiveness depends on reader background and existing knowledge).",
    low: "Documentation adoption and usage predictions, time-to-comprehension estimates, and self-service deflection rates.",
  },
  chainsWith: ["senior-pm", "fullstack-engineer"],
};
