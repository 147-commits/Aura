/**
 * Pipeline artifact schemas — Zod definitions for every AgentDefinition.outputSchema
 * name registered in C1. Every artifact carries a Truth-First confidence
 * field via withConfidence() (F6 policy).
 *
 * The exported ARTIFACT_SCHEMAS registry maps outputSchema name → {
 *   schema, description, artifactType
 * }. The agent-invoker resolves agent.outputSchema through this registry
 * to pick the right Zod validator + rubric (via artifactType) at runtime.
 *
 * Field-level .describe() docstrings are surfaced into the agent prompt
 * so the model receives an authoritative description of what to produce.
 */

import { z } from "zod";
import { withConfidence } from "../truth-first/artifact-schema";
import type { ArtifactType } from "../eval/rubric-schema";

// ── Reusable field helpers ─────────────────────────────────────────────────

const Severity = z.enum(["Critical", "High", "Medium", "Low"]);
const Probability = z.enum(["Low", "Medium", "High"]);

const Stakeholder = z
  .object({
    name: z.string().min(1).describe("Stakeholder role or named contact (avoid 'leadership')"),
    role: z.string().min(1).describe("Functional role"),
    raci: z.enum(["R", "A", "C", "I"]).describe("Responsible / Accountable / Consulted / Informed"),
  })
  .describe("Stakeholder with explicit decision rights");

const SuccessMetric = z
  .object({
    metric: z.string().min(1).describe("Metric name"),
    target: z.string().min(1).describe("Numeric target (e.g. '>40%', '<24h')"),
    window: z.string().min(1).describe("Measurement window (e.g. 'first 30 days post-launch')"),
    baseline: z.string().optional().describe("Current value if known; omit only when no baseline exists"),
  })
  .describe("A measurable success criterion");

const Milestone = z
  .object({
    name: z.string().min(1).describe("Outcome milestone (e.g. 'checkout flow live for pilot cohort')"),
    date: z.string().min(1).describe("Target date or date range; ranges acknowledge unknowns"),
    owner: z.string().min(1).describe("Named owner — never 'team' or 'leadership'"),
    acceptanceSignal: z.string().optional().describe("How completion is verified"),
  })
  .describe("Outcome-shaped milestone with named ownership");

const Risk = z
  .object({
    description: z.string().min(1),
    probability: Probability,
    impact: Severity,
    mitigation: z.string().min(1).describe("Concrete mitigation, not 'monitor closely'"),
    escalationTrigger: z.string().min(1).describe("Numeric or pass/fail trigger that escalates"),
  })
  .describe("Risk with mitigation and escalation trigger");

const OpenQuestion = z
  .object({
    question: z.string().min(1),
    owner: z.string().min(1).describe("Named owner"),
    decisionBy: z.string().min(1).describe("Decision deadline (date or milestone)"),
  })
  .describe("Open question with explicit ownership and deadline");

// ── 1. ProjectCharter (CEO) ────────────────────────────────────────────────

export const ProjectCharterBody = z.object({
  vision: z.string().min(1).describe("One sentence a new hire could repeat from memory"),
  inScope: z.array(z.string().min(1)).min(3).describe("≥3 in-scope items"),
  outOfScope: z.array(z.string().min(1)).min(3).describe("≥3 out-of-scope items — protect against scope creep"),
  stakeholders: z.array(Stakeholder).min(1).describe("Stakeholders with RACI rights"),
  successCriteria: z.array(SuccessMetric).min(1).describe("Numeric success metrics with measurement windows"),
  milestones: z.array(Milestone).min(1).describe("Outcome milestones with owners"),
  risks: z.array(Risk).min(1).describe("Top risks with mitigation + escalation trigger"),
  openQuestions: z.array(OpenQuestion).default([]).describe("Open questions with owners + decision deadlines"),
});
export const ProjectCharterSchema = withConfidence(ProjectCharterBody);
export type ProjectCharter = z.infer<typeof ProjectCharterSchema>;

