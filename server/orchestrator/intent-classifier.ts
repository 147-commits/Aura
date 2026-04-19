/**
 * Intent classifier — splits an incoming user message into one of:
 *
 *   "chat"          → Personal Companion path (server/routes/chat.ts)
 *   "build"         → Virtual Company Engine pipeline (orchestrator)
 *   "build-extend"  → Pipeline run that extends an existing artifact set
 *   "ambiguous"     → UI surfaces a clarifying picker
 *
 * Two-layer design (mirrors the agent router):
 *   Layer 1 — rule-based heuristics. ~free, sub-millisecond, deterministic.
 *   Layer 2 — gpt-4o-mini fallback when Layer 1 returns null. ~200ms, cheap.
 *
 * Returns a Truth-First-shaped result with confidence + reason so callers
 * can surface low-confidence classifications to the user instead of
 * silently committing to a path.
 */

import OpenAI from "openai";
import { getOpenAIProviderInstance } from "../providers/provider-registry";

export type IntentLabel = "chat" | "build" | "ambiguous" | "build-extend";

export type IntentLayer = "rule" | "llm";

export interface IntentResult {
  intent: IntentLabel;
  confidence: "High" | "Medium" | "Low";
  reason: string;
  /** Which layer made the call. */
  layer: IntentLayer;
}

// ── Keyword catalogues ─────────────────────────────────────────────────────

/**
 * Strong build phrases — when any one of these appears, route to the
 * pipeline regardless of length. Phrased to minimize false positives.
 */
const STRONG_BUILD_PHRASES = [
  "build me", "build a", "build an", "build the",
  "create me", "create a", "create an", "create the",
  "make me", "make a",
  "spin up", "stand up", "scaffold",
  "ship", "deploy",
  "generate a", "generate an",
  "produce a", "produce an",
  "code up", "implement",
];

/**
 * Phrases that say "extend / iterate on something I already started".
 * Rule-priority over plain "build" so a user editing an existing run
 * doesn't accidentally start a fresh one.
 */
const BUILD_EXTEND_PHRASES = [
  "add to my", "add to the", "extend my", "extend the",
  "update my", "update the", "modify my", "modify the",
  "fix my", "fix the", "improve my", "improve the",
  "iterate on", "next version", "v2 of", "follow up on",
  "continue building", "continue the", "build on top",
];

/**
 * Question openers — strong chat signal. We require the question word at
 * the start of the message (after trim) to avoid catching "I want to know
 * what kind of thing to build".
 */
const QUESTION_OPENERS = [
  "what", "how", "why", "when", "where", "who",
  "which", "is", "are", "can", "should", "do", "does", "did",
  "would", "could", "will",
];

const SHORT_THRESHOLD_WORDS = 15;

// ── Layer 1: rule-based ────────────────────────────────────────────────────

function normalize(message: string): string {
  return message.trim().toLowerCase();
}

function startsWithQuestion(lower: string): boolean {
  // Strip leading punctuation, take the first token.
  const stripped = lower.replace(/^[^a-z]+/, "");
  const firstWord = stripped.split(/\s+/)[0];
  if (!firstWord) return false;
  return QUESTION_OPENERS.includes(firstWord);
}

