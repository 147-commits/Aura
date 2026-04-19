/**
 * Gate engine — phase-gate evaluation for the Virtual Company Engine.
 *
 * A gate sits between two pipeline phases. It validates the artifacts the
 * outgoing phase produced before letting the run advance.
 *
 * G1 — Discovery   → Design          : Charter + PRD complete and pass rubric
 * G2 — Design      → Planning        : Architecture (ADRs) + System Design pass
 * G3 — Security    (conditional)     : Threat Model + Security Review (when
 *                                       auth / PII / payments / regulated data)
 * G4 — Implementation → Verification : Code Change Set + Design Spec satisfied
 * G5 — Release readiness             : Deployment Runbook + QA Report + docs
 *
 * Pass rule: every required artifact for the gate exists, parses against its
 * rubric, AND is scored ≥ 0.65 by the F4 evaluator. Otherwise the gate
 * returns passed:false. F6's policy (requiresHumanReview) automatically
 * surfaces Low-confidence gate decisions to the user.
 */

import type { ArtifactType } from "../eval/rubric-schema";
import { getRubric } from "../eval/rubrics";
import { evaluateArtifact } from "../eval/evaluator";
import { getOpenAIProviderInstance } from "../providers/provider-registry";
import {
  buildGateResult,
  type GateCheck,
  type GateResult,
} from "../truth-first/artifact-schema";
import type { PipelinePhase } from "../../shared/agent-schema";

// ── Threshold ───────────────────────────────────────────────────────────────

/** Per-criterion / overall pass threshold for the F4 evaluator. */
export const GATE_PASS_THRESHOLD = 0.65;

// ── Gate definitions ───────────────────────────────────────────────────────

export type GateId = "G1" | "G2" | "G3" | "G4" | "G5";

export interface GateDefinition {
  id: GateId;
  name: string;
  /** Phase this gate guards the EXIT of. */
  phase: PipelinePhase;
  /** Phase the run advances into when this gate passes. */
  nextPhase: PipelinePhase | null;
  /** Artifact types that must be present and pass their rubrics. */
  requiredArtifacts: ArtifactType[];
  /**
   * When true, this gate is only required if the input brief or current
   * artifacts mention sensitive data. Used by G3.
   */
  conditional: boolean;
  /** Human description of the gate's intent. */
  rationale: string;
}

export const GATES: Record<GateId, GateDefinition> = {
  G1: {
    id: "G1",
    name: "Discovery → Design",
    phase: "discovery",
    nextPhase: "design",
    requiredArtifacts: ["project-charter", "prd"],
    conditional: false,
    rationale: "Charter and PRD must be complete and rubric-passing before design begins.",
  },
  G2: {
    id: "G2",
    name: "Design → Planning",
    phase: "design",
    nextPhase: "planning",
    requiredArtifacts: ["adr", "system-design", "design-spec"],
    conditional: false,
    rationale: "Architecture, system design, and design spec must pass before planning.",
  },
  G3: {
    id: "G3",
    name: "Security review (conditional)",
    phase: "design",
    nextPhase: "planning",
    requiredArtifacts: ["threat-model"],
    conditional: true,
    rationale: "Threat model required when the system handles auth, PII, payments, or regulated data.",
  },
  G4: {
    id: "G4",
    name: "Implementation → Verification",
    phase: "implementation",
    nextPhase: "verification",
    requiredArtifacts: ["code-change-set"],
    conditional: false,
    rationale: "Code change set must satisfy the sprint plan and design spec before verification.",
  },
  G5: {
    id: "G5",
    name: "Release readiness",
    phase: "verification",
    nextPhase: "release",
    requiredArtifacts: ["test-strategy", "deployment-runbook", "documentation-set"],
    conditional: false,
    rationale: "QA report, deployment runbook, and docs must pass before the run can release.",
  },
};

// ── Gate selection ─────────────────────────────────────────────────────────

/**
 * Which gates run after the named phase. Includes conditional gates only
 * when the orchestrator deems them required (see isGateRequired()).
 */
export function getRequiredGates(
  phase: PipelinePhase,
  options?: { briefText?: string; deliveryOption?: string | null }
): GateDefinition[] {
  const result: GateDefinition[] = [];
  for (const gate of Object.values(GATES)) {
    if (gate.phase !== phase) continue;
    if (gate.conditional && !isGateRequired(gate.id, options)) continue;
    result.push(gate);
  }
  return result;
}

// ── Conditional-gate keyword triggers ──────────────────────────────────────

const SECURITY_TRIGGER_KEYWORDS = [
  // auth
  "auth", "authentication", "authorization", "login", "session", "oauth",
  "saml", "sso", "jwt", "token",
  // pii / regulated
  "pii", "gdpr", "hipaa", "phi", "ccpa", "personal data", "dpa",
  // payments
  "payment", "stripe", "billing", "card", "checkout", "pci", "wallet",
];

/**
 * Whether a conditional gate is required. Today only G3 is conditional.
 *
 * G3 fires when the brief or delivery option mentions auth, PII,
 * payments, or other sensitive surfaces. The match is case-insensitive
 * and uses whole-word boundaries where possible.
 */
