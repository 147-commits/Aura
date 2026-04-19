/**
 * Agent invoker test — uses a mock AIProvider so no API call is made.
 *
 * Asserts:
 *   - Budget pre-check aborts with BudgetExceededError before any provider call
 *   - Happy path: parses valid JSON, persists artifact, marks step completed
 *   - Retry path: invalid JSON on attempt 1, valid JSON on attempt 2
 *   - SchemaValidationError thrown when both attempts fail
 *   - Cost recorded on the budget AFTER a successful call
 *
 * Run: npx tsx tests/agent-invoker.test.ts
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";
import { initDatabase } from "../server/migration";
import { ceo as ceoAgent } from "../server/agents/pipeline/ceo";
import { BudgetGuard, DEFAULT_BUDGET } from "../server/orchestrator/budget-guard";
import {
  invokeAgent,
  BudgetExceededError,
  SchemaValidationError,
} from "../server/orchestrator/agent-invoker";
import { createRun, getRunArtifacts, getRunSteps, _deleteRunForTest } from "../server/orchestrator/run-tracer";
import type { AIProvider, ChatChunk, ChatParams, ChatResponse } from "../server/providers/ai-provider-interface";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

// ── Mock provider ──────────────────────────────────────────────────────────

type MockResponse = { content: string } | { error: Error };

class MockProvider implements AIProvider {
  readonly id = "mock";
  readonly name = "Mock";
  callLog: ChatParams[] = [];
  private queue: MockResponse[];

  constructor(responses: MockResponse[]) {
    this.queue = [...responses];
  }
  async chat(params: ChatParams): Promise<ChatResponse> {
    this.callLog.push(params);
    const next = this.queue.shift();
    if (!next) throw new Error("MockProvider: no more queued responses");
    if ("error" in next) throw next.error;
    return {
      content: next.content,
      model: params.model,
      usage: { inputTokens: 1000, outputTokens: 500 },
    };
  }
  async *stream(_params: ChatParams): AsyncIterable<ChatChunk> { /* not used */ }
  async embed(_text: string): Promise<number[]> { return []; }
  countTokens(text: string): number { return Math.ceil(text.length / 4); }
}

// ── Sample valid CEO output (used in happy-path test) ──────────────────────

const validCharterJSON = JSON.stringify({
  vision: "Ship investable MVPs in a weekend, every weekend.",
  inScope: ["Pipeline", "Bundle download", "Truth-First Engine"],
  outOfScope: ["Mobile preview", "Multi-tenant sharing", "Native mobile app"],
  stakeholders: [{ name: "Lithin", role: "CEO", raci: "A" }],
  successCriteria: [{ metric: "first-bundle-time", target: "<48h", window: "first 30 days" }],
  milestones: [{ name: "v1 paid launch", date: "2026-06-10", owner: "Lithin", acceptanceSignal: "first paid signup" }],
  risks: [{
    description: "Quality below threshold",
    probability: "Medium",
    impact: "High",
    mitigation: "F4 eval gates ship",
    escalationTrigger: "<70% pass by 2026-05-27",
  }],
  openQuestions: [],
  confidence: { level: "High", reason: "wedge spec is explicit and tested" },
});