function containsAny(lower: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

function wordCount(message: string): number {
  return message.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Layer 1: pure rule-based classification. Returns null when the rules
 * don't reach a confident verdict — caller should fall back to the LLM.
 *
 * Decision priority (top to bottom):
 *   1. build-extend phrase             → "build-extend" High
 *   2. starts with question word       → "chat" High
 *      (questions outrank build keywords: "How do I deploy X" is asking
 *       for guidance, not requesting a deploy)
 *   3. strong build phrase              → "build" High
 *   4. short message (<15 words) w/o build → "chat" Medium
 *   5. otherwise → null (ambiguous → fall through to LLM)
 */
export function classifyIntentRule(message: string): IntentResult | null {
  if (!message || !message.trim()) {
    return { intent: "chat", confidence: "Low", reason: "empty input — defaulting to chat", layer: "rule" };
  }
  const lower = normalize(message);

  const extendHit = containsAny(lower, BUILD_EXTEND_PHRASES);
  if (extendHit) {
    return {
      intent: "build-extend",
      confidence: "High",
      reason: `matched extend phrase "${extendHit}"`,
      layer: "rule",
    };
  }

  // Question check before build — see decision-priority comment above.
  const isQuestion = startsWithQuestion(lower);
  if (isQuestion) {
    return {
      intent: "chat",
      confidence: "High",
      reason: "starts with question word",
      layer: "rule",
    };
  }

  const buildHit = containsAny(lower, STRONG_BUILD_PHRASES);
  if (buildHit) {
    return {
      intent: "build",
      confidence: "High",
      reason: `matched build phrase "${buildHit}"`,
      layer: "rule",
    };
  }

  if (wordCount(message) < SHORT_THRESHOLD_WORDS) {
    return {
      intent: "chat",
      confidence: "Medium",
      reason: `short message (${wordCount(message)} words) without build keyword → defaulting to chat`,
      layer: "rule",
    };
  }

  return null;
}

// ── Layer 2: LLM fallback ──────────────────────────────────────────────────

/**
 * One-shot mini-tier classification when rules are inconclusive.
 *
 * The model is asked for ONE token (chat | build | build-extend | ambiguous).
 * Anything else maps to "ambiguous" so the caller surfaces a picker rather
 * than committing.
 */
export async function classifyIntentLLM(
  message: string,
  client?: OpenAI
): Promise<IntentResult> {
  const openai = client ?? getOpenAIProviderInstance().raw();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 8,
      messages: [
        {
          role: "user",
          content:
            `Classify the user's intent. Return ONE WORD only.\n` +
            `chat       → asking a question, exploring, learning\n` +
            `build      → wants a new product/app/document built end-to-end\n` +
            `build-extend → wants to add to or modify an existing build\n` +
            `ambiguous  → cannot tell\n\n` +
            `Message: ${message.slice(0, 400)}`,
        },
      ],
    });
    const raw = response.choices[0]?.message?.content?.trim().toLowerCase() || "";
    const normalized = raw.replace(/[^a-z\-]/g, "");
    if (normalized === "chat" || normalized === "build" ||
        normalized === "build-extend" || normalized === "ambiguous") {
      return {
        intent: normalized as IntentLabel,
        confidence: normalized === "ambiguous" ? "Low" : "Medium",
        reason: `LLM classified as "${normalized}"`,
        layer: "llm",
      };
    }
    return {
      intent: "ambiguous",
      confidence: "Low",
      reason: `LLM returned unrecognized output "${raw.slice(0, 30)}"`,
      layer: "llm",
    };
  } catch (err) {
    console.warn("[intent-classifier] LLM fallback failed:", (err as Error)?.message ?? err);
    return {
      intent: "ambiguous",
      confidence: "Low",
      reason: "LLM unavailable — defaulting to ambiguous",
      layer: "llm",
    };
  }
}

// ── Public entry point ─────────────────────────────────────────────────────

export interface ClassifyIntentOptions {
  /** Inject an OpenAI client for tests. */
  openai?: OpenAI;
  /** Skip the LLM fallback (rule-only). Useful for hot-path latency budgets. */
  ruleOnly?: boolean;
}

/**
 * Classify intent. Tries rules first; on miss, calls the LLM unless ruleOnly.
 */
export async function classifyIntent(
  message: string,
  opts?: ClassifyIntentOptions
): Promise<IntentResult> {
  const ruleVerdict = classifyIntentRule(message);
  if (ruleVerdict) return ruleVerdict;
  if (opts?.ruleOnly) {
    return {
      intent: "ambiguous",
      confidence: "Low",
      reason: "rule layer inconclusive and ruleOnly=true",
      layer: "rule",
    };
  }
  return classifyIntentLLM(message, opts?.openai);
}
