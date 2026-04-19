/**
 * Truth-First Engine — pipeline-layer tests.
 *
 * Asserts:
 *   - Five named principles + buildTruthFirstPreamble vary by surface
 *   - extractConfidence parses the canonical line shape
 *   - Agent prompt builder injects the Truth-First preamble
 *   - Artifact Zod schemas REJECT missing/invalid confidence
 *   - Low-confidence gates flip into human-review mode
 *   - Low-confidence agent decisions trigger requiresHumanReview()
 *
 * Run: npx tsx tests/truth-first.test.ts
 */

import {
  TRUTH_FIRST_PRINCIPLES,
  buildTruthFirstPreamble,
  extractConfidence,
  type TruthFirstContext,
} from "../server/truth-first/principles";
import {
  ConfidenceFieldSchema,
  GateResultSchema,
  AgentDecisionSchema,
  withConfidence,
  buildGateResult,
  requiresHumanReview,
} from "../server/truth-first/artifact-schema";
import { buildAgentSystemPrompt, hasTruthFirstPreamble } from "../server/agents/prompt-builder";
import { ctoAdvisor } from "../server/agents/advisors/cto-advisor";
import { z } from "zod";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

console.log("\n=== Truth-First Engine ===\n");

// ─── Principles registry ───────────────────────────────────────────────────
{
  const keys = Object.keys(TRUTH_FIRST_PRINCIPLES).sort();
  assert(
    JSON.stringify(keys) === JSON.stringify(["antiBlabbing", "antiHallucination", "confidence", "escalationHonesty", "intentMatching"]),
    "TRUTH_FIRST_PRINCIPLES has the 5 named keys"
  );
  for (const k of keys) {
    const text = (TRUTH_FIRST_PRINCIPLES as Record<string, string>)[k];
    assert(text.length > 30, `principle "${k}" has non-trivial body`);
  }
}

// ─── buildTruthFirstPreamble varies by surface ─────────────────────────────
{
  const contexts: TruthFirstContext[] = ["chat", "agent", "orchestrator", "evaluator", "gate"];
  const preambles = contexts.map(buildTruthFirstPreamble);
  for (let i = 0; i < contexts.length; i++) {
    const p = preambles[i];
    assert(p.includes("Truth-First Engine"), `${contexts[i]}: contains "Truth-First Engine"`);
    assert(p.includes("Confidence: High|Medium|Low"), `${contexts[i]}: includes confidence-format rule`);
    assert(p.includes("Never invent"), `${contexts[i]}: includes anti-hallucination clause`);
  }
  // Distinct intros / outros per surface
  const unique = new Set(preambles).size;
  assert(unique === contexts.length, `each surface produces a distinct preamble (got ${unique}/${contexts.length})`);
  // Agent-surface preamble must explicitly mention the artifact-confidence requirement
  const agentP = buildTruthFirstPreamble("agent");
  assert(agentP.includes("confidence object"), "agent preamble: requires confidence object");
  assert(agentP.includes("clarification-needed"), "agent preamble: mentions clarification-needed escape hatch");
  // Gate-surface preamble must say Low never auto-passes
  const gateP = buildTruthFirstPreamble("gate");
  assert(gateP.includes("never auto-pass") || gateP.includes("never auto pass"), "gate preamble: 'Low never auto-pass' rule present");
}

// ─── extractConfidence parsing ─────────────────────────────────────────────
{
  const r1 = extractConfidence("Some answer here.\nConfidence: High (well-documented consensus)");
  assert(r1.found && r1.confidence === "High" && r1.reason === "well-documented consensus", "extract: High + reason parsed");
  assert(r1.cleanContent === "Some answer here.", "extract: confidence line stripped");

  const r2 = extractConfidence("Body.\nConfidence: medium (partial information)");
  assert(r2.confidence === "Medium", "extract: lowercase 'medium' normalized");

  const r3 = extractConfidence("Body.\nConfidence: Low");
  assert(r3.confidence === "Low" && r3.reason === "" && r3.found, "extract: Low without reason still parses, reason empty");

  const r4 = extractConfidence("No confidence line here at all.");
  assert(!r4.found, "extract: missing line → found:false");
  assert(r4.confidence === "Medium", "extract: missing line defaults to Medium");
  assert(r4.cleanContent === "No confidence line here at all.", "extract: missing line returns content untouched (trimmed)");

  const r5 = extractConfidence("Body.\nConfidence: bogus (whatever)");
  assert(!r5.found, "extract: invalid level → found:false");
}

// ─── Agent prompt builder ──────────────────────────────────────────────────
{
  const composed = buildAgentSystemPrompt(ctoAdvisor);
  assert(hasTruthFirstPreamble(composed), "agent prompt: includes Truth-First preamble marker");
  assert(composed.includes("CTO Advisor"), "agent prompt: includes agent name in role intro");
  assert(composed.includes(ctoAdvisor.systemPrompt), "agent prompt: includes the authored systemPrompt verbatim");
  assert(composed.indexOf("Truth-First Engine") < composed.indexOf("── Authored prompt ──"),
    "agent prompt: preamble appears before the authored prompt");
  assert(composed.includes("confidence object"), "agent prompt: agent surface enforces confidence object");
}