// ── 2. ArchitectureBundle (CTO) — includes ADRs ────────────────────────────

const ADRAlternative = z
  .object({
    option: z.string().min(1),
    pros: z.array(z.string().min(1)).min(1),
    cons: z.array(z.string().min(1)).min(1),
    rejectedBecause: z.string().min(1),
  })
  .describe("Real alternative with honest trade-offs — straw-men count as zero");

const ADR = z
  .object({
    id: z.string().min(1).describe("Stable id, e.g. 'ADR-012'"),
    title: z.string().min(1),
    status: z.enum(["proposed", "accepted", "deprecated", "superseded"]),
    date: z.string().min(1).describe("ISO date"),
    context: z.string().min(1).describe("Forces + constraints; what made this decision necessary"),
    decision: z.string().min(1).describe("One imperative sentence"),
    alternatives: z.array(ADRAlternative).min(2).describe("≥2 real alternatives"),
    consequencesPositive: z.array(z.string().min(1)).min(1),
    consequencesNegative: z.array(z.string().min(1)).min(1).describe("Honest trade-offs — not zero"),
    reversibilityCost: z.string().min(1).describe("Concrete cost to undo (engineer-weeks, lock-in period)"),
  })
  .describe("Architecture Decision Record");
export const ADRSchema = withConfidence(ADR);

const ArchitectureBundleBody = z.object({
  contextDiagram: z.string().min(1).describe("Textual C4 Context view: system + actors + data flows"),
  containerDiagram: z.string().min(1).describe("Textual C4 Container view: services + datastores + protocols"),
  adrs: z.array(ADR).min(1).describe("3–5 most consequential ADRs"),
  irreversibleDecisions: z
    .array(z.object({ decision: z.string().min(1), justification: z.string().min(1) }))
    .default([])
    .describe("Decisions that can't be cheaply undone, with justification"),
  notBuilding: z.array(z.string().min(1)).default([]).describe("Adjacent things deliberately scoped out"),
});
export const ArchitectureBundleSchema = withConfidence(ArchitectureBundleBody);
export type ArchitectureBundle = z.infer<typeof ArchitectureBundleSchema>;

// ── 3. PRD (CPO) ───────────────────────────────────────────────────────────

const AcceptanceCriterion = z
  .object({
    id: z.string().min(1).describe("Stable id, e.g. 'AC1'"),
    predicate: z.string().min(1).describe("Testable Given/When/Then or pass/fail predicate"),
    passCheck: z.string().min(1).describe("How to verify pass/fail"),
  })
  .describe("Testable acceptance criterion");

const PRDBody = z.object({
  problem: z.string().min(1).describe("User PAIN in the user's words — not the solution"),
  targetUser: z.string().min(1).describe("Named role + persona detail; not 'everyone'"),
  jtbdStatement: z.string().min(1).describe("'When [situation], I want to [motivation], so I can [outcome]'"),
  inScope: z.array(z.string().min(1)).min(1),
  nonGoals: z.array(z.string().min(1)).min(1).describe("≥1 explicit non-goal"),
  acceptanceCriteria: z.array(AcceptanceCriterion).min(1),
  successMetrics: z.array(SuccessMetric).min(1),
  openQuestions: z.array(OpenQuestion).default([]),
});
export const PRDSchema = withConfidence(PRDBody);
export type PRD = z.infer<typeof PRDSchema>;

// ── 4. DeliveryPlan (COO) — includes RAID ──────────────────────────────────

const Assumption = z
  .object({
    statement: z.string().min(1),
    invalidatedBy: z.string().min(1).describe("How would this assumption be falsified"),
  })
  .describe("Falsifiable assumption");

const Issue = z
  .object({
    description: z.string().min(1),
    owner: z.string().min(1),
    targetResolution: z.string().min(1).describe("Date or milestone"),
  })
  .describe("Active issue with owner + target resolution");

