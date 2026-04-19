import type { EvalRubric } from "../rubric-schema";

export const prdRubric: EvalRubric = {
  id: "prd-v1",
  name: "Product Requirements Document Rubric",
  artifactType: "prd",
  criteria: [
    {
      id: "problem-statement",
      description: "Problem statement describes user pain — not the solution.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Pain is named in the user's words, with a specific trigger situation; no solution language.",
        good: "Pain is clear and user-centered, but lightly mixes in solution hints.",
        acceptable: "Problem is stated but generic, or slightly solution-flavored.",
        poor: "Problem is really a solution in disguise, or vague (\"users want a better experience\").",
      },
    },
    {
      id: "target-users",
      description: "Target users named with persona-level detail (role, context, constraints).",
      weight: 0.15,
      scoringGuide: {
        excellent: "Users named with role, stage, constraints, and what they've tried before.",
        good: "Users named with role and a clear defining attribute.",
        acceptable: "User segment named but generic (\"small businesses\", \"developers\").",
        poor: "No user named, or \"everyone\" / \"users\".",
      },
    },
    {
      id: "acceptance-criteria",
      description: "Acceptance criteria are testable predicates with pass/fail answers.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Every criterion has an observable behavior and a concrete pass/fail check.",
        good: "Most criteria are testable; one or two are aspirational.",
        acceptable: "Criteria exist but mix testable with vague (\"it should feel fast\").",
        poor: "No criteria, or entirely subjective statements.",
      },
    },
    {
      id: "success-metrics",
      description: "Success metrics are named with numeric targets and measurement windows.",
      weight: 0.17,
      scoringGuide: {
        excellent: "Metrics named with baseline, target number, and measurement window.",
        good: "Metrics named with target number but missing baseline or window.",
        acceptable: "Metrics named but targets are qualitative (\"improve engagement\").",
        poor: "No metrics, or \"we'll know when we see it\".",
      },
    },
    {
      id: "non-goals",
      description: "At least one explicit non-goal stated.",
      weight: 0.12,
      scoringGuide: {
        excellent: "Non-goals list scopes out multiple adjacent temptations with reasoning.",
        good: "One or two non-goals stated clearly.",
        acceptable: "A non-goal exists but is trivial or redundant with the goals.",
        poor: "No non-goals section.",
      },
    },
    {
      id: "open-questions",
      description: "Open questions or unknowns are explicitly listed.",
      weight: 0.10,
      scoringGuide: {
        excellent: "Open questions are crisp, named, and assigned an owner or decision deadline.",
        good: "Open questions are listed clearly.",
        acceptable: "A single vague open question is mentioned.",
        poor: "No open questions listed — the PRD pretends certainty it can't have.",
      },
    },
    {
      id: "truth-first-tone",
      description: "Tone is calm and truth-first — no sycophancy, no exclamation marks, no hype.",
      weight: 0.08,
      scoringGuide: {
        excellent: "Calm, direct prose. Confidence stated where warranted. No filler.",
        good: "Mostly calm; occasional marketing flourish.",
        acceptable: "Professional but with promotional tone creeping in.",
        poor: "Hype-heavy (\"delightful\", \"seamless\", exclamation marks everywhere).",
      },
    },
  ],
};