// ─── Confidence Zod schema ─────────────────────────────────────────────────
{
  const ok = ConfidenceFieldSchema.safeParse({ level: "High", reason: "well documented" });
  assert(ok.success, "ConfidenceField: valid input parses");

  const tooShort = ConfidenceFieldSchema.safeParse({ level: "High", reason: "too" });
  assert(!tooShort.success, "ConfidenceField: rejects reason shorter than 10 chars");

  const badLevel = ConfidenceFieldSchema.safeParse({ level: "Definitely", reason: "doesn't matter here" });
  assert(!badLevel.success, "ConfidenceField: rejects unknown level");

  const missingLevel = ConfidenceFieldSchema.safeParse({ reason: "ten characters here" });
  assert(!missingLevel.success, "ConfidenceField: rejects missing level");

  const extraField = ConfidenceFieldSchema.safeParse({ level: "Low", reason: "ten characters here", extra: "no" });
  assert(!extraField.success, "ConfidenceField: strict mode rejects extra fields");
}

// ─── withConfidence wraps an artifact schema ───────────────────────────────
{
  const PrdLite = withConfidence(z.object({ title: z.string().min(1), body: z.string().min(1) }));

  const ok = PrdLite.safeParse({
    title: "Pipeline gate enforcement",
    body: "Some text.",
    confidence: { level: "High", reason: "well documented" },
  });
  assert(ok.success, "withConfidence: artifact with confidence parses");

  const noConf = PrdLite.safeParse({ title: "x", body: "y" });
  assert(!noConf.success, "withConfidence: artifact without confidence is REJECTED");

  const noBody = PrdLite.safeParse({
    title: "x",
    confidence: { level: "High", reason: "well documented" },
  });
  assert(!noBody.success, "withConfidence: artifact missing required body field still rejected");
}

// ─── GateResult: Low confidence triggers human review ──────────────────────
{
  // All checks pass + High confidence → passed:true, no review
  const high = buildGateResult({
    checks: [{ id: "c1", description: "x", passed: true, rationale: "fine" }],
    confidence: { level: "High", reason: "all rubric criteria satisfied" },
  });
  assert(high.passed === true, "gate: all-pass + High → passed:true");
  assert(high.requiresHumanReview === false, "gate: High → no human review");

  // All checks pass but Low confidence → passed:false, surface to human
  const low = buildGateResult({
    checks: [{ id: "c1", description: "x", passed: true, rationale: "fine" }],
    confidence: { level: "Low", reason: "evaluator unsure about scope" },
  });
  assert(low.passed === false, "gate: all-pass + Low → passed:false (do not auto-pass)");
  assert(low.requiresHumanReview === true, "gate: Low → requires human review");

  // Failing check + High confidence → passed:false, no review
  const failed = buildGateResult({
    checks: [
      { id: "c1", description: "x", passed: true, rationale: "fine" },
      { id: "c2", description: "y", passed: false, rationale: "missing acceptance criteria" },
    ],
    confidence: { level: "High", reason: "checks themselves are clear" },
  });
  assert(failed.passed === false, "gate: failing check → passed:false");
  assert(failed.requiresHumanReview === false, "gate: failing check + High → no review (just a clear fail)");

  // Schema-level validation
  const schemaOk = GateResultSchema.safeParse(low);
  assert(schemaOk.success, "GateResultSchema: buildGateResult output round-trips through Zod");

  const noChecks = GateResultSchema.safeParse({
    passed: true,
    confidence: { level: "High", reason: "no reason given here yes" },
    checks: [],
    requiresHumanReview: false,
  });
  assert(!noChecks.success, "GateResultSchema: rejects empty checks array");
}

// ─── AgentDecision schema ──────────────────────────────────────────────────
{
  const ok = AgentDecisionSchema.safeParse({
    question: "Which agents to activate for Discovery?",
    decision: "ux-researcher + financial-analyst",
    reasoning: "wedge-customer interviews + cost model both required",
    confidence: { level: "High", reason: "wedge spec is explicit" },
    reversible: true,
  });
  assert(ok.success, "AgentDecision: valid input parses");

  const noConf = AgentDecisionSchema.safeParse({
    question: "x", decision: "y", reasoning: "z", reversible: true,
  });
  assert(!noConf.success, "AgentDecision: missing confidence is rejected");

  const bogusReversible = AgentDecisionSchema.safeParse({
    question: "x", decision: "y", reasoning: "z",
    confidence: { level: "High", reason: "ten chars yes" },
    reversible: "sometimes",
  });
  assert(!bogusReversible.success, "AgentDecision: rejects non-boolean reversible");
}

// ─── requiresHumanReview policy ────────────────────────────────────────────
{
  assert(requiresHumanReview("Low") === true, "policy: Low → human review");
  assert(requiresHumanReview("Medium") === false, "policy: Medium → no auto review");
  assert(requiresHumanReview("High") === false, "policy: High → no auto review");
}

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