const Dependency = z
  .object({
    description: z.string().min(1),
    externalParty: z.string().min(1).describe("Named external contact, not 'vendor'"),
    status: z.enum(["unblocked", "in-flight", "blocked"]),
    escalationPath: z.string().min(1),
  })
  .describe("Cross-team or external dependency");

const RAIDLog = z
  .object({
    risks: z.array(Risk).min(1),
    assumptions: z.array(Assumption).min(1),
    issues: z.array(Issue).default([]),
    dependencies: z.array(Dependency).default([]),
  })
  .describe("Risks, Assumptions, Issues, Dependencies");

const RolloutPlan = z
  .object({
    rings: z
      .array(
        z.object({
          name: z.string().min(1).describe("e.g. 'canary', '10%', '50%', '100%'"),
          promotionCriteria: z
            .array(z.string().min(1))
            .min(1)
            .describe("Explicit numeric criteria, not 'looks fine'"),
          observationWindow: z.string().min(1).describe("e.g. '5 minutes', '24 hours'"),
        })
      )
      .min(1),
    autoRollbackTriggers: z
      .array(z.string().min(1))
      .min(1)
      .describe("e.g. '5xx > 0.5% over 5 minutes'"),
    onCallOwner: z.string().min(1).describe("Named owner for the launch window"),
  })
  .describe("Rollout strategy with explicit promotion criteria");

const DeliveryPlanBody = z.object({
  phases: z.array(Milestone).min(1).describe("Outcome-shaped phases with owners + dates"),
  criticalPath: z.array(z.string().min(1)).min(1).describe("Named tasks on the critical path"),
  capacity: z.object({
    fteCount: z.number().positive(),
    focusHoursPerWeek: z.number().positive().describe("Per FTE, after on-call/support/holidays"),
    velocityNotes: z.string().min(1).describe("Source of velocity assumption"),
  }),
  raid: RAIDLog,
  rolloutPlan: RolloutPlan.optional().describe("Required for Release-phase plans"),
});
export const DeliveryPlanSchema = withConfidence(DeliveryPlanBody);
export type DeliveryPlan = z.infer<typeof DeliveryPlanSchema>;

// ── 5. ThreatModel (CISO) ──────────────────────────────────────────────────

const Threat = z
  .object({
    id: z.string().min(1),
    stride: z.enum(["Spoofing", "Tampering", "Repudiation", "InformationDisclosure", "DenialOfService", "ElevationOfPrivilege"]),
    boundary: z.string().min(1).describe("Trust boundary the threat crosses"),
    description: z.string().min(1),
    severity: Severity,
    impact: z.string().min(1),
    exploitability: z.string().min(1),
    mitigation: z.string().min(1).describe("Concrete control"),
    owner: z.string().min(1),
    targetPhase: z.enum(["design", "implementation", "verification", "release"]),
  })
  .describe("Threat with mitigation + owner + target phase");

const ThreatModelBody = z.object({
  dataFlow: z.string().min(1).describe("Data flow described textually: entries, components, datastores, trust boundaries"),
  trustBoundaries: z.array(z.string().min(1)).min(1),
  dataClassification: z
    .object({
      public: z.array(z.string()).default([]),
      internal: z.array(z.string()).default([]),
      confidential: z.array(z.string()).default([]),
      restricted: z.array(z.string()).default([]),
    })
    .describe("Per-classification list of data items"),
  threats: z.array(Threat).min(1),
  residualRisks: z
    .array(
      z.object({
        risk: z.string().min(1),
        whyAccepted: z.string().min(1).describe("Business rationale for acceptance"),
        compensatingControls: z.array(z.string()).default([]),
      })
    )
    .default([]),
});
export const ThreatModelSchema = withConfidence(ThreatModelBody);
export type ThreatModel = z.infer<typeof ThreatModelSchema>;

// ── 6. SprintPlan (eng-lead) ───────────────────────────────────────────────

