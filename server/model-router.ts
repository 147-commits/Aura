import OpenAI from "openai";
import type { ChatMode } from "./truth-engine";
import { trackTokenUsage } from "./middleware";

/**
 * Model Router — routes queries to the cheapest capable model.
 *
 * Strategy:
 * - Simple chat, casual questions → gpt-4o-mini (~10x cheaper)
 * - Complex analysis, research, decision-making → gpt-4o
 * - Memory extraction, action detection, mode detection → gpt-4o-mini (background tasks)
 *
 * This is the single most important cost optimization.
 * Without routing, a $9.99/month subscription is barely viable.
 * With routing, target 60%+ gross margins.
 */

export type ModelTier = "mini" | "standard";

export interface ModelConfig {
  model: string;
  maxTokens: number;
  tier: ModelTier;
}

const MODELS: Record<ModelTier, ModelConfig> = {
  mini: {
    model: "gpt-4o-mini",
    maxTokens: 4096,
    tier: "mini",
  },
  standard: {
    model: "gpt-4o",
    maxTokens: 4096,
    tier: "standard",
  },
};

/**
 * Select the appropriate model based on the chat mode and message complexity.
 */
export function selectModel(mode: ChatMode, message: string): ModelConfig {
  // Research and decision modes always get the standard model —
  // accuracy matters more than cost for these
  if (mode === "research" || mode === "decision") {
    return MODELS.standard;
  }

  // For other modes, classify based on message complexity
  const complexity = estimateComplexity(message);

  if (complexity === "high") {
    return MODELS.standard;
  }

  return MODELS.mini;
}

/**
 * Get the model for background/internal tasks (memory extraction, action detection, etc.)
 * These always use the cheapest model since they're not user-facing.
 */
export function getBackgroundModel(): string {
  return MODELS.mini.model;
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
 */
export function trackCompletion(userId: string, promptText: string, responseText: string): boolean {
  const estimatedTokens = estimateTokens(promptText) + estimateTokens(responseText);
  return trackTokenUsage(userId, estimatedTokens);
}
