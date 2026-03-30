import OpenAI from "openai";
import type { ChatMode } from "./truth-engine";
import type { SkillDomain } from "./skill-engine";
import { trackTokenUsage } from "./middleware";

/**
 * Model Router — routes queries to the cheapest capable model.
 *
 * Strategy:
 * - Simple chat, casual questions → gpt-4o-mini (~10x cheaper)
 * - Complex analysis, research, decision-making → gpt-4o
 * - Domain skill active or chained → gpt-4o (measurably better results)
 * - Triage mode → gpt-4o-mini (short, structured responses)
 * - Memory extraction, action detection, mode detection → gpt-4o-mini (background tasks)
 *
 * This is the single most important cost optimization.
 * Without routing, a $9.99/month subscription is barely viable.
 * With routing, target 60%+ gross margins.
 */

export type ModelTier = "mini" | "standard";
export type ModelSelectionReason =
  | "domain-skill-active"
  | "domain-skill-chained"
  | "mode-based"
  | "triage"
  | "background";

export interface ModelConfig {
  model: string;
  maxTokens: number;
  tier: ModelTier;
  reason: ModelSelectionReason;
  estimatedCost: number;
}

export interface SkillModelOptions {
  activeSkillDomain?: SkillDomain;
  isChained?: boolean;
  isTriage?: boolean;
}

// ── Cost Constants ──────────────────────────────────────────────────────────
/** Cost per 1K tokens (blended input+output estimate) */
const GPT4O_COST_PER_1K = 0.005;
const GPT4O_MINI_COST_PER_1K = 0.00015;
/** Default estimated tokens per request (prompt + response) */
const DEFAULT_REQUEST_TOKENS = 2000;
/** Monthly cost warning threshold per user (USD) */
const MONTHLY_COST_WARN_THRESHOLD = 50;

const BASE_MODELS: Record<ModelTier, { model: string; maxTokens: number }> = {
  mini: { model: "gpt-4o-mini", maxTokens: 4096 },
  standard: { model: "gpt-4o", maxTokens: 4096 },
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

/** Estimate USD cost for a given model and token count */
function estimateCost(tier: ModelTier, tokens: number = DEFAULT_REQUEST_TOKENS): number {
  const rate = tier === "standard" ? GPT4O_COST_PER_1K : GPT4O_MINI_COST_PER_1K;
  return (tokens / 1000) * rate;
}

/** Build a ModelConfig with cost estimate */
function buildConfig(tier: ModelTier, reason: ModelSelectionReason): ModelConfig {
  const base = BASE_MODELS[tier];
  return {
    ...base,
    tier,
    reason,
    estimatedCost: estimateCost(tier),
  };
}

/**
 * Select the appropriate model based on chat mode, message complexity, and active skills.
 *
 * Priority order:
 *   1. Triage mode → mini (short structured responses, cost-efficient)
 *   2. Chained skills → standard (multi-domain needs full model capability)
 *   3. Active domain skill → standard (domain expertise benefits from gpt-4o)
 *   4. Mode-based → existing logic (research/decision → standard, else complexity check)
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

  // Chained skills (primary + secondary): always standard
  if (options?.isChained) {
    return buildConfig("standard", "domain-skill-chained");
  }

  // Active domain skill: upgrade to standard for better domain reasoning
  if (options?.activeSkillDomain) {
    return buildConfig("standard", "domain-skill-active");
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
  return BASE_MODELS.mini.model;
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