const Story = z
  .object({
    id: z.string().min(1),
    story: z.string().min(1).describe("As a/Want/So that, in INVEST form"),
    acceptanceCriteria: z.array(z.string().min(1)).min(1),
    estimateDays: z
      .object({
        low: z.number().positive(),
        high: z.number().positive(),
      })
      .describe("Confidence band, not a point estimate"),
    dependencies: z.array(z.string()).default([]),
    designAttached: z.boolean().describe("True when DoR includes a linked design"),
  })
  .describe("INVEST story with DoR met");

const SprintPlanBody = z.object({
  sprintName: z.string().min(1),
  durationWeeks: z.number().positive(),
  stories: z.array(Story).min(1),
  capacityCheck: z.object({
    estimateDaysSum: z.number().describe("Sum of high-end estimates"),
    capacityDays: z.number().describe("FTE × focus-days × duration"),
    utilizationRatio: z.number().describe("Should be ≤ 0.7 to leave room for unplanned"),
  }),
  outOfSprint: z.array(z.string().min(1)).min(1).describe("≥1 explicit deferral"),
  risks: z.array(Risk).default([]),
});
export const SprintPlanSchema = withConfidence(SprintPlanBody);
export type SprintPlan = z.infer<typeof SprintPlanSchema>;

// ── 7. TestStrategy (qa-lead) ──────────────────────────────────────────────

const TestPyramidLevel = z
  .object({
    level: z.enum(["unit", "integration", "e2e"]),
    plannedCount: z.number().nonnegative(),
    rationale: z.string().min(1).describe("Why this many at this level — tied to risk"),
  });

const FeatureRisk = z
  .object({
    feature: z.string().min(1),
    risk: Severity,
    plannedDepth: z.enum(["unit", "unit+integration", "unit+integration+e2e", "manual-only"]),
  });

const TestStrategyBody = z.object({
  pyramid: z.array(TestPyramidLevel).min(3).describe("All three levels"),
  riskMatrix: z.array(FeatureRisk).min(1),
  environments: z.array(z.string().min(1)).min(1),
  fixtureStrategy: z.string().min(1),
  manualScope: z.array(z.string()).default([]).describe("What we deliberately don't automate"),
  entryCriteria: z.array(z.string().min(1)).min(1),
  exitCriteria: z.array(z.string().min(1)).min(1),
  notTested: z.array(z.string()).default([]).describe("Explicit out-of-scope test areas with reasoning"),
});
export const TestStrategySchema = withConfidence(TestStrategyBody);
export type TestStrategy = z.infer<typeof TestStrategySchema>;

// ── 8. DesignSpec (design-lead) ────────────────────────────────────────────

const FlowStep = z
  .object({
    state: z.string().min(1),
    action: z.string().min(1),
    response: z.string().min(1),
  });

const UserFlow = z
  .object({
    acId: z.string().min(1).describe("References a PRD acceptance criterion id"),
    steps: z.array(FlowStep).min(1),
  });

const ComponentSpec = z
  .object({
    name: z.string().min(1),
    isNew: z.boolean(),
    states: z
      .array(z.enum(["default", "hover", "active", "disabled", "loading", "error", "empty"]))
      .min(1),
    props: z.array(z.object({ name: z.string(), type: z.string() })).default([]),
    accessibilityRole: z.string().optional(),
  });

const DesignSpecBody = z.object({
  userFlows: z.array(UserFlow).min(1),
  components: z.array(ComponentSpec).min(1),
  tokensUsed: z.array(z.string().min(1)).min(1).describe("Design tokens consumed (color/spacing/typography)"),
  accessibility: z.object({
    wcagLevel: z.enum(["A", "AA", "AAA"]).describe("Target conformance level"),
    contrastChecksPerformed: z.boolean(),
    keyboardNavTested: z.boolean(),
    notes: z.string().optional(),
  }),
  outOfScope: z.array(z.string()).default([]),
});
export const DesignSpecSchema = withConfidence(DesignSpecBody);
export type DesignSpec = z.infer<typeof DesignSpecSchema>;

