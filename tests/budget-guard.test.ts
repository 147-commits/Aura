/**
 * BudgetGuard unit tests — pure in-memory, no DB or API.
 *
 * Run: npx tsx tests/budget-guard.test.ts
 */

import {
  BudgetGuard,
  DEFAULT_BUDGET,
  estimateCallCost,
  type RunBudget,
} from "../server/orchestrator/budget-guard";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

async function main(): Promise<void> {
console.log("\n=== BudgetGuard ===\n");

// ─── Defaults ──────────────────────────────────────────────────────────────
assert(DEFAULT_BUDGET.maxCostUSD === 5.0, "default maxCostUSD = 5.00");
assert(DEFAULT_BUDGET.maxTokens === 500_000, "default maxTokens = 500000");
assert(DEFAULT_BUDGET.maxDurationSec === 900, "default maxDurationSec = 900");
assert(DEFAULT_BUDGET.maxAgentCalls === 50, "default maxAgentCalls = 50");

// ─── Fresh guard is within budget ──────────────────────────────────────────
{
  const g = new BudgetGuard("r1");
  const r = g.check();
  assert(r.withinBudget && !r.reason, "fresh guard: within budget, no reason");
  const rem = g.remaining();
  assert(rem.costUSD === 5.0 && rem.tokens === 500_000 && rem.calls === 50,
    "fresh guard: remaining equals full budget");
}

// ─── canAfford: tokens ─────────────────────────────────────────────────────
{
  const g = new BudgetGuard("r2", { ...DEFAULT_BUDGET, maxTokens: 1000 });
  assert(g.canAfford(500, "mini"), "canAfford(500) with 1000 cap");
  assert(!g.canAfford(1500, "mini"), "!canAfford(1500) with 1000 cap");
  g.record(900, 0);
  assert(!g.canAfford(200, "mini"), "!canAfford(200) when 900 already spent, cap 1000");
}

// ─── canAfford: cost ───────────────────────────────────────────────────────
{
  const g = new BudgetGuard("r3", { ...DEFAULT_BUDGET, maxCostUSD: 0.01 });
  // skill tier is 0.006 per 1k tokens — 2k tokens = $0.012, should fail
  assert(!g.canAfford(2000, "skill"), "!canAfford(2k, skill) under $0.01 cap");
  assert(g.canAfford(1000, "skill"), "canAfford(1k, skill) under $0.01 cap");
}

// ─── canAfford: call count ─────────────────────────────────────────────────
{
  const g = new BudgetGuard("r4", { ...DEFAULT_BUDGET, maxAgentCalls: 2 });
  assert(g.canAfford(100, "mini"), "call 1 affordable");
  g.record(100, 0.001);
  assert(g.canAfford(100, "mini"), "call 2 affordable");
  g.record(100, 0.001);
  assert(!g.canAfford(100, "mini"), "call 3 refused at call cap");
}

// ─── check(): cost breach ──────────────────────────────────────────────────
{
  const g = new BudgetGuard("r5", { ...DEFAULT_BUDGET, maxCostUSD: 1.0 });
  g.record(10_000, 1.5);
  const r = g.check();
  assert(!r.withinBudget && r.reason === "cost", "check(): cost breach reported");
}

// ─── check(): tokens breach ────────────────────────────────────────────────
{
  const g = new BudgetGuard("r6", { ...DEFAULT_BUDGET, maxTokens: 100 });
  g.record(150, 0.001);
  const r = g.check();
  assert(!r.withinBudget && r.reason === "tokens", "check(): tokens breach reported");
}

// ─── check(): calls breach ─────────────────────────────────────────────────
{
  const g = new BudgetGuard("r7", { ...DEFAULT_BUDGET, maxAgentCalls: 1 });
  g.record(10, 0.001);
  g.record(10, 0.001);  // over by design — record doesn't block
  const r = g.check();
  assert(!r.withinBudget && r.reason === "calls", "check(): calls breach reported");
}

// ─── check(): duration breach ──────────────────────────────────────────────
{
  // Duration is wall clock; simulate by constructing with a near-zero cap
  // and waiting a tick.
  const g = new BudgetGuard("r8", { ...DEFAULT_BUDGET, maxDurationSec: 0.01 });
  await new Promise((r) => setTimeout(r, 30));
  const r = g.check();
  assert(!r.withinBudget && r.reason === "duration", "check(): duration breach reported");
}

// ─── record(): rejects negative values ─────────────────────────────────────
{
  const g = new BudgetGuard("r9");
  let threw = false;
  try { g.record(-1, 0); } catch { threw = true; }
  assert(threw, "record(): throws on negative tokens");
  threw = false;
  try { g.record(0, -0.5); } catch { threw = true; }
  assert(threw, "record(): throws on negative cost");
}

// ─── remaining(): decreases as recorded ────────────────────────────────────
{
  const g = new BudgetGuard("r10", { ...DEFAULT_BUDGET, maxCostUSD: 1.0, maxTokens: 1000, maxAgentCalls: 5 });
  g.record(400, 0.30);
  const rem = g.remaining();
  assert(Math.abs(rem.costUSD - 0.70) < 1e-9, `remaining cost 0.70 after $0.30 spent (got ${rem.costUSD})`);
  assert(rem.tokens === 600, `remaining tokens 600 after 400 spent (got ${rem.tokens})`);
  assert(rem.calls === 4, `remaining calls 4 after 1 recorded (got ${rem.calls})`);
}

// ─── remaining(): clamped at zero on overspend ─────────────────────────────
{
  const g = new BudgetGuard("r11", { ...DEFAULT_BUDGET, maxCostUSD: 0.5, maxTokens: 100 });
  g.record(300, 2.0);
  const rem = g.remaining();
  assert(rem.costUSD === 0, "remaining cost clamped to 0 when overspent");
  assert(rem.tokens === 0, "remaining tokens clamped to 0 when overspent");
}

// ─── estimateCallCost pricing sanity ───────────────────────────────────────
{
  assert(estimateCallCost(1000, "mini") < estimateCallCost(1000, "standard"),
    "mini cheaper than standard per 1k tokens");
  assert(estimateCallCost(1000, "standard") < estimateCallCost(1000, "skill"),
    "standard cheaper than skill per 1k tokens");
  assert(estimateCallCost(1000, "skill") < estimateCallCost(1000, "frontier"),
    "skill cheaper than frontier per 1k tokens");
}

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
