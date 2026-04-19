/**
 * Rubric-based artifact evaluator.
 *
 * Calls an AIProvider once per artifact — asking the model to score every
 * criterion in a single JSON response. Cheaper than one call per criterion
 * and produces internally consistent rationales.
 *
 * GAN separation: the evaluator provider MUST be different from whatever
 * generated the artifact. Evaluating your own output is unreliable — the
 * same model flatters the same biases. If the caller passes a matching
 * generator id, evaluateArtifact throws.
 */

import type { AIProvider } from "../providers/ai-provider-interface";
import {
  SCORE_BY_LEVEL,
  computeOverallScore,
  deriveConfidence,
  type CriterionScore,
  type EvalResult,
  type EvalRubric,
  type ScoreLevel,
} from "./rubric-schema";

export interface EvaluateOptions {
  /** Stable id of the artifact being scored (for logs / EvalResult). */
  artifactId: string;
  /** The artifact content — stringified when passed to the evaluator. */
  artifact: unknown;
  /** The rubric to score against. */
  rubric: EvalRubric;
  /** The AIProvider that will do the scoring. */
  evaluator: AIProvider;
  /**
   * Provider id of whatever GENERATED the artifact. If identical to the
   * evaluator.id, throws — this enforces GAN separation.
   */
  generatorProviderId?: string;
  /** Model id the evaluator should invoke. Defaults to "gpt-4o-mini". */
  evaluatorModel?: string;
}

const DEFAULT_EVALUATOR_MODEL = "gpt-4o-mini";

function stringifyArtifact(artifact: unknown): string {
  if (typeof artifact === "string") return artifact;
  try {
    return JSON.stringify(artifact, null, 2);
  } catch {
    return String(artifact);
  }
}

function buildEvaluatorPrompt(rubric: EvalRubric, artifactText: string): string {
  const criterionBlocks = rubric.criteria
    .map((c) => {
      return [
        `### ${c.id}`,
        `Description: ${c.description}`,
        `Excellent (1.0): ${c.scoringGuide.excellent}`,
        `Good (0.75): ${c.scoringGuide.good}`,
        `Acceptable (0.5): ${c.scoringGuide.acceptable}`,
        `Poor (0.2): ${c.scoringGuide.poor}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    `You are an independent evaluator grading an artifact against a rubric.`,
    `Do not flatter. Do not give benefit of the doubt. If the artifact is vague, score it low.`,
    ``,
    `Rubric: ${rubric.name} (${rubric.artifactType})`,
    ``,
    `Criteria:`,
    criterionBlocks,
    ``,
    `Artifact:`,
    `"""`,
    artifactText,
    `"""`,
    ``,
    `For each criterion above, pick one level (excellent | good | acceptable | poor) and write a one-sentence rationale citing specific parts of the artifact.`,
    ``,
    `Return ONLY valid JSON in this exact shape (no markdown fences, no commentary):`,
    `{"scores":[{"criterionId":"<id>","level":"excellent|good|acceptable|poor","rationale":"<one sentence>"}]}`,
    `Every criterion id must appear exactly once. No additional fields.`,
  ].join("\n");
}

function isScoreLevel(s: string): s is ScoreLevel {
  return s === "excellent" || s === "good" || s === "acceptable" || s === "poor";
}

function parseScoreResponse(
  raw: string,
  rubric: EvalRubric
): CriterionScore[] {
  // Strip common wrapper noise (```json, leading prose, trailing text).
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Evaluator returned no JSON object");
  const parsed = JSON.parse(match[0]) as {
    scores?: { criterionId?: string; level?: string; rationale?: string }[];
  };
  if (!parsed.scores || !Array.isArray(parsed.scores)) {
    throw new Error("Evaluator response missing 'scores' array");
  }

  const byId = new Map<string, { level: ScoreLevel; rationale: string }>();
  for (const entry of parsed.scores) {
    if (!entry.criterionId || !entry.level || !isScoreLevel(entry.level)) continue;
    byId.set(entry.criterionId, {
      level: entry.level,
      rationale: entry.rationale || "",
    });
  }

  const out: CriterionScore[] = [];
  for (const criterion of rubric.criteria) {
    const entry = byId.get(criterion.id);
    if (!entry) {
      throw new Error(`Evaluator omitted criterion "${criterion.id}"`);
    }
    out.push({
      criterionId: criterion.id,
      score: SCORE_BY_LEVEL[entry.level],
      rationale: entry.rationale,
    });
  }
  return out;
}

/**
 * Score one artifact against one rubric.
 *
 * Throws if the evaluator provider matches the generator provider (GAN
 * separation). Also throws if the evaluator returns malformed JSON.
 */
export async function evaluateArtifact(opts: EvaluateOptions): Promise<EvalResult> {
  const { artifactId, artifact, rubric, evaluator, generatorProviderId } = opts;

  if (generatorProviderId && evaluator.id === generatorProviderId) {
    throw new Error(
      `GAN separation violated: evaluator and generator are both "${evaluator.id}". ` +
      `Use a different provider for evaluation.`
    );
  }

  const model = opts.evaluatorModel ?? DEFAULT_EVALUATOR_MODEL;
  const prompt = buildEvaluatorPrompt(rubric, stringifyArtifact(artifact));

  const response = await evaluator.chat({
    model,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1500,
    temperature: 0,
  });

  const criterionScores = parseScoreResponse(response.content, rubric);
  const overallScore = computeOverallScore(rubric, criterionScores);
  const confidence = deriveConfidence(criterionScores);

  return {
    rubricId: rubric.id,
    artifactId,
    overallScore,
    criterionScores,
    evaluatedBy: `${evaluator.id}:${model}`,
    evaluatedAt: new Date().toISOString(),
    confidence,
  };
}
