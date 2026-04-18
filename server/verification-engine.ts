/**
 * Verification Engine — Chain-of-Verification (CoVe) and self-consistency checks.
 *
 * Runs AFTER retrieval and BEFORE final response. Computes evidence-based
 * composite confidence that replaces the LLM's self-declared confidence.
 *
 * Cost optimization:
 *   - Full CoVe: research + decision modes only
 *   - Chat mode: lightweight self-consistency for uncertain claims
 *   - Brainstorm/explain: skip verification entirely
 *   - All verification uses gpt-4o-mini ($0.15/1M tokens)
 */

import OpenAI from "openai";
import type { RetrievalResult } from "./retrieval-engine";
import type { Confidence } from "./confidence-calibrator";

// ── Types ───────────────────────────────────────────────────────────────────

export interface VerifiedClaim {
  claim: string;
  confidence: Confidence;
  sources: { title: string; url?: string; quality: number }[];
  crossSourceAgreement: number;
  selfConsistencyScore: number;
}

export interface VerificationResult {
  verifiedClaims: VerifiedClaim[];
  overallConfidence: Confidence;
  compositeScore: number;
  disclaimers: string[];
}

export interface CompositeSignals {
  sourceAuthorityAvg: number;
  crossSourceAgreement: number;
  selfConsistencyScore: number;
  retrievalRelevance: number;
  domainCalibration: Confidence;
}

// ── Composite Confidence Scoring ────────────────────────────────────────────

const WEIGHTS = {
  sourceAuthority: 0.25,
  crossSourceAgreement: 0.25,
  selfConsistency: 0.20,
  retrievalRelevance: 0.15,
  domainCalibration: 0.15,
};

const DOMAIN_CONFIDENCE_SCORES: Record<Confidence, number> = {
  High: 1.0,
  Medium: 0.65,
  Low: 0.3,
};

/**
 * Compute composite confidence from multiple signals.
 * Returns a score (0-100) and a confidence level.
 */
export function computeCompositeConfidence(signals: CompositeSignals): {
  score: number;
  level: Confidence;
} {
  const domainScore = DOMAIN_CONFIDENCE_SCORES[signals.domainCalibration];

  const raw =
    signals.sourceAuthorityAvg * WEIGHTS.sourceAuthority +
    signals.crossSourceAgreement * WEIGHTS.crossSourceAgreement +
    signals.selfConsistencyScore * WEIGHTS.selfConsistency +
    signals.retrievalRelevance * WEIGHTS.retrievalRelevance +
    domainScore * WEIGHTS.domainCalibration;

  const score = Math.round(raw * 100);

  let level: Confidence;
  if (score >= 85) level = "High";
  else if (score >= 60) level = "Medium";
  else level = "Low";

  return { score, level };
}

// ── Chain-of-Verification (CoVe) ────────────────────────────────────────────

/**
 * Extract key factual claims from a response via GPT-4o-mini.
 */
async function extractClaims(response: string, openai: OpenAI): Promise<string[]> {
  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Extract the key factual claims from this text. Return ONLY a JSON array of strings, max 5 claims. Only include verifiable factual claims, not opinions or recommendations.

Text: "${response.slice(0, 2000)}"

Return: ["claim 1", "claim 2", ...]`,
      }],
      max_completion_tokens: 300,
    });
    const raw = result.choices[0]?.message?.content?.trim() || "[]";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const claims = JSON.parse(cleaned);
    return Array.isArray(claims) ? claims.slice(0, 5) : [];
  } catch {
    return [];
  }
}

/**
 * Generate verification questions for a claim.
 */
async function generateVerificationQuestions(
  claim: string,
  openai: OpenAI
): Promise<string[]> {
  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Generate 2 verification questions to check if this claim is accurate. Return ONLY a JSON array of strings.

Claim: "${claim}"

Return: ["question 1", "question 2"]`,
      }],
      max_completion_tokens: 200,
    });
    const raw = result.choices[0]?.message?.content?.trim() || "[]";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const questions = JSON.parse(cleaned);
    return Array.isArray(questions) ? questions.slice(0, 3) : [];
  } catch {
    return [];
  }
}

