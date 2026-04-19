/**
 * BudgetGuard — per-run safety cap across cost, tokens, wall time, and
 * agent-call count.
 *
 * The orchestrator instantiates one BudgetGuard per pipeline run and calls:
 *   - canAfford(tokens, tier) BEFORE each agent invocation
 *   - record(actualTokens, actualCostUSD) AFTER each invocation
 *   - check() at phase boundaries or on any suspicion of breach
 *
 * On breach the orchestrator pauses the run with status='paused-budget'.
 * Nothing in this file talks to the database — the guard is pure in-memory
 * state, instantiated per run, discarded when the run ends.
 */

import type { ModelTier } from "../../shared/agent-schema";

export interface RunBudget {
  /** Hard cap in USD for the whole run. */
  maxCostUSD: number;
  /** Hard cap on total input+output tokens. */
  maxTokens: number;
  /** Hard cap on wall-clock seconds from construction to now. */
  maxDurationSec: number;
  /** Hard cap on number of agent invocations (record() calls). */
  maxAgentCalls: number;
}

/** Safe defaults — 5 dollars, 500k tokens, 15 minutes, 50 calls. */
export const DEFAULT_BUDGET: RunBudget = {
  maxCostUSD: 5.0,
  maxTokens: 500_000,
  maxDurationSec: 900,
  maxAgentCalls: 50,
};

/**
 * Blended USD cost per 1k tokens (input+output estimate). Tuned to the
 * provider stack we route to today; update when prices change.
 */
const COST_PER_1K_BY_TIER: Record<ModelTier, number> = {
  mini: 0.00015,      // gpt-4o-mini
  standard: 0.005,    // gpt-4o
  skill: 0.006,       // Claude Sonnet (blended)
  frontier: 0.015,    // frontier tier (Claude Opus / GPT-4-class)
};

/** Estimate cost for a planned invocation (used by canAfford). */
export function estimateCallCost(tokens: number, tier: ModelTier): number {
  const rate = COST_PER_1K_BY_TIER[tier] ?? COST_PER_1K_BY_TIER.mini;
  return (tokens / 1_000) * rate;
}

export interface BudgetCheckResult {
  withinBudget: boolean;
  /** Reason code when withinBudget is false. */
  reason?: "cost" | "tokens" | "duration" | "calls";
}

export interface BudgetRemaining {
  costUSD: number;
  tokens: number;
  sec: number;
  calls: number;
}

export class BudgetGuard {
  readonly runId: string;
  readonly budget: RunBudget;

  private spentCostUSD = 0;
  private spentTokens = 0;
  private calls = 0;
  private readonly startedAt: number;

  constructor(runId: string, budget: RunBudget = DEFAULT_BUDGET) {
    this.runId = runId;
    this.budget = budget;
    this.startedAt = Date.now();
  }

  /**
   * True if the run can afford another call of `estimatedTokens` at `tier`.
   *
   * Uses conservative estimates — call cost based on tier, calls/duration
   * checked from current state, token budget checked against planned usage.
   */
  canAfford(estimatedTokens: number, tier: ModelTier): boolean {
    if (this.calls + 1 > this.budget.maxAgentCalls) return false;
    if (this.spentTokens + estimatedTokens > this.budget.maxTokens) return false;
    const estCost = estimateCallCost(estimatedTokens, tier);
    if (this.spentCostUSD + estCost > this.budget.maxCostUSD) return false;
    if (this.elapsedSec() >= this.budget.maxDurationSec) return false;
    return true;
  }

  /** Record what actually happened after the call returns. */
  record(actualTokens: number, actualCostUSD: number): void {
    if (actualTokens < 0 || actualCostUSD < 0) {
      throw new Error("BudgetGuard.record: negative values are not allowed");
    }
    this.spentTokens += actualTokens;
    this.spentCostUSD += actualCostUSD;
    this.calls += 1;
  }

  /**
   * Hard check — returns the first breach found, or {withinBudget:true}.
   * Check order: cost → tokens → duration → calls. Stable order helps
   * pause-reason reporting stay predictable.
   */
  check(): BudgetCheckResult {
    if (this.spentCostUSD > this.budget.maxCostUSD) {
      return { withinBudget: false, reason: "cost" };
    }
    if (this.spentTokens > this.budget.maxTokens) {
      return { withinBudget: false, reason: "tokens" };
    }
    if (this.elapsedSec() > this.budget.maxDurationSec) {
      return { withinBudget: false, reason: "duration" };
    }
    if (this.calls > this.budget.maxAgentCalls) {
      return { withinBudget: false, reason: "calls" };
    }
    return { withinBudget: true };
  }

  /** How much budget remains. Negative values are clamped to 0. */
  remaining(): BudgetRemaining {
    return {
      costUSD: Math.max(0, this.budget.maxCostUSD - this.spentCostUSD),
      tokens: Math.max(0, this.budget.maxTokens - this.spentTokens),
      sec: Math.max(0, this.budget.maxDurationSec - this.elapsedSec()),
      calls: Math.max(0, this.budget.maxAgentCalls - this.calls),
    };
  }

  /** Wall-clock seconds since construction. */
  private elapsedSec(): number {
    return (Date.now() - this.startedAt) / 1000;
  }
}
