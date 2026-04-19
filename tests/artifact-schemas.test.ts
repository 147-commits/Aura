/**
 * Artifact-schema tests — Zod shape, confidence requirement, registry coverage.
 *
 * Run: npx tsx tests/artifact-schemas.test.ts
 */

import {
  ARTIFACT_SCHEMAS,
  getArtifactSchema,
  listArtifactSchemaNames,
  ProjectCharterSchema,
  PRDSchema,
  ArchitectureBundleSchema,
  DeliveryPlanSchema,
  ThreatModelSchema,
  SprintPlanSchema,
  TestStrategySchema,
  DesignSpecSchema,
  DeploymentRunbookSchema,
  SystemDesignDocSchema,
  CodeChangeSetSchema,
  DocumentationSetSchema,
} from "../server/orchestrator/artifact-schemas";
import { AGENT_REGISTRY } from "../server/agents/agent-registry";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

const validConfidence = { level: "High" as const, reason: "well documented and recent" };

async function main(): Promise<void> {
  console.log("\n=== artifact-schemas ===\n");

  // ─── Registry coverage matches C1 outputSchema names ──────────────────
  {
    const expected = [
      "ProjectCharter", "ArchitectureBundle", "PRD", "DeliveryPlan", "ThreatModel",
      "SprintPlan", "TestStrategy", "DesignSpec", "DeploymentRunbook",
      "SystemDesignDoc", "CodeChangeSet", "DocumentationSet",
    ].sort();
    const actual = listArtifactSchemaNames().sort();
    assert(JSON.stringify(actual) === JSON.stringify(expected),
      `12 schemas registered (got: ${actual.join(",")})`);

    // Cross-check: every PIPELINE agent's outputSchema is registered
    let allMapped = true;
    for (const [, agent] of AGENT_REGISTRY) {
      if (agent.layer === "advisor") continue;
      if (!getArtifactSchema(agent.outputSchema)) {
        console.error(`  ${agent.id} references unknown outputSchema "${agent.outputSchema}"`);
        allMapped = false;
      }
    }
    assert(allMapped, "every pipeline agent's outputSchema is in the registry");
  }

  // ─── Each entry has a non-empty description ───────────────────────────
  {
    for (const [name, entry] of ARTIFACT_SCHEMAS) {
      assert(entry.description.length > 80, `${name}: description ≥80 chars (got ${entry.description.length})`);
      assert(entry.artifactType.length > 0, `${name}: artifactType set`);
    }
  }

  // ─── Every schema rejects missing confidence ──────────────────────────
  {
    for (const [name, entry] of ARTIFACT_SCHEMAS) {
      // Empty object → at minimum confidence is missing
      const r = entry.schema.safeParse({});
      assert(!r.success, `${name}: rejects empty object (missing confidence + required fields)`);
    }
  }

  // ─── Sample valid PRD ─────────────────────────────────────────────────
  {
    const prd = {
      problem: "Solo founders ship weak PRDs",
      targetUser: "Solo technical founders, pre-seed",
      jtbdStatement: "When sketching an MVP, I want a structured PRD so I can talk to investors",
      inScope: ["Charter input", "PRD output"],
      nonGoals: ["Multi-user editing"],
      acceptanceCriteria: [{ id: "AC1", predicate: "PRD exports as PDF", passCheck: "open PDF, find sections" }],
      successMetrics: [{ metric: "first-bundle-time", target: "<48h", window: "first 30 days" }],
      openQuestions: [],
      confidence: validConfidence,
    };
    const r = PRDSchema.safeParse(prd);
    assert(r.success, `valid PRD parses (errors: ${r.success ? "" : JSON.stringify(r.error.issues)})`);
  }

  // ─── PRD without confidence is rejected ──────────────────────────────
  {
    const prd = {
      problem: "x", targetUser: "x", jtbdStatement: "x",
      inScope: ["x"], nonGoals: ["x"],
      acceptanceCriteria: [{ id: "AC1", predicate: "x", passCheck: "x" }],
      successMetrics: [{ metric: "x", target: "x", window: "x" }],
      openQuestions: [],
    };
    const r = PRDSchema.safeParse(prd);
    assert(!r.success, "PRD without confidence rejected");
  }

  // ─── Sample valid ProjectCharter ──────────────────────────────────────
  {
    const charter = {
      vision: "Ship investable MVPs in a weekend",
      inScope: ["Pipeline", "Bundle download", "Truth-First"],
      outOfScope: ["Mobile preview", "Multi-tenant sharing", "Export to GitHub"],
      stakeholders: [{ name: "Lithin", role: "CEO", raci: "A" as const }],
      successCriteria: [{ metric: "free-to-paid", target: ">5%", window: "60 days" }],
      milestones: [{ name: "v1 paid launch", date: "2026-06-10", owner: "Lithin" }],
      risks: [{
        description: "Quality below threshold",
        probability: "Medium" as const,
        impact: "High" as const,
        mitigation: "F4 eval gates ship",
        escalationTrigger: "<70% pass by 2026-05-27",
      }],
      openQuestions: [],
      confidence: validConfidence,
    };
    const r = ProjectCharterSchema.safeParse(charter);
    assert(r.success, `valid ProjectCharter parses (errors: ${r.success ? "" : JSON.stringify(r.error.issues)})`);
  }

  // ─── ProjectCharter rejects fewer than 3 inScope ─────────────────────
  {
    const charter = {
      vision: "x",
      inScope: ["only one"], // ← below min(3)
      outOfScope: ["a", "b", "c"],
      stakeholders: [{ name: "x", role: "x", raci: "A" as const }],
      successCriteria: [{ metric: "x", target: "x", window: "x" }],
      milestones: [{ name: "x", date: "x", owner: "x" }],
      risks: [{
        description: "x", probability: "Low" as const, impact: "Low" as const,
        mitigation: "x", escalationTrigger: "x",
      }],
      openQuestions: [],
      confidence: validConfidence,
    };
    const r = ProjectCharterSchema.safeParse(charter);
    assert(!r.success, "ProjectCharter rejects inScope length < 3");
  }

  // ─── ArchitectureBundle requires ≥2 alternatives per ADR ─────────────
  {
    const bundle = {
      contextDiagram: "system + actors",
      containerDiagram: "services + datastores",
      adrs: [{
        id: "ADR-1", title: "x", status: "accepted" as const, date: "2026-04-19",
        context: "x", decision: "x",
        alternatives: [{ option: "only one", pros: ["p"], cons: ["c"], rejectedBecause: "x" }],
        consequencesPositive: ["a"], consequencesNegative: ["b"],
        reversibilityCost: "high — 6 weeks",
      }],
      irreversibleDecisions: [], notBuilding: [],
      confidence: validConfidence,
    };
    const r = ArchitectureBundleSchema.safeParse(bundle);
    assert(!r.success, "ArchitectureBundle rejects ADR with only 1 alternative");
  }

  // ─── ThreatModel requires ≥1 threat ──────────────────────────────────
  {
    const tm = {
      dataFlow: "x", trustBoundaries: ["x"],
      dataClassification: { public: [], internal: [], confidential: [], restricted: [] },
      threats: [], // ← min(1)
      residualRisks: [],
      confidence: validConfidence,
    };
    const r = ThreatModelSchema.safeParse(tm);
    assert(!r.success, "ThreatModel rejects empty threats array");
  }

  // ─── DeploymentRunbook requires preconditions + steps ────────────────
  {
    const rb = {
      preconditions: ["CI green"],
      steps: [{ n: 1, command: "kubectl apply", expectedOutput: "deployed", verification: "rollout status ok" }],
      promotionCriteria: [{ ring: "canary", threshold: "<0.5% 5xx", observationWindow: "5m" }],
      autoRollbackTrigger: { metric: "5xx", threshold: "0.5%", window: "5m" },
      manualRollbackSteps: ["kubectl rollout undo"],
      irreversibleChanges: [],
      onCallOwner: "Lithin",
      confidence: validConfidence,
    };
    const r = DeploymentRunbookSchema.safeParse(rb);
    assert(r.success, `valid DeploymentRunbook parses (errors: ${r.success ? "" : JSON.stringify(r.error.issues)})`);
  }

  // ─── DesignSpec requires ≥1 user flow ────────────────────────────────
  {
    const ds = {
      userFlows: [],
      components: [{ name: "Button", isNew: true, states: ["default" as const] }],
      tokensUsed: ["color.text.primary"],
      accessibility: { wcagLevel: "AA" as const, contrastChecksPerformed: true, keyboardNavTested: true },
      outOfScope: [],
      confidence: validConfidence,
    };
    const r = DesignSpecSchema.safeParse(ds);
    assert(!r.success, "DesignSpec rejects empty userFlows array");
  }

  // ─── SprintPlan: capacityCheck shape ─────────────────────────────────
  {
    const sp = {
      sprintName: "S1",
      durationWeeks: 2,
      stories: [{
        id: "S-1", story: "As a user...",
        acceptanceCriteria: ["x"],
        estimateDays: { low: 1, high: 3 },
        dependencies: [], designAttached: false,
      }],
      capacityCheck: { estimateDaysSum: 3, capacityDays: 5, utilizationRatio: 0.6 },
      outOfSprint: ["nice-to-have feature"],
      risks: [],
      confidence: validConfidence,
    };
    const r = SprintPlanSchema.safeParse(sp);
    assert(r.success, `valid SprintPlan parses (errors: ${r.success ? "" : JSON.stringify(r.error.issues)})`);
  }

  // ─── TestStrategy requires ≥3 pyramid levels ─────────────────────────
  {
    const ts = {
      pyramid: [
        { level: "unit" as const, plannedCount: 100, rationale: "fast" },
        { level: "integration" as const, plannedCount: 20, rationale: "medium" },
        // missing e2e
      ],
      riskMatrix: [{ feature: "x", risk: "High" as const, plannedDepth: "unit+integration+e2e" as const }],
      environments: ["staging"],
      fixtureStrategy: "ephemeral DB",
      manualScope: [],
      entryCriteria: ["fixtures loaded"],
      exitCriteria: ["100% pass critical-path"],
      notTested: [],
      confidence: validConfidence,
    };
    const r = TestStrategySchema.safeParse(ts);
    assert(!r.success, "TestStrategy rejects fewer than 3 pyramid levels");
  }

  // ─── DeliveryPlan requires raid ──────────────────────────────────────
  {
    const dp = {
      phases: [{ name: "M1", date: "2026-05-01", owner: "Lithin" }],
      criticalPath: ["M1"],
      capacity: { fteCount: 1, focusHoursPerWeek: 25, velocityNotes: "solo" },
      raid: {
        risks: [{
          description: "x", probability: "Low" as const, impact: "Medium" as const,
          mitigation: "x", escalationTrigger: "x",
        }],
        assumptions: [{ statement: "x", invalidatedBy: "y" }],
        issues: [], dependencies: [],
      },
      confidence: validConfidence,
    };
    const r = DeliveryPlanSchema.safeParse(dp);
    assert(r.success, `valid DeliveryPlan parses (errors: ${r.success ? "" : JSON.stringify(r.error.issues)})`);
  }

  // ─── SystemDesignDoc requires ≥1 bounded context ─────────────────────
  {
    const r = SystemDesignDocSchema.safeParse({
      boundedContexts: [], componentContracts: [], dataOwnership: [],
      scaling: [], failureModes: [], consistencyWindows: [], outOfScope: [],
      confidence: validConfidence,
    });
    assert(!r.success, "SystemDesignDoc rejects empty boundedContexts");
  }

  // ─── CodeChangeSet requires ticket + files + tests ───────────────────
  {
    const ccs = {
      ticket: "TICKET-1",
      filesChanged: [{ path: "src/x.ts", status: "modified" as const, reason: "add field" }],
      testsAdded: [{ name: "x test", level: "unit" as const }],
      manualVerification: ["ran locally"],
      notChanged: [],
      confidence: validConfidence,
    };
    const r = CodeChangeSetSchema.safeParse(ccs);
    assert(r.success, `valid CodeChangeSet parses (errors: ${r.success ? "" : JSON.stringify(r.error.issues)})`);
  }

  // ─── DocumentationSet requires ≥1 page ───────────────────────────────
  {
    const r = DocumentationSetSchema.safeParse({ pages: [], confidence: validConfidence });
    assert(!r.success, "DocumentationSet rejects empty pages");
  }

  console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
