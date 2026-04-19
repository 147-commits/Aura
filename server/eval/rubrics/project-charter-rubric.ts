import type { EvalRubric } from "../rubric-schema";

export const projectCharterRubric: EvalRubric = {
  id: "project-charter-v1",
  name: "Project Charter Rubric",
  artifactType: "project-charter",
  criteria: [
    {
      id: "vision-crisp",
      description: "Vision is one sentence a new hire could repeat from memory.",
      weight: 0.18,
      scoringGuide: {
        excellent: "One sentence, concrete, with verb + audience + outcome.",
        good: "Two sentences, clear but slightly long.",
        acceptable: "Vision present but abstract or jargon-heavy.",
        poor: "No vision, or buzzword soup.",
      },
    },
    {
      id: "scope-bounded",
      description: "Scope explicitly lists what's in AND what's out.",
      weight: 0.18,
      scoringGuide: {
        excellent: "In-scope and out-of-scope lists both present, each with 3+ items.",
        good: "Both present but one is thin.",
        acceptable: "Only in-scope listed.",
        poor: "No scope boundaries — \"whatever the product needs\".",
      },
    },
    {
      id: "stakeholders-named",
      description: "Stakeholders named by role, with decision rights explicit.",
      weight: 0.15,
      scoringGuide: {
        excellent: "Stakeholders named with role + RACI-style rights.",
        good: "Stakeholders named with role.",
        acceptable: "Generic list (\"leadership\", \"engineering\").",
        poor: "No stakeholders listed.",
      },
    },
    {
      id: "success-criteria",
      description: "Success criteria are numeric or pass/fail — not \"we'll know it when we see it\".",
      weight: 0.17,
      scoringGuide: {
        excellent: "Numeric targets with baseline and window.",
        good: "Numeric targets without baseline.",
        acceptable: "Qualitative but specific (\"shipped to 5 pilot customers\").",
        poor: "Vibes (\"it should feel good\").",
      },
    },
    {
      id: "timeline-realistic",
      description: "Timeline has phases or milestones with dates, and a named owner per milestone.",
      weight: 0.12,
      scoringGuide: {
        excellent: "Milestones with dates and owners; acknowledges unknowns as ranges.",
        good: "Milestones with dates, no owners.",
        acceptable: "A single date named (launch).",
        poor: "No timeline, or \"ASAP\".",
      },
    },
    {
      id: "risks-called-out",
      description: "Top risks named with mitigation or trigger-to-escalate.",
      weight: 0.12,
      scoringGuide: {
        excellent: "3+ risks, each with mitigation and escalation trigger.",
        good: "Risks named with mitigations.",
        acceptable: "Risks listed but mitigations are \"monitor closely\".",
        poor: "No risks section.",
      },
    },
    {
      id: "truth-first-tone",
      description: "Tone is calm and truth-first — admits what's unknown.",
      weight: 0.08,
      scoringGuide: {
        excellent: "Calm, explicitly lists what's unknown or assumed.",
        good: "Professional; some hedging.",
        acceptable: "Confident but glosses over unknowns.",
        poor: "Hype-heavy, asserts certainty on unknowable things.",
      },
    },
  ],
};
