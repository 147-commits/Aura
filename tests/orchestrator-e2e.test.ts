/**
 * Orchestrator end-to-end test — mock invokeAgent + evaluateGate.
 *
 * Asserts:
 *   - Happy path: 5 phases progress, events emitted in order, run record
 *     reaches status="completed" with non-zero cost + token totals.
 *   - All-agents-fail in a phase → pipeline_error + status="failed".
 *   - Gate failure pauses with status="paused-gate".
 *   - Concurrency: free-tier user can't start a 2nd run while one is in flight.
 *   - Concurrency slot is released in the finally branch.
 *
 * Run: npx tsx tests/orchestrator-e2e.test.ts
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";
import { initDatabase } from "../server/migration";
import {
  runPipeline,
  PIPELINE_PHASES,
  type PipelineEvent,
  type PipelineDeps,
} from "../server/orchestrator/pipeline-engine";
import { acquireRunSlot, inspectRunSlots } from "../server/orchestrator/concurrency-guard";
import { getRun, getRunArtifacts, _deleteRunForTest } from "../server/orchestrator/run-tracer";
import { getArtifactSchema } from "../server/orchestrator/artifact-schemas";
import { getAgentsForPhase } from "../server/agents/agent-registry";
import { DEFAULT_BUDGET } from "../server/orchestrator/budget-guard";
import type { InvokeAgentResult } from "../server/orchestrator/agent-invoker";
import type { GateResult } from "../server/truth-first/artifact-schema";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

async function createTestUser(tier: "free" | "paid" = "free"): Promise<string> {
  const r = await pool.query<{ id: string }>(
    "INSERT INTO users (device_id, tier) VALUES ($1, $2) RETURNING id",
    [`orch-e2e-${randomUUID()}`, tier]
  );
  return r.rows[0].id;
}

async function cleanupUser(userId: string): Promise<void> {
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

// ── Mock factories ─────────────────────────────────────────────────────────

function buildSyntheticArtifact(agentId: string, outputSchemaName: string): unknown {
  // Each agent's output schema requires different fields. We craft enough
  // shape for the registry's metadata; the e2e test mocks invokeAgent so
  // we never actually validate against Zod here.
  return {
    __synthetic: true,
    agentId,
    outputSchema: outputSchemaName,
    confidence: { level: "High", reason: "synthetic test artifact" },
  };
}

function buildMockInvokeAgent(opts?: {
  failAgentIds?: Set<string>;
  perCallCostUSD?: number;
  perCallTokens?: number;
}): PipelineDeps["invokeAgent"] {
  return async (input) => {
    if (opts?.failAgentIds?.has(input.agent.id)) {
      throw new Error(`mock: ${input.agent.id} failed deliberately`);
    }
    const schemaEntry = getArtifactSchema(input.agent.outputSchema);
    if (!schemaEntry) throw new Error(`unknown outputSchema: ${input.agent.outputSchema}`);
    const tokens = opts?.perCallTokens ?? 100;
    const cost = opts?.perCallCostUSD ?? 0.01;
    input.budget.record(tokens, cost);
    const fakeArtifactId = randomUUID();
    const fakeStepId = randomUUID();
    const result: InvokeAgentResult = {
      artifact: buildSyntheticArtifact(input.agent.id, input.agent.outputSchema),
      artifactId: fakeArtifactId,
      stepId: fakeStepId,
      evaluation: {
        rubricId: schemaEntry.artifactType + "-v1",
        artifactId: fakeArtifactId,
        overallScore: 0.85,
        criterionScores: [],
        evaluatedBy: "mock:test",
        evaluatedAt: new Date().toISOString(),
        confidence: "High",
      },
      tokensUsed: tokens,
      costUSD: cost,
      attempts: 1,
    };
    return result;
  };
}

function buildMockEvaluateGate(opts?: {
  failGateIds?: Set<string>;
}): PipelineDeps["evaluateGate"] {
  return async (input) => {
    const failed = opts?.failGateIds?.has(input.gateId) ?? false;
    const checks = input.artifacts.map((a) => ({
      id: `mock:${a.artifactId}`,
      description: `mock check for ${a.artifactType}`,
      passed: !failed,
      rationale: failed ? "mock: forced failure" : "mock: pass",
    }));
    if (checks.length === 0) {
      checks.push({
        id: `mock:no-artifacts`,
        description: `mock check (empty artifact set)`,
        passed: !failed,
        rationale: failed ? "mock: forced failure" : "mock: pass",
      });
    }
    const result: GateResult = {
      passed: !failed,
      requiresHumanReview: failed,
      confidence: failed
        ? { level: "Low", reason: "mock gate forced to fail" }
        : { level: "High", reason: "mock gate passed" },
      checks,
    };
    return result;
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL not set — orchestrator e2e test requires Postgres");
    process.exit(0);
  }
  await initDatabase();

  console.log("\n=== orchestrator-e2e ===\n");

  // ─── PHASE_ORDER sanity ────────────────────────────────────────────────
  assert(
    JSON.stringify(PIPELINE_PHASES) ===
      JSON.stringify(["discovery", "design", "planning", "implementation", "verification"]),
    "PIPELINE_PHASES = A..E (no release/gtm in v1)"
  );

  // ─── HAPPY PATH ────────────────────────────────────────────────────────
  {
    const userId = await createTestUser();
    try {
      const events: PipelineEvent[] = [];
      const result = await runPipeline({
        userId, brief: "Build a tiny todo tracker for solo founders.",
        deliveryOption: "weekend-sprint",
        deps: {
          invokeAgent: buildMockInvokeAgent({ perCallCostUSD: 0.05, perCallTokens: 1500 }),
          evaluateGate: buildMockEvaluateGate(),
        },
        emit: (e) => events.push(e),
      });

      assert(result.status === "completed", `happy: status=completed (got ${result.status})`);
      assert(result.totalCostUSD > 0, `happy: totalCostUSD > 0 (got ${result.totalCostUSD})`);
      assert(result.totalTokens > 0, `happy: totalTokens > 0 (got ${result.totalTokens})`);
      assert(result.durationMs >= 0, `happy: durationMs ≥ 0 (got ${result.durationMs})`);

      // Event ordering
      const types = events.map((e) => e.type);
      assert(types[0] === "pipeline_start", `first event is pipeline_start (got ${types[0]})`);
      assert(types[types.length - 1] === "pipeline_complete",
        `last event is pipeline_complete (got ${types[types.length - 1]})`);

      // Each phase appears in order with phase_start AND phase_complete (or skipped if no eligible agents)
      let lastPhaseIdx = -1;
      for (const e of events) {
        if (e.type === "phase_start") {
          const idx = PIPELINE_PHASES.indexOf(e.phase);
          assert(idx > lastPhaseIdx, `phase_start ${e.phase} comes after prior phase`);
          lastPhaseIdx = idx;
        }
      }
      // Every phase that started should have completed.
      const startedPhases = events.filter((e) => e.type === "phase_start").map((e) => (e as any).phase);
      const completedPhases = events.filter((e) => e.type === "phase_complete").map((e) => (e as any).phase);
      assert(startedPhases.length === completedPhases.length,
        `every phase_start has a phase_complete (start=${startedPhases.length}, complete=${completedPhases.length})`);

      // Artifact_produced count = sum of agents activated across phases
      // For a non-security brief, CISO is filtered out.
      let expectedArtifacts = 0;
      for (const phase of PIPELINE_PHASES) {
        const agents = getAgentsForPhase(phase).filter((a) => a.id !== "ciso");
        expectedArtifacts += agents.length;
      }
      const artifactProduced = events.filter((e) => e.type === "artifact_produced").length;
      assert(artifactProduced === expectedArtifacts,
        `artifact_produced count = ${expectedArtifacts} (got ${artifactProduced})`);

      // DB persistence
      const persisted = await getRun(result.runId);
      assert(persisted?.status === "completed", "run row status=completed");
      assert(persisted!.totalCostUSD > 0, "run row totals.cost > 0");
      assert(persisted!.totalTokens > 0, "run row totals.tokens > 0");
      assert(persisted!.completedAt !== null, "run row completed_at set");

      // Concurrency slot freed after the run
      const slots = await inspectRunSlots(userId);
      assert(slots.currentRuns === 0, `concurrency slot released (currentRuns=${slots.currentRuns})`);

      await _deleteRunForTest(result.runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── ALL AGENTS FAIL IN A PHASE → pipeline_error ──────────────────────
  {
    const userId = await createTestUser();
    try {
      // Fail every discovery-phase agent → phase aborts → pipeline_error.
      const failIds = new Set(getAgentsForPhase("discovery").map((a) => a.id));
      const events: PipelineEvent[] = [];
      let threw: Error | null = null;
      try {
        await runPipeline({
          userId, brief: "Build something",
          deps: {
            invokeAgent: buildMockInvokeAgent({ failAgentIds: failIds }),
            evaluateGate: buildMockEvaluateGate(),
          },
          emit: (e) => events.push(e),
        });
      } catch (err) {
        threw = err as Error;
      }
      // Implementation choice: pipeline_error is emitted then the function
      // returns (it does not throw). Verify via emitted events instead.
      const errorEvents = events.filter((e) => e.type === "pipeline_error");
      assert(errorEvents.length === 1, `single pipeline_error emitted (got ${errorEvents.length})`);
      assert(threw === null, "all-agents-fail returns gracefully (does not throw out of runPipeline)");

      // Find the runId from the pipeline_start event so we can verify DB state.
      const start = events.find((e) => e.type === "pipeline_start") as { runId: string } | undefined;
      assert(start !== undefined, "pipeline_start event captured the runId");
      const dbRow = await getRun(start!.runId);
      assert(dbRow?.status === "failed", `run row status=failed (got ${dbRow?.status})`);

      // Slot released
      const slots = await inspectRunSlots(userId);
      assert(slots.currentRuns === 0, "slot released after failure");

      if (start) await _deleteRunForTest(start.runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── GATE FAILURE → paused-gate ────────────────────────────────────────
  {
    const userId = await createTestUser();
    try {
      const events: PipelineEvent[] = [];
      const result = await runPipeline({
        userId, brief: "Build a todo app",
        deps: {
          invokeAgent: buildMockInvokeAgent(),
          // Fail the discovery gate so we don't even reach design.
          evaluateGate: buildMockEvaluateGate({ failGateIds: new Set(["G1"]) }),
        },
        emit: (e) => events.push(e),
      });
      assert(result.status === "paused-gate", `gate fail: status=paused-gate (got ${result.status})`);
      assert(result.pausedAtPhase === "discovery",
        `gate fail: pausedAtPhase=discovery (got ${result.pausedAtPhase})`);

      const gateFailedEvent = events.find((e) => e.type === "gate_failed");
      assert(gateFailedEvent !== undefined, "gate_failed event emitted");

      // No phase_complete should fire after gate failure
      assert(events.every((e) => e.type !== "pipeline_complete"),
        "no pipeline_complete after gate failure");

      const dbRow = await getRun(result.runId);
      assert(dbRow?.status === "paused-gate", `run row status=paused-gate (got ${dbRow?.status})`);

      const slots = await inspectRunSlots(userId);
      assert(slots.currentRuns === 0, "slot released after gate failure");

      await _deleteRunForTest(result.runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── CONCURRENCY: free user 2nd-run is rejected ───────────────────────
  // The pipeline uses the real concurrencyGuard — we acquire a slot
  // outside the pipeline (simulating an in-flight run) then verify a
  // pipeline call throws ConcurrencyExceededError before any work happens.
  {
    const userId = await createTestUser("free");
    const heldRunId = randomUUID();
    try {
      // Manually grab the user's only free-tier slot
      const held = await acquireRunSlot(userId, null, heldRunId);
      assert(held.acquired, "preflight: slot acquired for the held run");

      // Now try to start a pipeline; should reject before doing anything.
      let threw: Error | null = null;
      const events: PipelineEvent[] = [];
      try {
        await runPipeline({
          userId, brief: "Build me a todo",
          deps: {
            invokeAgent: buildMockInvokeAgent(),
            evaluateGate: buildMockEvaluateGate(),
          },
          emit: (e) => events.push(e),
        });
      } catch (e) {
        threw = e as Error;
      }
      assert(threw !== null, "concurrency: 2nd run throws");
      assert(threw?.name === "ConcurrencyExceededError",
        `concurrency: error type ConcurrencyExceededError (got ${threw?.name})`);
      assert(events.length === 0,
        `concurrency: no SSE events emitted before rejection (got ${events.length})`);
    } finally {
      // Release the held slot + cleanup.
      await pool.query("DELETE FROM active_runs WHERE run_id = $1", [heldRunId]).catch(() => {});
      await cleanupUser(userId);
    }
  }

  console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("orchestrator-e2e crashed:", err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
