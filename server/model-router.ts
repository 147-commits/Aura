import type { ChatMode } from "./truth-engine";
import type { AgentDomain } from "../shared/agent-schema";
import type { ModelId } from "./ai-provider";
import { trackTokenUsage } from "./middleware";

/**
 * Model Router — routes queries to the cheapest capable model and provider.
 *
 * Provider strategy (hybrid):
 *   - Claude Sonnet → skill responses (less hallucination, better structured prompts)
 *   - GPT-4o-mini   → routing, classification, background tasks (cheap, fast)
 *   - GPT-4o        → research, complex non-skill queries
 *
 * Cost targets at $9.99/month subscription:
 *   - ~$3.60/month per active user (skill responses via Claude)
 *   - ~$0.30/month per active user (routing + background via mini)
 *   - Target: 60%+ gross margins
 */

export type ModelTier = "mini" | "standard" | "skill";
export type ModelSelectionReason =
  | "domain-skill-active"
  | "domain-skill-chained"
  | "mode-based"
  | "triage"
  | "background";

export interface ModelConfig {
  model: string;
  modelId: ModelId;
  maxTokens: number;
  tier: ModelTier;
  reason: ModelSelectionReason;
  estimatedCost: number;
}

export interface SkillModelOptions {
  activeSkillDomain?: AgentDomain;
  isChained?: boolean;
  isTriage?: boolean;
}

// ── Cost Constants ──────────────────────────────────────────────────────────
/** Cost per 1K tokens (blended input+output estimate) */
const COST_PER_1K: Record<ModelTier, number> = {
  mini: 0.00015,      // GPT-4o-mini
  standard: 0.005,    // GPT-4o
  skill: 0.006,       // Claude Sonnet (blended)
};
/** Default estimated tokens per request (prompt + response) */
const DEFAULT_REQUEST_TOKENS = 2000;
/** Monthly cost warning threshold per user (USD) */
const MONTHLY_COST_WARN_THRESHOLD = 50;

/** Maps tier to the provider model ID used by ai-provider.ts */
const TIER_TO_MODEL: Record<ModelTier, { modelId: ModelId; model: string; maxTokens: number }> = {
  mini: { modelId: "gpt-4o-mini", model: "gpt-4o-mini", maxTokens: 4096 },
  standard: { modelId: "gpt-4o", model: "gpt-4o", maxTokens: 4096 },
  skill: { modelId: "claude-sonnet", model: "claude-sonnet-4-20250514", maxTokens: 4096 },
};

// ── Monthly Cost Tracking ───────────────────────────────────────────────────
const monthlyCosts = new Map<string, { cost: number; month: string }>();

/** Track estimated cost and warn if projected monthly spend exceeds threshold */
function checkMonthlyCostGuard(userId: string, estimatedCost: number): void {
  const month = new Date().toISOString().slice(0, 7); // "2026-03"
  const key = `monthly:${userId}`;
  let entry = monthlyCosts.get(key);

  if (!entry || entry.month !== month) {
    entry = { cost: 0, month };
    monthlyCosts.set(key, entry);
  }

  entry.cost += estimatedCost;

  if (entry.cost > MONTHLY_COST_WARN_THRESHOLD) {
    console.warn(
      `[cost-guard] User ${userId} projected monthly cost: $${entry.cost.toFixed(2)} ` +
      `(exceeds $${MONTHLY_COST_WARN_THRESHOLD} threshold)`
    );
  }
}

/** Estimate USD cost for a given model tier and token count */
function estimateCost(tier: ModelTier, tokens: number = DEFAULT_REQUEST_TOKENS): number {
  return (tokens / 1000) * COST_PER_1K[tier];
}

/** Build a ModelConfig with cost estimate and provider model mapping */
function buildConfig(tier: ModelTier, reason: ModelSelectionReason): ModelConfig {
  const entry = TIER_TO_MODEL[tier];
  return {
    model: entry.model,
    modelId: entry.modelId,
    maxTokens: entry.maxTokens,
    tier,
    reason,
    estimatedCost: estimateCost(tier),
  };
}

