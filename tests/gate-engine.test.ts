/**
 * Gate engine test — pure logic, no DB or live evaluator.
 *
 * Asserts:
 *   - GATES has G1–G5 with correct phase + required artifacts
 *   - getRequiredGates returns gates for a phase, omitting conditional G3
 *     unless triggered
 *   - isGateRequired("G3") fires on auth/PII/payments triggers
 *   - evaluateGate passes when every required artifact present + scores
 *     ≥ 0.65; fails when any score below threshold or when artifact missing
 *   - Low-confidence gate result triggers requiresHumanReview (F6 policy)
 *
 * Uses precomputedScores so we never call the live evaluator.
 *
 * Run: npx tsx tests/gate-engine.test.ts
 */

import {
  GATES,
  GATE_PASS_THRESHOLD,
  getRequiredGates,
  isGateRequired,
  evaluateGate,
  type GateArtifact,
} from "../server/orchestrator/gate-engine";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

async function main(): Promise<void> {
  console.log("\n=== gate-engine ===\n");

  // ─── GATES registry shape ─────────────────────────────────────────────
  {
    const ids = Object.keys(GATES).sort();
    assert(JSON.stringify(ids) === JSON.stringify(["G1","G2","G3","G4","G5"]),
      "GATES has G1..G5");
    assert(GATES.G1.phase === "discovery" && GATES.G1.nextPhase === "design",
      "G1: discovery → design");
    assert(GATES.G2.phase === "design" && GATES.G2.nextPhase === "planning",
      "G2: design → planning");
    assert(GATES.G3.conditional === true, "G3 is conditional");
    assert(GATES.G4.phase === "implementation" && GATES.G4.nextPhase === "verification",
      "G4: implementation → verification");
    assert(GATES.G5.phase === "verification" && GATES.G5.nextPhase === "release",
      "G5: verification → release");
    assert(GATES.G1.requiredArtifacts.includes("project-charter") &&
           GATES.G1.requiredArtifacts.includes("prd"),
      "G1 requires charter + PRD");
    assert(GATES.G3.requiredArtifacts.includes("threat-model"),
      "G3 requires threat-model");
  }

  // ─── getRequiredGates ─────────────────────────────────────────────────
  {
    const discovery = getRequiredGates("discovery");
    assert(discovery.length === 1 && discovery[0].id === "G1",
      "discovery phase → G1 only");

    // Design with no security trigger → only G2 (G3 omitted).
    const designNoSec = getRequiredGates("design", { briefText: "todo app for hobbyists" });
    assert(designNoSec.map((g) => g.id).join(",") === "G2",
      "design without security trigger → G2 only");

    // Design with payments trigger → G2 + G3.
    const designPay = getRequiredGates("design", { briefText: "checkout flow with Stripe" });
    const ids = designPay.map((g) => g.id).sort();
    assert(JSON.stringify(ids) === JSON.stringify(["G2", "G3"]),
      `design with payments trigger → [G2, G3] (got ${JSON.stringify(ids)})`);

    // Design with auth trigger → G2 + G3.
    const designAuth = getRequiredGates("design", { briefText: "OAuth login with JWT" });
    assert(designAuth.some((g) => g.id === "G3"), "design with auth trigger includes G3");

    // Verification → G5 only.
    const verif = getRequiredGates("verification");
    assert(verif.length === 1 && verif[0].id === "G5", "verification phase → G5 only");
  }

  // ─── isGateRequired (G3 conditional) ──────────────────────────────────
  {
    assert(isGateRequired("G1"), "non-conditional gate is always required");
    assert(isGateRequired("G3", { briefText: "auth and PII" }), "G3: 'auth and PII' triggers");
    assert(isGateRequired("G3", { briefText: "Process payments via Stripe" }), "G3: payments triggers");
    assert(isGateRequired("G3", { briefText: "Handle GDPR data" }), "G3: GDPR triggers");
    assert(!isGateRequired("G3", { briefText: "todo app for hobbyists, no accounts" }),
      "G3: hobby todo app does NOT trigger");
    assert(!isGateRequired("G3"), "G3: empty brief does NOT trigger");
    assert(isGateRequired("G3", { deliveryOption: "stripe-billing-package" }),
      "G3: deliveryOption text also matched");
  }

  // ─── evaluateGate: all required present, all pass threshold ───────────
  {
    const charter: GateArtifact = {
      artifactId: "art-charter",
      artifactType: "project-charter",
      payload: { vision: "ship MVP" },
    };
    const prd: GateArtifact = {
      artifactId: "art-prd",
      artifactType: "prd",
      payload: { problem: "x" },
    };
    const result = await evaluateGate({
      gateId: "G1",
      artifacts: [charter, prd],
      precomputedScores: { "art-charter": 0.85, "art-prd": 0.80 },
    });
    assert(result.passed === true, "G1: all artifacts present + scores ≥ 0.65 → passed");
    assert(result.requiresHumanReview === false, "G1: high confidence → no human review");
    assert(result.confidence.level === "High", `G1: confidence High (got ${result.confidence.level})`);
    const presenceChecks = result.checks.filter((c) => c.id.startsWith("present:"));
    assert(presenceChecks.length === 2 && presenceChecks.every((c) => c.passed),
      "G1: both presence checks passed");
    const scoreChecks = result.checks.filter((c) => c.id.startsWith("score:"));
    assert(scoreChecks.length === 2 && scoreChecks.every((c) => c.passed),
      "G1: both score checks passed");
  }

  // ─── evaluateGate: missing required artifact ──────────────────────────
  {
    const result = await evaluateGate({
      gateId: "G1",
      artifacts: [
        { artifactId: "art-charter", artifactType: "project-charter", payload: {} },
        // PRD missing
      ],
      precomputedScores: { "art-charter": 0.9 },
    });
    assert(result.passed === false, "G1: missing PRD → passed:false");
    assert(result.requiresHumanReview === true, "G1: missing artifact → requires human review (Low confidence)");
    assert(result.confidence.level === "Low", "G1: missing → Low confidence");
    const missingPresence = result.checks.find((c) => c.id === "present:prd");
    assert(missingPresence !== undefined && !missingPresence.passed,
      "G1: presence check for missing PRD failed");
  }

  // ─── evaluateGate: one score below threshold ──────────────────────────
  {
    const result = await evaluateGate({
      gateId: "G1",
      artifacts: [
        { artifactId: "a", artifactType: "project-charter", payload: {} },
        { artifactId: "b", artifactType: "prd", payload: {} },
      ],
      precomputedScores: { a: 0.85, b: 0.40 }, // b below 0.65
    });
    assert(result.passed === false, "G1: one below threshold → passed:false");
    assert(result.requiresHumanReview === true, "G1: below threshold → human review");
    assert(result.confidence.level === "Low", "G1: low score → Low confidence");
    const scoreCheck = result.checks.find((c) => c.id === "score:b");
    assert(scoreCheck !== undefined && !scoreCheck.passed,
      "G1: score check for b failed");
  }

  // ─── evaluateGate: borderline (above 0.65, below 0.75) → Medium, passes ─
  // F6 policy: only Low triggers requiresHumanReview, so Medium gates that
  // satisfy every check still pass.
  {
    const result = await evaluateGate({
      gateId: "G1",
      artifacts: [
        { artifactId: "a", artifactType: "project-charter", payload: {} },
        { artifactId: "b", artifactType: "prd", payload: {} },
      ],
      precomputedScores: { a: 0.70, b: 0.68 },
    });
    assert(result.confidence.level === "Medium", "borderline scores → Medium confidence");
    assert(result.requiresHumanReview === false, "Medium confidence → no human review");
    assert(result.passed === true, "borderline (both ≥ 0.65) passes; Medium does not block");
  }

  // ─── GATE_PASS_THRESHOLD constant ─────────────────────────────────────
  assert(GATE_PASS_THRESHOLD === 0.65, "GATE_PASS_THRESHOLD = 0.65");

  console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