// ── 9. DeploymentRunbook (devops-lead) ─────────────────────────────────────

const DeployStep = z
  .object({
    n: z.number().int().positive(),
    command: z.string().min(1).describe("Exact copy-pasteable command"),
    expectedOutput: z.string().min(1),
    verification: z.string().min(1).describe("How to confirm the step succeeded"),
  });

const DeploymentRunbookBody = z.object({
  preconditions: z.array(z.string().min(1)).min(1).describe("CI green, change approved, on-call notified, rollback rehearsed"),
  steps: z.array(DeployStep).min(1),
  promotionCriteria: z
    .array(
      z.object({
        ring: z.string().min(1),
        threshold: z.string().min(1).describe("Numeric SLI threshold"),
        observationWindow: z.string().min(1),
      })
    )
    .min(1),
  autoRollbackTrigger: z.object({
    metric: z.string().min(1),
    threshold: z.string().min(1),
    window: z.string().min(1),
  }),
  manualRollbackSteps: z.array(z.string().min(1)).min(1),
  irreversibleChanges: z
    .array(z.object({ change: z.string(), recoveryStory: z.string(), signOffBy: z.string() }))
    .default([]),
  onCallOwner: z.string().min(1),
});
export const DeploymentRunbookSchema = withConfidence(DeploymentRunbookBody);
export type DeploymentRunbook = z.infer<typeof DeploymentRunbookSchema>;

// ── 10. SystemDesignDoc (architect) ────────────────────────────────────────

const BoundedContext = z
  .object({
    name: z.string().min(1),
    glossary: z.array(z.object({ term: z.string(), meaning: z.string() })).min(1),
    relationships: z
      .array(
        z.object({
          to: z.string().min(1),
          kind: z.enum(["shared-kernel", "customer-supplier", "anticorruption-layer", "conformist", "open-host"]),
        })
      )
      .default([]),
  });

const ComponentContract = z
  .object({
    fromComponent: z.string().min(1),
    toComponent: z.string().min(1),
    requestShape: z.string().min(1),
    responseShape: z.string().min(1),
    errors: z.array(z.string()).default([]),
    idempotency: z.enum(["idempotent", "non-idempotent", "idempotent-with-key"]),
    retrySemantics: z.string().min(1).describe("e.g. 'exponential backoff with jitter, 3 retries'"),
  });

const FailureMode = z
  .object({
    dependency: z.string().min(1),
    failureMode: z.enum(["timeout", "5xx", "partial-failure", "inconsistent", "rate-limited"]),
    recovery: z.string().min(1).describe("e.g. 'retry+backoff', 'circuit breaker', 'fallback', 'fail-fast'"),
  });

const SystemDesignDocBody = z.object({
  boundedContexts: z.array(BoundedContext).min(1),
  componentContracts: z.array(ComponentContract).min(1),
  dataOwnership: z
    .array(z.object({ entity: z.string().min(1), ownerComponent: z.string().min(1) }))
    .min(1),
  scaling: z
    .array(
      z.object({
        component: z.string(),
        pattern: z.enum(["vertical", "horizontal", "shard", "read-replica", "cache"]),
        notes: z.string().optional(),
      })
    )
    .min(1),
  failureModes: z.array(FailureMode).min(1),
  consistencyWindows: z
    .array(z.object({ boundary: z.string(), observableStaleness: z.string() }))
    .default([])
    .describe("For every async/eventual edge — name the window users see"),
  outOfScope: z.array(z.string()).default([]),
});
export const SystemDesignDocSchema = withConfidence(SystemDesignDocBody);
export type SystemDesignDoc = z.infer<typeof SystemDesignDocSchema>;

// ── 11. CodeChangeSet (fullstack-eng) ──────────────────────────────────────