/**
 * Select the appropriate model based on chat mode, message complexity, and active skills.
 *
 * Priority order:
 *   1. Triage mode → gpt-4o-mini (short structured responses, cost-efficient)
 *   2. Chained skills → Claude Sonnet (multi-domain needs best structured reasoning)
 *   3. Active domain skill → Claude Sonnet (less hallucination on framework-based prompts)
 *   4. Mode-based → existing logic (research/decision → gpt-4o, else complexity check)
 */
export function selectModel(
  mode: ChatMode,
  message: string,
  options?: SkillModelOptions
): ModelConfig {
  // Triage mode: always mini — short, structured, cost-efficient
  if (options?.isTriage) {
    return buildConfig("mini", "triage");
  }

  // Chained skills (primary + secondary): Claude for best structured reasoning
  if (options?.isChained) {
    return buildConfig("skill", "domain-skill-chained");
  }

  // Active domain skill: Claude for less hallucination on framework-based responses
  if (options?.activeSkillDomain) {
    return buildConfig("skill", "domain-skill-active");
  }

  // Existing mode-based logic (no behavior change)
  if (mode === "research" || mode === "decision") {
    return buildConfig("standard", "mode-based");
  }

  const complexity = estimateComplexity(message);
  if (complexity === "high") {
    return buildConfig("standard", "mode-based");
  }

  return buildConfig("mini", "mode-based");
}

/**
 * Get the model for background/internal tasks (memory extraction, action detection, etc.)
 * These always use the cheapest model since they're not user-facing.
 */
export function getBackgroundModel(): string {
  return TIER_TO_MODEL.mini.model;
}

/**
 * Simple heuristic to classify message complexity.
 * This avoids an extra API call for classification.
 *
 * High complexity indicators:
 * - Long messages (likely detailed questions)
 * - Multiple questions (contains ?)
 * - Technical vocabulary
 * - Explicit requests for depth
 */
function estimateComplexity(message: string): "low" | "high" {
  const lower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;
  const questionMarks = (message.match(/\?/g) || []).length;

  // Short casual messages → low complexity
  if (wordCount <= 10 && questionMarks <= 1) {
    return "low";
  }

  // Explicit depth requests
  const depthSignals = [
    "explain in detail", "deep dive", "thorough", "comprehensive",
    "analyze", "compare and contrast", "pros and cons",
    "step by step", "break down", "go deeper",
    "what are the implications", "trade-offs",
  ];

  if (depthSignals.some((signal) => lower.includes(signal))) {
    return "high";
  }

  // Technical vocabulary density
  const techTerms = [
    "algorithm", "architecture", "database", "api", "framework",
    "deploy", "infrastructure", "encryption", "authentication",
    "compliance", "regulation", "investment", "valuation",
    "strategy", "methodology", "hypothesis", "statistical",
  ];

  const techCount = techTerms.filter((term) => lower.includes(term)).length;
  if (techCount >= 2) {
    return "high";
  }

  // Multiple questions suggest complexity
  if (questionMarks >= 3) {
    return "high";
  }

  // Long messages suggest complexity
  if (wordCount > 80) {
    return "high";
  }

  return "low";
}

/**
 * Estimate token usage from a response for budget tracking.
 * Rough estimate: 1 token ≈ 4 characters for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Track usage after a completion and return whether user is within budget.
 * Also checks monthly cost guard for the model tier used.
 */
export function trackCompletion(
  userId: string,
  promptText: string,
  responseText: string,
  tier: ModelTier = "mini"
): boolean {
  const estimatedTokens = estimateTokens(promptText) + estimateTokens(responseText);
  const cost = estimateCost(tier, estimatedTokens);
  checkMonthlyCostGuard(userId, cost);
  return trackTokenUsage(userId, estimatedTokens);
}
