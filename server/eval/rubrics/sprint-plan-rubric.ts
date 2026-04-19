import type { EvalRubric } from "../rubric-schema";

export const sprintPlanRubric: EvalRubric = {
  id: "sprint-plan-v1",
  name: "Sprint Plan Rubric",
  artifactType: "sprint-plan",
  criteria: [
    {
      id: "invest-stories",
      description: "Every story is INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable.",
      weight: 0.25,
      scoringGuide: {
        excellent: "All stories pass INVEST; sized small enough to complete in <3 days; acceptance criteria attached.",
        good: "Most stories INVEST; one or two oversized.",
        acceptable: "Stories present; some lack acceptance criteria or are too large.",
        poor: "Epics-as-stories; no acceptance criteria.",
      },
    },
    {
      id: "definition-of-ready",
      description: "Every story has Definition of Ready met: ACs, dependencies named, design attached if needed, estimate.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Every story has explicit DoR check; missing items called out before sprint starts.",
        good: "DoR mostly met; one or two stories partial.",
        acceptable: "DoR referenced but not enforced per story.",
        poor: "No DoR; stories enter sprint half-defined.",
      },
    },
    {
      id: "estimates-with-bands",
      description: "Estimates carry a confidence band, not point estimates.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Every estimate has a band (e.g. \"3–5 days\"); rationale tied to known unknowns.",
        good: "Most estimates banded; a few point estimates.",
        acceptable: "T-shirt sizes (S/M/L); confidence implied not stated.",
        poor: "Single-day estimates with no uncertainty acknowledgment.",
      },
    },
    {
      id: "capacity-respected",
      description: "Sum of estimates ≤ team capacity × 0.7 to leave room for unplanned work.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Capacity math shown; sprint is sized at ≤70% of capacity; rationale for remaining 30% (support, on-call, unknowns).",
        good: "Capacity considered; sized at 70–80%.",
        acceptable: "Capacity acknowledged but sprint is at >80% utilization.",
        poor: "Sprint packed to 100%; no buffer for the inevitable.",
      },
    },
    {
      id: "out-of-sprint-explicit",
      description: "Explicit list of what is NOT in this sprint and why.",
      weight: 0.17,
      scoringGuide: {
        excellent: "Out-of-sprint list with reasons; deferrals tied to dependencies or capacity.",
        good: "Out-of-sprint list present; reasons partial.",
        acceptable: "Mentions deferrals in passing.",
        poor: "No out-of-sprint section; scope assumed unbounded.",
      },
    },
  ],
};