export function isGateRequired(
  gateId: GateId,
  options?: { briefText?: string; deliveryOption?: string | null }
): boolean {
  const gate = GATES[gateId];
  if (!gate.conditional) return true;

  if (gateId === "G3") {
    const haystack = `${options?.briefText ?? ""}\n${options?.deliveryOption ?? ""}`.toLowerCase();
    return SECURITY_TRIGGER_KEYWORDS.some((kw) => haystack.includes(kw));
  }

  // Unknown conditional gate → safer to require it than skip silently.
  return true;
}

// ── Evaluation ─────────────────────────────────────────────────────────────

/** A single artifact handed to the gate for scoring. */
export interface GateArtifact {
  artifactId: string;
  artifactType: ArtifactType;
  payload: unknown;
  /** Provider id that generated this artifact (for GAN separation). */
  generatorProviderId?: string;
}

export interface EvaluateGateInput {
  gateId: GateId;
  artifacts: GateArtifact[];
  /**
   * Optional pre-computed scores. When supplied, the evaluator is NOT
   * called for those artifact ids — useful for tests and replays. Keys
   * are artifactId.
   */
  precomputedScores?: Record<string, number>;
}

/**
 * Evaluate a gate by running every required artifact through the F4
 * evaluator. Pass = every required artifact present AND every score
 * ≥ GATE_PASS_THRESHOLD.
 *
 * Returns an F6 GateResult — `passed` is false (and requiresHumanReview is
 * true) whenever overall confidence resolves to Low.
 */
export async function evaluateGate(input: EvaluateGateInput): Promise<GateResult> {
  const gate = GATES[input.gateId];
  if (!gate) throw new Error(`Unknown gateId: ${input.gateId}`);

  const checks: GateCheck[] = [];
  const scores: number[] = [];

  // Lazy provider — only instantiate when we actually need to call the
  // evaluator. Tests using precomputedScores can run without an API key.
  let evaluator: ReturnType<typeof getOpenAIProviderInstance> | null = null;
  const getEvaluator = () => {
    if (!evaluator) evaluator = getOpenAIProviderInstance();
    return evaluator;
  };

  // 1. Presence check — every required artifact type must be supplied.
  const presentTypes = new Set(input.artifacts.map((a) => a.artifactType));
  for (const required of gate.requiredArtifacts) {
    const present = presentTypes.has(required);
    checks.push({
      id: `present:${required}`,
      description: `Artifact "${required}" present`,
      passed: present,
      rationale: present ? "found in input" : "missing — gate cannot pass",
    });
  }

  // 2. Per-artifact rubric evaluation.
  for (const artifact of input.artifacts) {
    if (!gate.requiredArtifacts.includes(artifact.artifactType)) {
      // Artifact supplied but not required by this gate — ignore (don't penalize).
      continue;
    }
    const rubric = getRubric(artifact.artifactType);
    let overallScore: number;
    let rationale: string;
    if (input.precomputedScores && artifact.artifactId in input.precomputedScores) {
      overallScore = input.precomputedScores[artifact.artifactId];
      rationale = `precomputed score ${overallScore.toFixed(2)}`;
    } else {
      try {
        const result = await evaluateArtifact({
          artifactId: artifact.artifactId,
          artifact: artifact.payload,
          rubric,
          evaluator: getEvaluator(),
          generatorProviderId: artifact.generatorProviderId,
        });
        overallScore = result.overallScore;
        rationale = `rubric ${rubric.id} scored ${overallScore.toFixed(2)} (eval confidence ${result.confidence})`;
      } catch (err) {
        const detail = (err as Error).message ?? String(err);
        overallScore = 0;
        rationale = `evaluator failed: ${detail}`;
      }
    }
    scores.push(overallScore);
    checks.push({
      id: `score:${artifact.artifactId}`,
      description: `${artifact.artifactType} scored against ${rubric.id} (≥ ${GATE_PASS_THRESHOLD.toFixed(2)})`,
      passed: overallScore >= GATE_PASS_THRESHOLD,
      rationale,
    });
  }

  // 3. Confidence — derived from the spread of scores. High when all scores
  //    are clearly above threshold; Medium when borderline; Low when ANY
  //    required artifact is missing or the worst score is below threshold.
  const allPresent = gate.requiredArtifacts.every((t) => presentTypes.has(t));
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const meanScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  let level: "High" | "Medium" | "Low";
  let reason: string;
  if (!allPresent) {
    level = "Low";
    reason = "one or more required artifacts missing";
  } else if (minScore < GATE_PASS_THRESHOLD) {
    level = "Low";
    reason = `worst artifact score ${minScore.toFixed(2)} below threshold ${GATE_PASS_THRESHOLD.toFixed(2)}`;
  } else if (minScore < 0.75) {
    level = "Medium";
    reason = `worst score ${minScore.toFixed(2)} clears threshold but is borderline`;
  } else {
    level = "High";
    reason = `all artifacts clear threshold; mean ${meanScore.toFixed(2)}, worst ${minScore.toFixed(2)}`;
  }

  return buildGateResult({
    checks,
    confidence: { level, reason },
  });
}
