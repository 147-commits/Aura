import type { EvalRubric } from "../rubric-schema";

export const deliveryPlanRubric: EvalRubric = {
  id: "delivery-plan-v1",
  name: "Delivery Plan + RAID Rubric",
  artifactType: "delivery-plan",
  criteria: [
    {
      id: "outcome-milestones",
      description: "Milestones are outcome-shaped (\"checkout live for pilot\") not activity-shaped (\"design phase done\").",
      weight: 0.22,
      scoringGuide: {
        excellent: "Every milestone is outcome-shaped, with named owner and date or date range.",
        good: "Most milestones are outcome-shaped; one or two slip into activities.",
        acceptable: "Mix of outcomes and activities; outcomes name owners.",
        poor: "Activities (\"finish design\", \"complete coding\") rather than outcomes; no clear owner.",
      },
    },
    {
      id: "critical-path",
      description: "Critical path is identified explicitly; non-critical tasks have float called out.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Critical path named; float on parallel tracks documented; rationale tied to dependency graph.",
        good: "Critical path named; float implied not stated.",
        acceptable: "Sequencing exists but the binding constraint is not labelled.",
        poor: "Plan reads as a flat list with no dependency awareness.",
      },
    },
    {
      id: "capacity-realism",
      description: "Capacity is stated in focus-hours (FTE × focus-time × velocity), not calendar weeks.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Capacity math shown: headcount × focus-time × velocity, with assumptions named (on-call, support, holidays).",
        good: "Capacity stated in focus-time; assumptions partial.",
        acceptable: "Calendar weeks with effort percentage applied.",
        poor: "Bare calendar weeks; no FTE or focus-time.",
      },
    },
    {
      id: "raid-completeness",
      description: "RAID log present: every Risk has probability + impact + mitigation + escalation trigger; every Assumption is falsifiable.",
      weight: 0.22,
      scoringGuide: {
        excellent: "RAID is complete; risks have triggers; assumptions list how they'd be invalidated; dependencies have named external contacts.",
        good: "RAID present; mitigations exist; some assumptions vague.",
        acceptable: "Risks listed without triggers; assumptions present but unfalsifiable.",
        poor: "No RAID, or risks without mitigations.",
      },
    },
    {
      id: "honest-uncertainty",
      description: "Timeline acknowledges unknowns as ranges, not point estimates.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Date ranges where unknowns dominate; single dates only where evidence supports them; explicit assumptions section.",
        good: "Mostly ranges; one or two false-precision dates.",
        acceptable: "Single dates throughout but flagged as best-estimate.",
        poor: "False-precision dates everywhere with no acknowledgement of uncertainty.",
      },
    },
  ],
};
