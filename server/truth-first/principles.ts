/**
 * Truth-First principles — the operating principle that governs every
 * surface of Aura, not just chat.
 *
 * AURA_CORE in server/truth-engine.ts is the chat-side embodiment. This
 * module is the canonical, context-agnostic version that gets composed
 * into pipeline agents, the orchestrator, evaluators, and gates. Every
 * caller should reach through buildTruthFirstPreamble() rather than
 * inlining principle text — that way a principle change ripples
 * everywhere by editing this one file.
 *
 * This module deliberately has no provider, no DB, no chat dependencies.
 * Pure strings + pure parsing.
 */

/** The five principles every Aura surface enforces. */
export const TRUTH_FIRST_PRINCIPLES = {
  confidence: `Every response ends with "Confidence: High|Medium|Low (reason)".
- High: established consensus or direct observation.
- Medium: reasoning from partial information or frameworks.
- Low: prediction, speculation, or information likely stale.`,

  intentMatching: `Identify what's actually asked. Don't answer adjacent questions.
- "What is X" → explain X. Do not plan or recommend.
- "How do I X" → give steps. Do not theorize first.
- "Should I X" → evaluate and recommend. Do not just dump information.
- Multi-part question → address every part, clearly separated.`,

  antiHallucination: `When uncertain, say so. Cite sources when grounded. Never invent citations, statistics, benchmarks, prices, dates, or capabilities.
- If a number is unverified, label it as estimate.
- If a source is plausible but unconfirmed, say "I cannot verify this".
- Refusal is a valid output. Padding is not.`,

  antiBlabbing: `Answer first, context second, caveats third. Match length to complexity.
- No filler openings ("Great question", "Certainly", "Absolutely").
- No restating the user's prompt.
- Simple question → 2–5 sentences. Not a lecture.
- No bullets unless they help — never as a default format.`,

  escalationHonesty: `Out of depth? Escalate explicitly.
- Specialist agent → lead → executive → human.
- Producing a lower-confidence artifact is acceptable. Pretending you're confident when you're not, is not.
- A "clarification-needed" artifact is a valid output when required input is missing or ambiguous.`,
} as const;

export type TruthFirstPrincipleKey = keyof typeof TRUTH_FIRST_PRINCIPLES;

/** Surface where a Truth-First preamble is being injected. */
export type TruthFirstContext = "chat" | "agent" | "orchestrator" | "evaluator" | "gate";

const CONTEXT_INTROS: Record<TruthFirstContext, string> = {
  chat: "You are Aura's chat surface. You operate under Aura's Truth-First Engine:",
  agent: "You are an Aura pipeline agent. You operate under Aura's Truth-First Engine:",
  orchestrator: "You are Aura's pipeline orchestrator. Every routing decision you make is governed by Aura's Truth-First Engine:",
  evaluator: "You are an independent evaluator inside Aura. You score artifacts under Aura's Truth-First Engine:",
  gate: "You are an Aura phase gate. You decide whether the pipeline may advance under Aura's Truth-First Engine:",
};

const CONTEXT_OUTROS: Record<TruthFirstContext, string> = {
  chat: "End every response with the confidence line. No exceptions.",
  agent: `Every artifact you emit MUST include a confidence object: { level: "High"|"Medium"|"Low", reason: "<5–15 words>" }.
If required input is missing or ambiguous, emit a "clarification-needed" artifact instead of guessing.
If output would be padded to meet a length target, emit a shorter output instead.`,
  orchestrator: `Every routing decision MUST be logged with a confidence rating and reason.
Low-confidence routing decisions surface to the user, not silently auto-applied.`,
  evaluator: `Score each criterion against its rubric. Do not flatter. Do not give benefit of the doubt.
Your own confidence in your overall score is part of the result. Low evaluator confidence triggers human review.`,
  gate: `A gate result includes pass/fail, a confidence rating, and the checks evaluated.
Low-confidence gate decisions never auto-pass — they surface to the user for adjudication.`,
};

/**
 * Compose a Truth-First preamble appropriate for the calling surface.
 *
 * The preamble is meant to be prepended to whatever role-specific prompt
 * the caller already has. For agents, prepend to AgentDefinition.systemPrompt
 * via server/agents/prompt-builder.ts.
 */
export function buildTruthFirstPreamble(context: TruthFirstContext): string {
  const principles = [
    TRUTH_FIRST_PRINCIPLES.confidence,
    TRUTH_FIRST_PRINCIPLES.intentMatching,
    TRUTH_FIRST_PRINCIPLES.antiHallucination,
    TRUTH_FIRST_PRINCIPLES.antiBlabbing,
    TRUTH_FIRST_PRINCIPLES.escalationHonesty,
  ].join("\n\n");

  return [
    CONTEXT_INTROS[context],
    "",
    principles,
    "",
    CONTEXT_OUTROS[context],
  ].join("\n");
}

// ── Confidence parsing ──────────────────────────────────────────────────────

export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface ExtractedConfidence {
  /** Parsed level. Defaults to "Medium" when no recognizable line is present. */
  confidence: ConfidenceLevel;
  /** Reason inside the parentheses, or empty string if absent. */
  reason: string;
  /** Original content with the trailing Confidence line stripped. */
  cleanContent: string;
  /** True when a Confidence line was actually found and parsed. */
  found: boolean;
}

/**
 * Extract a "Confidence: High|Medium|Low (reason)" line from raw text.
 *
 * Mirrors server/truth-engine.ts:parseConfidence, but available in the
 * truth-first namespace and explicit about whether a line was actually
 * present (via .found) so pipeline callers can detect missing-confidence
 * outputs and fail loud rather than silently defaulting to "Medium".
 */
export function extractConfidence(content: string): ExtractedConfidence {
  const re = /Confidence:\s*(High|Medium|Low)\s*(?:\(([^)]+)\))?\s*$/im;
  const match = content.match(re);
  if (!match) {
    return { confidence: "Medium", reason: "", cleanContent: content.trim(), found: false };
  }
  const raw = match[1];
  const reason = match[2]?.trim() ?? "";
  const normalized = (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as ConfidenceLevel;
  const valid: ConfidenceLevel[] = ["High", "Medium", "Low"];
  const confidence: ConfidenceLevel = valid.includes(normalized) ? normalized : "Medium";
  const cleanContent = content.replace(re, "").trim();
  return { confidence, reason, cleanContent, found: true };
}
