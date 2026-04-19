/**
 * Run-tracer integration test — touches the real Postgres.
 *
 * Creates a throwaway user + run, exercises every tracer function, then
 * cleans up. Each test creates a fresh run id so parallel CI runs don't
 * collide.
 *
 * Run: npx tsx tests/run-tracer.test.ts
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";
import { initDatabase } from "../server/migration";
import {
  createRun,
  updateRunStatus,
  completeRun,
  getRun,
  listRuns,
  getRunCost,
  logStep,
  completeStep,
  getRunSteps,
  logArtifact,
  getRunArtifacts,
  setArtifactEval,
  logGateResult,
  logToolCall,
  logDecision,
  _deleteRunForTest,
} from "../server/orchestrator/run-tracer";
import { DEFAULT_BUDGET } from "../server/orchestrator/budget-guard";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

async function createTestUser(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    "INSERT INTO users (device_id, tier) VALUES ($1, 'free') RETURNING id",
    [`run-tracer-${randomUUID()}`]
  );
  return r.rows[0].id;
}

async function cleanupUser(userId: string): Promise<void> {
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL not set — run-tracer test requires Postgres");
    process.exit(0);
  }

  await initDatabase();

  console.log("\n=== run-tracer ===\n");

  // ─── createRun + getRun + listRuns ─────────────────────────────────────
  {
    const userId = await createTestUser();
    const orgId = null;
    const inputBrief = "Build a tiny todo app for a weekend hackathon.";
    try {
      const runId = await createRun({
        userId, orgId, deliveryOption: "weekend-sprint",
        budget: DEFAULT_BUDGET, inputBrief,
        promptVersionSet: { ceo: "1.0.0", cto: "1.0.0" },
      });
      assert(typeof runId === "string" && runId.length > 0, "createRun returns a UUID");

      const fetched = await getRun(runId);
      assert(fetched !== null, "getRun returns the row");
      assert(fetched?.userId === userId, "getRun: userId round-trip");
      assert(fetched?.status === "running", "getRun: status defaults to 'running'");
      assert(fetched?.deliveryOption === "weekend-sprint", "getRun: delivery option round-trip");
      assert(fetched?.inputBrief === inputBrief, "getRun: input brief decrypts back to plaintext");
      assert(fetched?.budget.maxCostUSD === DEFAULT_BUDGET.maxCostUSD, "getRun: budget JSON round-trip");
      assert(fetched?.promptVersionSet.ceo === "1.0.0", "getRun: prompt-version-set round-trip");

      const all = await listRuns(userId);
      assert(all.length === 1 && all[0].runId === runId, "listRuns returns the user's run");

      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── updateRunStatus + completeRun ─────────────────────────────────────
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({
        userId, budget: DEFAULT_BUDGET, inputBrief: "x",
      });
      await updateRunStatus(runId, "paused-budget", "budget exceeded");
      const r1 = await getRun(runId);
      assert(r1?.status === "paused-budget", "updateRunStatus → paused-budget");
      assert(r1?.errorMessage === "budget exceeded", "updateRunStatus: error message stored");

      await completeRun(runId, "completed", { costUSD: 1.23, tokens: 42_000 });
      const r2 = await getRun(runId);
      assert(r2?.status === "completed", "completeRun → completed");
      assert(r2?.totalCostUSD === 1.23, `completeRun: totalCostUSD = 1.23 (got ${r2?.totalCostUSD})`);
      assert(r2?.totalTokens === 42_000, `completeRun: totalTokens = 42000 (got ${r2?.totalTokens})`);
      assert(r2?.completedAt !== null, "completeRun: completed_at populated");

      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── logStep + completeStep + getRunSteps + getRunCost ─────────────────
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({ userId, budget: DEFAULT_BUDGET, inputBrief: "x" });

      const stepId1 = await logStep({
        runId, agentId: "ceo", stepIndex: 0, promptVersion: "1.0.0",
        inputPayload: { brief: "x" },
      });
      const stepId2 = await logStep({
        runId, agentId: "cpo", stepIndex: 1, promptVersion: "1.0.0",
      });

      await completeStep({
        stepId: stepId1, status: "completed",
        outputPayload: { charter: "ok" }, tokensIn: 1000, tokensOut: 500, costUSD: 0.05,
      });
      await completeStep({
        stepId: stepId2, status: "completed", tokensIn: 2000, tokensOut: 800, costUSD: 0.08,
      });

      const steps = await getRunSteps(runId);
      assert(steps.length === 2, `getRunSteps returns 2 (got ${steps.length})`);
      assert(steps[0].agentId === "ceo" && steps[0].stepIndex === 0, "step[0] = ceo @ index 0");
      assert(steps[1].agentId === "cpo", "step[1] = cpo");
      assert(steps[0].promptVersion === "1.0.0", "step[0] prompt_version round-trip");
      assert(steps[0].latencyMs !== null, "step[0] latency_ms populated by completeStep");

      const cost = await getRunCost(runId);
      assert(Math.abs(cost.costUSD - 0.13) < 1e-6, `cost.costUSD = 0.13 (got ${cost.costUSD})`);
      assert(cost.tokens === 4300, `cost.tokens = 4300 (got ${cost.tokens})`);
      assert(cost.calls === 2, `cost.calls = 2 (got ${cost.calls})`);

      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── logArtifact + getRunArtifacts (encrypted payload roundtrip) ───────
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({ userId, budget: DEFAULT_BUDGET, inputBrief: "x" });
      const stepId = await logStep({ runId, agentId: "cpo", stepIndex: 0, promptVersion: "1.0.0" });

      const payload = {
        problem: "Solo founders ship weak PRDs.",
        successMetrics: ["activation > 40%"],
      };
      const artifactId = await logArtifact({
        runId, stepId, artifactType: "prd",
        title: "Pipeline Gate PRD",
        payload,
        confidence: { level: "High", reason: "wedge interviews back this" },
      });

      await setArtifactEval(artifactId, {
        qualityScore: 0.84,
        rubricId: "prd-v1",
        evaluatorId: "openai:gpt-4o-mini",
      });

      const artifacts = await getRunArtifacts(runId);
      assert(artifacts.length === 1, `getRunArtifacts returns 1 (got ${artifacts.length})`);
      const got = artifacts[0];
      assert(got.id === artifactId, "artifact id round-trip");
      assert(got.artifactType === "prd", "artifact type round-trip");
      assert(got.title === "Pipeline Gate PRD", "artifact title round-trip");
      assert(JSON.stringify(got.payload) === JSON.stringify(payload), "artifact payload decrypts to original");
      assert(got.qualityScore === 0.84, "qualityScore set by setArtifactEval");
      assert(got.rubricId === "prd-v1", "rubricId set");
      assert(got.confidenceLevel === "High", "confidence level retained");
      assert(got.hasEmbedding === false, "no embedding yet (fills via embedder)");

      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── logGateResult ─────────────────────────────────────────────────────
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({ userId, budget: DEFAULT_BUDGET, inputBrief: "x" });
      const gateRowId = await logGateResult({
        runId,
        gateId: "G1",
        phase: "discovery",
        result: {
          passed: true,
          requiresHumanReview: false,
          confidence: { level: "High", reason: "all artifacts cleared threshold" },
          checks: [{ id: "c1", description: "x", passed: true, rationale: "ok" }],
        },
      });
      assert(typeof gateRowId === "string", "logGateResult returns id");
      const r = await pool.query("SELECT * FROM gate_results WHERE id = $1", [gateRowId]);
      assert(r.rows[0].gate_id === "G1", "gate_id stored");
      assert(r.rows[0].passed === true, "passed stored");
      assert(r.rows[0].confidence_level === "High", "confidence_level stored");
      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── logToolCall ───────────────────────────────────────────────────────
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({ userId, budget: DEFAULT_BUDGET, inputBrief: "x" });
      const toolId = await logToolCall({
        runId, agentId: "fullstack-eng", toolName: "shell",
        input: { cmd: "npm test" },
        output: { exitCode: 0 },
        durationMs: 1234, costUSD: 0,
      });
      const r = await pool.query("SELECT * FROM tool_calls WHERE id = $1", [toolId]);
      assert(r.rows[0].tool_name === "shell", "tool_name stored");
      assert(r.rows[0].input_encrypted !== null, "input encrypted");
      assert(r.rows[0].output_encrypted !== null, "output encrypted");
      assert(r.rows[0].duration_ms === 1234, "duration_ms stored");
      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── logDecision ───────────────────────────────────────────────────────
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({ userId, budget: DEFAULT_BUDGET, inputBrief: "x" });
      await logDecision(runId, {
        question: "Which agents to activate for Discovery?",
        decision: "ceo + cpo",
        reasoning: "Wedge spec is explicit; both are needed.",
        confidence: { level: "High", reason: "spec is explicit and recent" },
        reversible: true,
      });
      const r = await pool.query("SELECT * FROM agent_decisions WHERE run_id = $1", [runId]);
      assert(r.rows.length === 1, "agent_decision row inserted");
      assert(r.rows[0].confidence_level === "High", "confidence_level stored");
      assert(r.rows[0].is_encrypted === true, "is_encrypted = true");
      assert(r.rows[0].question_encrypted !== null && r.rows[0].question_encrypted !== "Which agents to activate for Discovery?", "question_encrypted is not plaintext");
      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("run-tracer test crashed:", err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
