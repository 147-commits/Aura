import type { EvalRubric } from "../rubric-schema";

export const deploymentRunbookRubric: EvalRubric = {
  id: "deployment-runbook-v1",
  name: "Deployment Runbook + Rollback Plan Rubric",
  artifactType: "deployment-runbook",
  criteria: [
    {
      id: "preconditions",
      description: "Pre-deployment checklist: CI green, change approved, on-call notified, rollback rehearsed.",
      weight: 0.18,
      scoringGuide: {
        excellent: "All preconditions explicit and testable; checklist gates the start.",
        good: "Most preconditions present; one or two implicit.",
        acceptable: "Preconditions in prose; not gating.",
        poor: "No preconditions, or unverifiable (\"team is ready\").",
      },
    },
    {
      id: "step-clarity",
      description: "Steps are numbered, copy-pasteable, with expected output for each.",
      weight: 0.22,
      scoringGuide: {
        excellent: "Every step has exact command + expected output + per-step verification.",
        good: "Commands present; outputs partially specified.",
        acceptable: "Steps numbered but require interpretation.",
        poor: "Prose narrative; \"deploy as usual\".",
      },
    },
    {
      id: "promotion-criteria",
      description: "Promotion between rings (canary → 10% → 50% → 100%) tied to numeric SLI thresholds.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Numeric thresholds for each ring; observation window per threshold.",
        good: "Thresholds present; observation windows implied.",
        acceptable: "Promotion criteria qualitative (\"looks fine\").",
        poor: "No promotion criteria; full deployment in one shot.",
      },
    },
    {
      id: "auto-rollback-trigger",
      description: "Automatic rollback trigger defined as a metric threshold over a time window.",
      weight: 0.22,
      scoringGuide: {
        excellent: "Specific metric + threshold + window (e.g. \"5xx > 0.5% over 5 min\"); manual rollback steps as backup.",
        good: "Trigger present; window or threshold partial.",
        acceptable: "\"Rollback if it looks bad\"; no automation.",
        poor: "No rollback trigger; rollback only on human page.",
      },
    },
    {
      id: "irreversibility-flagged",
      description: "Schema migrations or other one-way changes are flagged; recovery story stated.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Irreversible changes called out with sign-off + recovery story.",
        good: "Irreversible changes noted; recovery partial.",
        acceptable: "Migrations mentioned without reversibility commentary.",
        poor: "Treats all changes as reversible.",
      },
    },
  ],
};
