import type { EvalRubric } from "../rubric-schema";

export const adrRubric: EvalRubric = {
  id: "adr-v1",
  name: "Architecture Decision Record Rubric",
  artifactType: "adr",
  criteria: [
    {
      id: "context-clear",
      description: "Context section explains what forces this decision and what constraints apply.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Context cites concrete forces, constraints, and the state of the world when the decision is made.",
        good: "Context is clear but misses one significant constraint or assumption.",
        acceptable: "Context is sketched but generic.",
        poor: "Context is missing or reads like a press release.",
      },
    },
    {
      id: "decision-stated",
      description: "The actual decision is a single, unambiguous sentence near the top.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Decision is one sentence, imperative, testable (\"We will use Postgres over MySQL for X\").",
        good: "Decision is clear but spread across two or three sentences.",
        acceptable: "Decision is reachable but buried in paragraphs.",
        poor: "Decision is implicit — reader must guess.",
      },
    },
    {
      id: "alternatives-considered",
      description: "At least two real alternatives considered, each with honest trade-offs.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Three+ alternatives with honest pros/cons, including why not chosen.",
        good: "Two alternatives with clear trade-offs.",
        acceptable: "Alternatives listed but reasoning is shallow or biased.",
        poor: "No alternatives, or straw-man alternatives only.",
      },
    },
    {
      id: "consequences",
      description: "Consequences section lists both positive and negative outcomes.",
      weight: 0.17,
      scoringGuide: {
        excellent: "Positive and negative consequences listed with concrete impact on teams/systems.",
        good: "Consequences listed; negatives are lighter than positives.",
        acceptable: "Only positive consequences listed.",
        poor: "No consequences section, or \"we'll be faster and better\".",
      },
    },
    {
      id: "status-lifecycle",
      description: "Status is explicit (proposed/accepted/deprecated/superseded) with date.",
      weight: 0.10,
      scoringGuide: {
        excellent: "Status, date, and — if superseded — pointer to replacing ADR.",
        good: "Status and date present.",
        acceptable: "Status present but no date.",
        poor: "No status field.",
      },
    },
    {
      id: "reversibility-called-out",
      description: "ADR explicitly says whether this decision is reversible and at what cost.",
      weight: 0.10,
      scoringGuide: {
        excellent: "Reversibility stated with concrete cost (migration effort, data lock-in, lock-in period).",
        good: "Reversibility noted qualitatively.",
        acceptable: "Mentions it's hard or easy to change, without specifics.",
        poor: "Reversibility not discussed.",
      },
    },
    {
      id: "truth-first-tone",
      description: "Tone is calm and truth-first — honest about uncertainty, no hype.",
      weight: 0.07,
      scoringGuide: {
        excellent: "Calm, precise, acknowledges uncertainty where present.",
        good: "Professional; mild overclaiming.",
        acceptable: "Reads like a vendor pitch in places.",
        poor: "Hype-heavy, asserts certainty it can't have.",
      },
    },
  ],
};
