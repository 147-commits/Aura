/**
 * Rubric-based evaluation schema.
 *
 * Zod schemas catch shape, not quality. A PRD can be perfectly shaped and
 * vague. Rubrics express *what quality means* per artifact type: each
 * criterion has a weight and a four-level scoring guide, and the evaluator
 * produces a weighted 0–1 score plus rationale per criterion.
 *
 * Used by:
 *   - server/eval/evaluator.ts (single artifact scoring)
 *   - scripts/run-eval.ts (batch scoring over golden fixtures)
 */

/** Canonical artifact types Aura evaluates today. */
export type ArtifactType =
  | "prd"
  | "adr"
  | "project-charter"
  | "chat-response"
  | "delivery-plan"
  | "threat-model"
  | "sprint-plan"
  | "test-strategy"
  | "design-spec"
  | "deployment-runbook"
  | "system-design"
  | "code-change-set"
  | "documentation-set";

/** Four-level scoring guide. Score = {excellent: 1.0, good: 0.75, acceptable: 0.5, poor: 0.2}. */
export interface ScoringGuide {
  excellent: string;
  good: string;
  acceptable: string;
  poor: string;
}

/** Numeric score per level — evaluators map a level label to this score. */
export const SCORE_BY_LEVEL = {
  excellent: 1.0,
  good: 0.75,
  acceptable: 0.5,
  poor: 0.2,
} as const;

export type ScoreLevel = keyof typeof SCORE_BY_LEVEL;

export interface EvalCriterion {
  /** Stable identifier — lets the evaluator key scores and the tests assert on specific criteria. */
  id: string;
  /** Human-readable description. Short, imperative, testable. */
  description: string;
  /** 0–1 weight. Weights across a rubric must sum to 1.0 (±1e-6). */
  weight: number;
  /** Four-level rubric guide passed to the evaluator. */
  scoringGuide: ScoringGuide;
}

export interface EvalRubric {
  /** Stable rubric id (e.g. "prd-v1"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Artifact type this rubric scores. */
  artifactType: ArtifactType;
  /** Ordered criteria. */
  criteria: EvalCriterion[];
}

export interface CriterionScore {
  criterionId: string;
  /** 0–1 score. */
  score: number;
  /** 1–2 sentence reasoning tied to the artifact. */
  rationale: string;
}

export interface EvalResult {
  rubricId: string;
  artifactId: string;
  /** Weighted sum of criterion scores (0–1). */
  overallScore: number;
  criterionScores: CriterionScore[];
  /** Provider + model identifier of the evaluator, e.g. "openai:gpt-4o-mini". */
  evaluatedBy: string;
  /** ISO-8601 timestamp. */
  evaluatedAt: string;
  /** Confidence in the overall score. High = unanimous agreement, Low = spread. */
  confidence: "High" | "Medium" | "Low";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Throws if the rubric's criterion weights do not sum to 1.0 (±1e-6). */
export function validateRubricWeights(rubric: EvalRubric): void {
  const sum = rubric.criteria.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(sum - 1.0) > 1e-6) {
    throw new Error(
      `Rubric "${rubric.id}" weights sum to ${sum.toFixed(6)}, expected 1.0`
    );
  }
  const ids = new Set<string>();
  for (const c of rubric.criteria) {
    if (ids.has(c.id)) throw new Error(`Rubric "${rubric.id}" has duplicate criterion id: ${c.id}`);
    ids.add(c.id);
    if (c.weight < 0 || c.weight > 1) {
      throw new Error(`Rubric "${rubric.id}" criterion "${c.id}" has invalid weight ${c.weight}`);
    }
  }
}

/**
 * Derive a High/Medium/Low confidence label from the spread of criterion
 * scores. Tight clustering near the overall → High. Wide spread → Low.
 */
export function deriveConfidence(scores: CriterionScore[]): "High" | "Medium" | "Low" {
  if (scores.length === 0) return "Low";
  const values = scores.map((s) => s.score);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev < 0.12) return "High";
  if (stdDev < 0.25) return "Medium";
  return "Low";
}

/** Compute the overall weighted score given criterion scores and a rubric. */
export function computeOverallScore(
  rubric: EvalRubric,
  criterionScores: CriterionScore[]
): number {
  const byId = new Map(criterionScores.map((s) => [s.criterionId, s.score]));
  let weighted = 0;
  for (const criterion of rubric.criteria) {
    const score = byId.get(criterion.id);
    if (score === undefined) {
      throw new Error(`Missing score for criterion "${criterion.id}" in rubric "${rubric.id}"`);
    }
    weighted += criterion.weight * score;
  }
  return Math.max(0, Math.min(1, weighted));
}
