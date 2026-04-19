/**
 * Canonical Truth-First runtime types + Zod validators.
 *
 * Every artifact produced by an Aura pipeline agent, every gate result, and
 * every orchestrator decision MUST carry a Confidence object so trust is
 * legible end-to-end. This file defines:
 *
 *   - ConfidenceField (Zod) — embed inside any artifact schema.
 *   - GateResult — phase-gate output (used by C2).
 *   - AgentDecision — orchestrator routing log entry (used by C3).
 *   - requiresHumanReview — single source of truth for the
 *     "Low confidence → don't auto-pass" policy.
 *
 * Zod runs cleanly in Node and on React Native, so this file is safe to
 * import from anywhere on the server. It is deliberately scoped to the
 * server tree (not shared/) because the consumers — orchestrator, gate
 * runner, evaluator — are all server-side.
 */

import { z } from "zod";
import type { ConfidenceLevel } from "./principles";

// ── Confidence field (compose into every artifact schema) ───────────────────

export const ConfidenceLevelSchema = z.enum(["High", "Medium", "Low"]);

export const ConfidenceFieldSchema = z
  .object({
    level: ConfidenceLevelSchema,
    /** 5–15 word reason explaining WHY this level was chosen. */
    reason: z.string().min(10, "confidence.reason must be at least 10 characters"),
    /** Optional list of unknowns or assumptions the level reflects. */
    uncertainties: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type ConfidenceField = z.infer<typeof ConfidenceFieldSchema>;

/**
 * Wrap any artifact schema with a required `confidence` field.
 *
 * Usage:
 *   const PrdArtifact = withConfidence(z.object({ ... }));
 */
export function withConfidence<T extends z.ZodRawShape>(
  body: z.ZodObject<T>
): z.ZodObject<T & { confidence: typeof ConfidenceFieldSchema }> {
  return body.extend({ confidence: ConfidenceFieldSchema }) as z.ZodObject<
    T & { confidence: typeof ConfidenceFieldSchema }
  >;
}

// ── Gate result (used by C2 phase gates) ───────────────────────────────────

export const GateCheckSchema = z
  .object({
    /** Stable id of this check, e.g. "all-acs-testable". */
    id: z.string().min(1),
    /** Human-readable description of what is being checked. */
    description: z.string().min(1),
    /** Outcome of this check. */
    passed: z.boolean(),
    /** Short rationale tied to the artifact. */
    rationale: z.string().min(1),
  })
  .strict();

export type GateCheck = z.infer<typeof GateCheckSchema>;

export const GateResultSchema = z
  .object({
    /** True only when every check passed AND confidence is not Low. */
    passed: z.boolean(),
    /** The gate's confidence in its own decision. Low → human review. */
    confidence: ConfidenceFieldSchema,
    /** Per-check breakdown. */
    checks: z.array(GateCheckSchema).min(1),
    /** When true, the orchestrator must surface this gate to the user
     *  rather than auto-applying its result. */
    requiresHumanReview: z.boolean(),
  })
  .strict();

export type GateResult = z.infer<typeof GateResultSchema>;

// ── Agent decision (used by C3 orchestrator) ────────────────────────────────

export const AgentDecisionSchema = z
  .object({
    /** What was the routing decision being made about. */
    question: z.string().min(1),
    /** What the orchestrator decided to do. */
    decision: z.string().min(1),
    /** Why — terse, ties to evidence in scope at decision time. */
    reasoning: z.string().min(1),
    /** Confidence in this decision; Low routes the choice to the user. */
    confidence: ConfidenceFieldSchema,
    /** True when this decision can be undone without data loss / cost. */
    reversible: z.boolean(),
    /** ISO-8601 timestamp the decision was logged. */
    decidedAt: z.string().datetime().optional(),
  })
  .strict();

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

// ── Human-review policy ─────────────────────────────────────────────────────

/**
 * Canonical predicate: "should this output be surfaced to a human rather
 * than auto-applied?".
 *
 * Today: yes whenever confidence is Low. Centralising this lets us tighten
 * later (e.g. "Medium for compliance-domain decisions") without having to
 * find every call site.
 */
export function requiresHumanReview(level: ConfidenceLevel): boolean {
  return level === "Low";
}

/**
 * Construct a GateResult with the human-review flag derived from policy.
 * Also enforces the "all checks passed AND not Low" rule for `passed`.
 */
export function buildGateResult(input: {
  checks: GateCheck[];
  confidence: ConfidenceField;
}): GateResult {
  const allChecksPassed = input.checks.length > 0 && input.checks.every((c) => c.passed);
  const humanReview = requiresHumanReview(input.confidence.level);
  return {
    checks: input.checks,
    confidence: input.confidence,
    passed: allChecksPassed && !humanReview,
    requiresHumanReview: humanReview,
  };
}