const FileChange = z
  .object({
    path: z.string().min(1),
    status: z.enum(["new", "modified", "deleted"]),
    reason: z.string().min(1).describe("One-line WHY"),
  });

const TestAddition = z
  .object({
    name: z.string().min(1),
    mapsToAcId: z.string().optional().describe("References a PRD AC id when applicable"),
    level: z.enum(["unit", "integration", "e2e"]),
  });

const CodeChangeSetBody = z.object({
  ticket: z.string().min(1).describe("Ticket id this change closes"),
  filesChanged: z.array(FileChange).min(1),
  testsAdded: z.array(TestAddition).min(1).describe("Bug fixes start with the failing test"),
  manualVerification: z.array(z.string()).default([]),
  notChanged: z.array(z.string()).default([]).describe("Adjacent things deliberately not touched"),
  deploymentNotes: z.string().optional().describe("Feature flag? Migration? Config change?"),
});
export const CodeChangeSetSchema = withConfidence(CodeChangeSetBody);
export type CodeChangeSet = z.infer<typeof CodeChangeSetSchema>;

// ── 12. DocumentationSet (tech-writer) ─────────────────────────────────────

const DocPage = z
  .object({
    title: z.string().min(1),
    diataxisType: z.enum(["tutorial", "how-to", "reference", "explanation"]),
    audience: z.string().min(1).describe("Named audience: role + prior knowledge + goal"),
    body: z.string().min(50).describe("Doc body"),
    codeSamplesVerified: z.boolean().describe("True only when samples were run from a fresh env"),
  });

const DocumentationSetBody = z.object({
  pages: z.array(DocPage).min(1),
  changelogEntry: z.string().optional(),
  migrationNotes: z.string().optional(),
});
export const DocumentationSetSchema = withConfidence(DocumentationSetBody);
export type DocumentationSet = z.infer<typeof DocumentationSetSchema>;

// ── Schema registry (used by agent-invoker) ────────────────────────────────

export interface ArtifactSchemaEntry {
  /** Friendly name as referenced by AgentDefinition.outputSchema */
  name: string;
  /** Zod schema with the confidence field already applied */
  schema: z.ZodTypeAny;
  /** Human-readable description embedded in the agent prompt */
  description: string;
  /** Maps to the F4 rubric */
  artifactType: ArtifactType;
}

