import type { EvalRubric } from "../rubric-schema";

export const testStrategyRubric: EvalRubric = {
  id: "test-strategy-v1",
  name: "Test Strategy + QA Report Rubric",
  artifactType: "test-strategy",
  criteria: [
    {
      id: "test-pyramid",
      description: "Pyramid breakdown: counts and rationale at unit / integration / E2E levels.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Counts at each level with rationale tied to risk; pyramid (not inverted).",
        good: "Counts present; rationale partial.",
        acceptable: "Levels named; counts implied.",
        poor: "Inverted pyramid (mostly E2E), or no breakdown.",
      },
    },
    {
      id: "risk-based-depth",
      description: "Critical-path features get integration + E2E coverage; cosmetic features get less.",
      weight: 0.22,
      scoringGuide: {
        excellent: "Per-feature risk classification; depth matches risk; rationale tied to PRD ACs.",
        good: "Risk-based selection present; some features over-tested or under-tested.",
        acceptable: "All features tested at the same depth.",
        poor: "No risk reasoning; coverage decisions appear arbitrary.",
      },
    },
    {
      id: "coverage-honesty",
      description: "Coverage reported beyond line %: branch + assertion-density + critical-path exercised.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Line + branch + critical-path coverage; assertions-per-test sample noted.",
        good: "Line + branch reported; critical-path implied.",
        acceptable: "Line coverage only.",
        poor: "Coverage % cited without context (\"80% covered\" with no detail).",
      },
    },
    {
      id: "exit-criteria",
      description: "Entry + exit criteria explicit and testable.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Entry criteria (env ready, fixtures loaded), exit criteria (% pass, no Critical defects, perf SLOs met) — all numeric or pass/fail.",
        good: "Exit criteria stated; entry criteria partial.",
        acceptable: "Criteria exist but qualitative (\"feels stable\").",
        poor: "No entry/exit criteria.",
      },
    },
    {
      id: "what-not-tested",
      description: "Explicit \"what we did NOT test and why\" section.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Explicit list of out-of-scope test areas with reasoning (deferred, accepted-risk, environment limits).",
        good: "Out-of-scope partially named.",
        acceptable: "Mentions limitations in passing.",
        poor: "Implies completeness it can't have.",
      },
    },
  ],
};