async function createTestUser(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    "INSERT INTO users (device_id, tier) VALUES ($1, 'free') RETURNING id",
    [`agent-invoker-${randomUUID()}`]
  );
  return r.rows[0].id;
}
async function cleanupUser(userId: string): Promise<void> {
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL not set — agent-invoker test requires Postgres");
    process.exit(0);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.log("SKIP: OPENAI_API_KEY not set — F4 evaluator (run inside invokeAgent) needs it");
    process.exit(0);
  }
  await initDatabase();

  console.log("\n=== agent-invoker ===\n");

  // ─── 1. Budget pre-check aborts with BudgetExceededError ──────────────
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({ userId, budget: DEFAULT_BUDGET, inputBrief: "x" });
      // Tiny budget that can't possibly afford a 5000-token CEO call
      const tinyBudget = new BudgetGuard(runId, { ...DEFAULT_BUDGET, maxAgentCalls: 0 });
      const provider = new MockProvider([]); // never used
      let threw: Error | null = null;
      try {
        await invokeAgent({
          agent: ceoAgent, runId, stepIndex: 0, input: { brief: "x" },
          provider, budget: tinyBudget,
          retrievalQueryText: "", // skip embedding
        });
      } catch (e) {
        threw = e as Error;
      }
      assert(threw !== null, "budget breach throws");
      assert(threw instanceof BudgetExceededError, `error is BudgetExceededError (got ${threw?.constructor.name})`);
      assert(provider.callLog.length === 0, "no provider call attempted on budget breach");
      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── 2. Happy path — valid JSON, artifact persisted, step completed ───
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({ userId, budget: DEFAULT_BUDGET, inputBrief: "x" });
      const budget = new BudgetGuard(runId, DEFAULT_BUDGET);
      const provider = new MockProvider([{ content: validCharterJSON }]);

      const result = await invokeAgent({
        agent: ceoAgent, runId, stepIndex: 0,
        input: { brief: "Build a small SaaS for solo founders" },
        provider, budget,
        retrievalQueryText: "",
      });

      assert(result.attempts === 1, `attempts=1 on first-try success (got ${result.attempts})`);
      assert(typeof result.artifactId === "string" && result.artifactId.length > 0, "artifactId returned");
      assert(typeof result.stepId === "string" && result.stepId.length > 0, "stepId returned");
      assert(result.tokensUsed === 1500, `tokensUsed = 1500 (got ${result.tokensUsed})`);
      assert(result.costUSD > 0, `costUSD recorded > 0 (got ${result.costUSD})`);
      assert(typeof result.evaluation.overallScore === "number", "evaluation present");

      // Budget recorded the cost
      const remaining = budget.remaining();
      assert(remaining.costUSD < DEFAULT_BUDGET.maxCostUSD, "budget remaining cost decreased");
      assert(remaining.calls === DEFAULT_BUDGET.maxAgentCalls - 1, `remaining calls = ${DEFAULT_BUDGET.maxAgentCalls - 1}`);

      // Step persisted
      const steps = await getRunSteps(runId);
      assert(steps.length === 1 && steps[0].agentId === "ceo", "step persisted");
      assert(steps[0].status === "completed", `step status = completed (got ${steps[0].status})`);
      assert(steps[0].promptVersion === ceoAgent.promptVersion, "step prompt_version stamped");

      // Artifact persisted
      const artifacts = await getRunArtifacts(runId);
      assert(artifacts.length === 1, "artifact persisted");
      assert(artifacts[0].artifactType === "project-charter", "artifact_type = project-charter");
      assert(artifacts[0].confidenceLevel === "High", "confidence level captured");
      assert(artifacts[0].qualityScore !== null, "qualityScore set by evaluator");
      assert(artifacts[0].rubricId === "project-charter-v1", "rubricId stored");

      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── 3. Retry path — invalid then valid ───────────────────────────────
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({ userId, budget: DEFAULT_BUDGET, inputBrief: "x" });
      const budget = new BudgetGuard(runId, DEFAULT_BUDGET);
      const provider = new MockProvider([
        { content: "I'm sorry, I can't return JSON right now." },
        { content: validCharterJSON },
      ]);

      const result = await invokeAgent({
        agent: ceoAgent, runId, stepIndex: 0,
        input: { brief: "x" },
        provider, budget,
        retrievalQueryText: "",
      });

      assert(result.attempts === 2, `attempts=2 after one retry (got ${result.attempts})`);
      assert(provider.callLog.length === 2, "provider called twice");
      // The retry user message must mention the validation error
      const retryUser = provider.callLog[1].messages[1].content as string;
      assert(retryUser.includes("failed schema validation"),
        "retry user message includes failure feedback");

      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── 4. SchemaValidationError after both attempts fail ────────────────
  {
    const userId = await createTestUser();
    try {
      const runId = await createRun({ userId, budget: DEFAULT_BUDGET, inputBrief: "x" });
      const budget = new BudgetGuard(runId, DEFAULT_BUDGET);
      const provider = new MockProvider([
        { content: "no json here" },
        { content: "still no json" },
      ]);
      let threw: Error | null = null;
      try {
        await invokeAgent({
          agent: ceoAgent, runId, stepIndex: 0,
          input: { brief: "x" },
          provider, budget,
          retrievalQueryText: "",
        });
      } catch (e) {
        threw = e as Error;
      }
      assert(threw instanceof SchemaValidationError,
        `SchemaValidationError thrown (got ${threw?.constructor.name})`);
      assert(provider.callLog.length === 2, "provider called twice on retry path");

      // Step marked failed
      const steps = await getRunSteps(runId);
      assert(steps.length === 1 && steps[0].status === "failed", "step marked failed after both attempts fail");

      await _deleteRunForTest(runId);
    } finally {
      await cleanupUser(userId);
    }
  }

  console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("agent-invoker test crashed:", err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
