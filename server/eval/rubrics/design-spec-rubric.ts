import type { EvalRubric } from "../rubric-schema";

export const designSpecRubric: EvalRubric = {
  id: "design-spec-v1",
  name: "Design Spec + Component Library Rubric",
  artifactType: "design-spec",
  criteria: [
    {
      id: "user-flows-mapped",
      description: "Every PRD acceptance criterion has a user flow described step-by-step (state, action, response).",
      weight: 0.22,
      scoringGuide: {
        excellent: "Every AC traced to a flow; flows enumerate states + actions + system responses.",
        good: "Most ACs traced; one or two flows missing edge states.",
        acceptable: "Flows exist but ACs aren't explicitly traced.",
        poor: "ACs without flows; \"figure it out from the wireframe\".",
      },
    },
    {
      id: "component-reuse",
      description: "New components are clearly distinguished from reused ones; reuse is preferred where possible.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Component inventory: each component flagged new vs reused; new ones justified vs extending an existing.",
        good: "New vs reused noted; rationale partial.",
        acceptable: "Components listed without provenance.",
        poor: "New components introduced that overlap existing ones.",
      },
    },
    {
      id: "interaction-states",
      description: "Every new component has default / hover / active / disabled / loading / error / empty states defined.",
      weight: 0.20,
      scoringGuide: {
        excellent: "All seven states documented per new component; transitions named.",
        good: "Most states; one or two missing (commonly empty or loading).",
        acceptable: "Default + hover + disabled only.",
        poor: "Only default state shown.",
      },
    },
    {
      id: "accessibility",
      description: "WCAG 2.2 AA: contrast ≥4.5:1 for body, focus indicators, keyboard nav, ARIA semantics.",
      weight: 0.22,
      scoringGuide: {
        excellent: "Contrast checks done; focus order specified; ARIA roles listed; touch targets ≥44pt.",
        good: "Most accessibility considerations covered; one gap.",
        acceptable: "Accessibility mentioned in passing.",
        poor: "No accessibility section, or fails contrast / touch-target on common elements.",
      },
    },
    {
      id: "tokens-not-primitives",
      description: "Spec uses design tokens (color.text.primary), not raw hex / px values.",
      weight: 0.18,
      scoringGuide: {
        excellent: "All values via tokens; new tokens justified at the semantic layer.",
        good: "Tokens used; a few hardcoded values remain.",
        acceptable: "Mix of tokens and primitives.",
        poor: "Hardcoded hex/px throughout.",
      },
    },
  ],
};