/**
 * Answer a verification question independently (isolation prevents bias).
 */
async function answerVerificationQuestion(
  question: string,
  sources: RetrievalResult[],
  openai: OpenAI
): Promise<{ answer: string; agrees: boolean }> {
  const sourceContext = sources.length > 0
    ? `\n\nAvailable sources:\n${sources.map((s) => `- ${s.sourceTitle || "Source"}: ${s.content.slice(0, 300)}`).join("\n")}`
    : "";

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Answer this verification question concisely. If you can verify from the sources, do so. If not, say "cannot verify."${sourceContext}

Question: ${question}

Answer in 1-2 sentences. End with either VERIFIED or UNVERIFIED.`,
      }],
      max_completion_tokens: 150,
    });
    const answer = result.choices[0]?.message?.content?.trim() || "";
    const agrees = answer.toUpperCase().includes("VERIFIED") && !answer.toUpperCase().includes("UNVERIFIED");
    return { answer, agrees };
  } catch {
    return { answer: "Cannot verify.", agrees: false };
  }
}

/**
 * Full Chain-of-Verification pipeline.
 * Expensive — only run on research and decision modes.
 */
export async function chainOfVerification(
  query: string,
  initialResponse: string,
  retrievalResults: RetrievalResult[],
  openai: OpenAI
): Promise<VerificationResult> {
  const disclaimers: string[] = [];
  let costEstimate = 0;
  const COST_LIMIT = 0.05; // Circuit breaker: $0.05 max per verification

  // Step 1: Extract claims
  const claims = await extractClaims(initialResponse, openai);
  costEstimate += 0.0003; // ~2K tokens for extraction

  if (claims.length === 0) {
    return {
      verifiedClaims: [],
      overallConfidence: "Medium",
      compositeScore: 65,
      disclaimers: ["No verifiable factual claims detected in response."],
    };
  }

  const verifiedClaims: VerifiedClaim[] = [];

  for (const claim of claims) {
    // Circuit breaker
    if (costEstimate > COST_LIMIT) {
      disclaimers.push("Verification budget exceeded — some claims were not fully checked.");
      verifiedClaims.push({
        claim,
        confidence: "Medium",
        sources: [],
        crossSourceAgreement: 0.5,
        selfConsistencyScore: 0.5,
      });
      continue;
    }

    // Step 2: Generate verification questions
    const questions = await generateVerificationQuestions(claim, openai);
    costEstimate += 0.0002;

    // Step 3: Answer each question independently
    let verifiedCount = 0;
    const claimSources: { title: string; url?: string; quality: number }[] = [];

    for (const question of questions) {
      if (costEstimate > COST_LIMIT) break;

      const { agrees } = await answerVerificationQuestion(question, retrievalResults, openai);
      costEstimate += 0.0003;
      if (agrees) verifiedCount++;
    }

    // Step 4: Compute cross-source agreement
    const relevantSources = retrievalResults.filter((r) =>
      r.content.toLowerCase().includes(claim.toLowerCase().split(" ").slice(0, 3).join(" "))
    );

    for (const src of relevantSources.slice(0, 3)) {
      claimSources.push({
        title: src.sourceTitle || "Source",
        url: src.sourceUrl || undefined,
        quality: src.qualityScore,
      });
    }

    const crossSourceAgreement = questions.length > 0
      ? verifiedCount / questions.length
      : 0.5;

    // Step 5: Determine claim confidence
    let claimConfidence: Confidence;
    if (crossSourceAgreement >= 0.8 && claimSources.length >= 2) claimConfidence = "High";
    else if (crossSourceAgreement >= 0.5) claimConfidence = "Medium";
    else claimConfidence = "Low";

    verifiedClaims.push({
      claim,
      confidence: claimConfidence,
      sources: claimSources,
      crossSourceAgreement,
      selfConsistencyScore: crossSourceAgreement, // Proxy for CoVe
    });
  }

  // Compute overall
  const avgAgreement = verifiedClaims.length > 0
    ? verifiedClaims.reduce((s, c) => s + c.crossSourceAgreement, 0) / verifiedClaims.length
    : 0.5;
  const avgSourceQuality = verifiedClaims.length > 0
    ? verifiedClaims.reduce((s, c) => s + (c.sources.length > 0 ? c.sources[0].quality : 0.5), 0) / verifiedClaims.length
    : 0.5;

  const { score, level } = computeCompositeConfidence({
    sourceAuthorityAvg: avgSourceQuality,
    crossSourceAgreement: avgAgreement,
    selfConsistencyScore: avgAgreement,
    retrievalRelevance: retrievalResults.length > 0
      ? retrievalResults.reduce((s, r) => s + r.relevanceScore, 0) / retrievalResults.length
      : 0.3,
    domainCalibration: level,
  });

  if (costEstimate > 0.03) {
    disclaimers.push(`Verification used an estimated $${costEstimate.toFixed(4)} in API calls.`);
  }

  return { verifiedClaims, overallConfidence: level, compositeScore: score, disclaimers };
}

// ── Self-Consistency Check ──────────────────────────────────────────────────

/**
 * Generate multiple independent reasoning paths and compare conclusions.
 * Lightweight alternative to full CoVe — use for chat mode.
 */
export async function selfConsistencyCheck(
  query: string,
  systemPrompt: string,
  openai: OpenAI,
  paths: number = 3
): Promise<{ consensusAnswer: string; consistencyScore: number }> {
  const responses: string[] = [];

  for (let i = 0; i < paths; i++) {
    try {
      const result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        max_completion_tokens: 500,
        temperature: 0.7,
      });
      responses.push(result.choices[0]?.message?.content?.trim() || "");
    } catch {
      responses.push("");
    }
  }

  const validResponses = responses.filter(Boolean);
  if (validResponses.length === 0) {
    return { consensusAnswer: "", consistencyScore: 0.3 };
  }

  // Compare conclusions: use the first response as baseline
  // Check if other responses agree (simple keyword overlap heuristic)
  const baseline = validResponses[0].toLowerCase();
  const baselineWords = new Set(baseline.split(/\s+/).filter((w) => w.length > 4));

  let agreementCount = 0;
  for (let i = 1; i < validResponses.length; i++) {
    const words = validResponses[i].toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const overlap = words.filter((w) => baselineWords.has(w)).length;
    const overlapRatio = baselineWords.size > 0 ? overlap / baselineWords.size : 0;
    if (overlapRatio > 0.3) agreementCount++;
  }

  let consistencyScore: number;
  if (validResponses.length <= 1) {
    consistencyScore = 0.5;
  } else if (agreementCount === validResponses.length - 1) {
    consistencyScore = 0.9 + (0.1 * agreementCount / (validResponses.length - 1));
  } else if (agreementCount > 0) {
    consistencyScore = 0.6 + (0.2 * agreementCount / (validResponses.length - 1));
  } else {
    consistencyScore = 0.4;
  }

  return {
    consensusAnswer: validResponses[0],
    consistencyScore: Math.min(1.0, consistencyScore),
  };
}

// ── Domain Calibration Integration ──────────────────────────────────────────

/**
 * Apply domain calibration as final authority on confidence.
 * Domain rules can only DOWNGRADE, never upgrade.
 */
export function applyDomainCalibration(
  compositeLevel: Confidence,
  domainLevel: Confidence
): Confidence {
  const order: Record<Confidence, number> = { High: 3, Medium: 2, Low: 1 };

  // Domain calibrator is final authority — can only downgrade
  if (order[domainLevel] < order[compositeLevel]) {
    return domainLevel;
  }
  return compositeLevel;
}
