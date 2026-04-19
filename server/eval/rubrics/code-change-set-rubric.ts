import type { EvalRubric } from "../rubric-schema";

export const codeChangeSetRubric: EvalRubric = {
  id: "code-change-set-v1",
  name: "Code Change Set Rubric",
  artifactType: "code-change-set",
  criteria: [
    {
      id: "tests-with-change",
      description: "Every change includes accompanying tests; bug fixes start with a failing test.",
      weight: 0.25,
      scoringGuide: {
        excellent: "Tests added at appropriate level; bug fix has a test that would have failed before; tests assert observable behavior.",
        good: "Tests added; assertions present; one or two bug fixes lack the failing-test-first pattern.",
        acceptable: "Tests added but they're weak (smoke / coverage-bait).",
        poor: "Code without tests, or tests that don't assert.",
      },
    },
    {
      id: "ac-traceability",
      description: "New tests are named to map to PRD acceptance criteria.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Every AC has a named test; reverse-mapping (test → AC) trivial.",
        good: "Most ACs traced; some ACs have implicit coverage only.",
        acceptable: "Tests exist; mapping requires hunting.",
        poor: "ACs and tests live separate lives.",
      },
    },
    {
      id: "smallest-change",
      description: "Diff is the smallest reasonable change to solve the ticket — no smuggled refactors or unrelated cleanup.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Change set is tightly scoped; refactors and cleanup carved into separate PRs or tickets.",
        good: "Mostly tight; one or two unrelated tweaks.",
        acceptable: "Change is correct but bundles refactor or style fixes.",
        poor: "Change is a kitchen-sink PR.",
      },
    },
    {
      id: "naming-and-comments",
      description: "Names tell you what; comments tell you why. No restated-name comments; no smell names (data, info, helper).",
      weight: 0.20,
      scoringGuide: {
        excellent: "Every new identifier is specific; comments are present only where the why is non-obvious.",
        good: "Mostly good naming; a few generic identifiers.",
        acceptable: "Names work; comments restate code in places.",
        poor: "Smell names everywhere; comments narrate the obvious.",
      },
    },
    {
      id: "boundary-validation",
      description: "Defensive validation lives at boundaries (user input, external API), NOT in trusted internals.",
      weight: 0.19,
      scoringGuide: {
        excellent: "Boundaries validate; internals trust their callers; assertions used during development not in hot paths.",
        good: "Boundaries validate; some internal redundant checks.",
        acceptable: "Validation present but not boundary-driven.",
        poor: "Hot-path validation everywhere; or no validation at boundaries.",
      },
    },
  ],
};