const ENTRIES: ArtifactSchemaEntry[] = [
  {
    name: "ProjectCharter",
    schema: ProjectCharterSchema,
    artifactType: "project-charter",
    description:
      "Project Charter object. Required keys: vision (one sentence); inScope (≥3 strings); outOfScope (≥3 strings); stakeholders (objects with name/role/raci); successCriteria (objects with metric/target/window); milestones (objects with name/date/owner); risks (objects with description/probability/impact/mitigation/escalationTrigger); openQuestions (objects with question/owner/decisionBy); confidence ({level, reason}).",
  },
  {
    name: "ArchitectureBundle",
    schema: ArchitectureBundleSchema,
    artifactType: "adr",
    description:
      "ArchitectureBundle. Required: contextDiagram (text); containerDiagram (text); adrs (array of ADRs each with id/title/status/date/context/decision/alternatives≥2/consequencesPositive/consequencesNegative/reversibilityCost); irreversibleDecisions; notBuilding; confidence.",
  },
  {
    name: "PRD",
    schema: PRDSchema,
    artifactType: "prd",
    description:
      "PRD. Required: problem (USER PAIN, not solution); targetUser (named role + persona); jtbdStatement; inScope; nonGoals (≥1); acceptanceCriteria (objects with id/predicate/passCheck); successMetrics (with numeric targets and windows); openQuestions; confidence.",
  },
  {
    name: "DeliveryPlan",
    schema: DeliveryPlanSchema,
    artifactType: "delivery-plan",
    description:
      "DeliveryPlan. Required: phases (outcome milestones); criticalPath (array of named tasks); capacity (fteCount/focusHoursPerWeek/velocityNotes); raid (risks/assumptions/issues/dependencies); rolloutPlan (required for release-phase plans); confidence.",
  },
  {
    name: "ThreatModel",
    schema: ThreatModelSchema,
    artifactType: "threat-model",
    description:
      "ThreatModel. Required: dataFlow (text); trustBoundaries; dataClassification (per-tier lists); threats (each with id/stride/boundary/description/severity/impact/exploitability/mitigation/owner/targetPhase); residualRisks; confidence.",
  },
  {
    name: "SprintPlan",
    schema: SprintPlanSchema,
    artifactType: "sprint-plan",
    description:
      "SprintPlan. Required: sprintName; durationWeeks; stories (INVEST shape: id/story/acceptanceCriteria/estimateDays{low,high}/dependencies/designAttached); capacityCheck (estimateDaysSum/capacityDays/utilizationRatio); outOfSprint (≥1 deferral); risks; confidence.",
  },
  {
    name: "TestStrategy",
    schema: TestStrategySchema,
    artifactType: "test-strategy",
    description:
      "TestStrategy. Required: pyramid (3 levels with rationale); riskMatrix (per-feature with planned depth); environments; fixtureStrategy; manualScope; entryCriteria; exitCriteria; notTested; confidence.",
  },
  {
    name: "DesignSpec",
    schema: DesignSpecSchema,
    artifactType: "design-spec",
    description:
      "DesignSpec. Required: userFlows (each tied to a PRD acId, with steps); components (name/isNew/states (incl loading/error/empty)/props/accessibilityRole); tokensUsed (design tokens, not raw hex/px); accessibility (wcagLevel/contrastChecksPerformed/keyboardNavTested); confidence.",
  },
  {
    name: "DeploymentRunbook",
    schema: DeploymentRunbookSchema,
    artifactType: "deployment-runbook",
    description:
      "DeploymentRunbook. Required: preconditions; steps (numbered with copy-pasteable command + expectedOutput + verification); promotionCriteria per ring with numeric thresholds; autoRollbackTrigger (metric/threshold/window); manualRollbackSteps; irreversibleChanges; onCallOwner; confidence.",
  },
  {
    name: "SystemDesignDoc",
    schema: SystemDesignDocSchema,
    artifactType: "system-design",
    description:
      "SystemDesignDoc. Required: boundedContexts (with glossary + relationships); componentContracts (request/response/errors/idempotency/retry); dataOwnership; scaling (per-component pattern); failureModes (per-dep mode + recovery); consistencyWindows; confidence.",
  },
  {
    name: "CodeChangeSet",
    schema: CodeChangeSetSchema,
    artifactType: "code-change-set",
    description:
      "CodeChangeSet. Required: ticket; filesChanged (path/status/reason); testsAdded (mapped to PRD ACs where applicable); manualVerification; notChanged; deploymentNotes; confidence.",
  },
  {
    name: "DocumentationSet",
    schema: DocumentationSetSchema,
    artifactType: "documentation-set",
    description:
      "DocumentationSet. Required: pages (each with title/diataxisType/audience/body/codeSamplesVerified). Each page is exactly one Diataxis type. Audience names role + prior knowledge + goal. Includes confidence.",
  },
];

export const ARTIFACT_SCHEMAS: Map<string, ArtifactSchemaEntry> = new Map(
  ENTRIES.map((e) => [e.name, e])
);

/** Resolve the schema entry for an AgentDefinition.outputSchema string. */
export function getArtifactSchema(outputSchemaName: string): ArtifactSchemaEntry | undefined {
  return ARTIFACT_SCHEMAS.get(outputSchemaName);
}

/** True when every registered C1 outputSchema name has a matching entry. */
export function listArtifactSchemaNames(): string[] {
  return Array.from(ARTIFACT_SCHEMAS.keys());
}
