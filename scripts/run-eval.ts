/**
 * Aura eval runner.
 *
 * Two modes:
 *   default (no flag)  — dry-run. Validates rubrics, golden cases, and
 *                        the accuracy-eval corpus structure. No API calls.
 *   --live             — run every golden artifact through the evaluator
 *                        and report pass/fail against its expected score.
 *
 * Run:
 *   npx tsx scripts/run-eval.ts            # dry-run (CI-safe)
 *   npx tsx scripts/run-eval.ts --live     # live evaluation with API calls
 */

import "dotenv/config";
import {
  ALL_EVAL_CASES,
  EVAL_TARGETS,
  type EvalCategory,
} from "../tests/eval/accuracy-eval";
import { GOLDEN_ARTIFACTS, type GoldenCase } from "../tests/eval/golden-artifacts";
import { ALL_RUBRICS, getRubric } from "../server/eval/rubrics";
import { validateRubricWeights } from "../server/eval/rubric-schema";
import { evaluateArtifact } from "../server/eval/evaluator";
import { selectProvider, getOpenAIProviderInstance } from "../server/providers/provider-registry";
import type { AIProvider } from "../server/providers/ai-provider-interface";

const args = new Set(process.argv.slice(2));
const LIVE = args.has("--live");

let passed = 0;
let failed = 0;

function bar() { return "═".repeat(64); }
function hr() { return "─".repeat(64); }

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
    process.exitCode = 1;
  }
}

console.log("\n" + bar());
console.log(`  AURA EVAL — ${LIVE ? "live evaluator run" : "dry-run (structure + rubric validation)"}`);
console.log(bar());

// ─── Rubrics ────────────────────────────────────────────────────────────────

console.log("\n━━━ Rubric validation ━━━");
for (const rubric of ALL_RUBRICS) {
  try {
    validateRubricWeights(rubric);
    const sum = rubric.criteria.reduce((s, c) => s + c.weight, 0);
    assert(
      Math.abs(sum - 1.0) < 1e-6,
      `${rubric.id}: weights sum to 1.0 (got ${sum.toFixed(6)}, ${rubric.criteria.length} criteria)`
    );
    // Scoring guide completeness
    let guidesOk = true;
    for (const c of rubric.criteria) {
      const g = c.scoringGuide;
      if (!g.excellent || !g.good || !g.acceptable || !g.poor) {
        guidesOk = false;
        console.error(`    ${rubric.id}:${c.id} missing scoring-guide level`);
      }
    }
    assert(guidesOk, `${rubric.id}: every criterion has 4-level scoring guide`);
  } catch (err: any) {
    assert(false, `${rubric.id}: ${err.message}`);
  }
}

// ─── Golden artifacts ──────────────────────────────────────────────────────

console.log("\n━━━ Golden artifacts ━━━");
assert(GOLDEN_ARTIFACTS.length === 20, `Exactly 20 golden cases (got ${GOLDEN_ARTIFACTS.length})`);

const byType: Record<string, GoldenCase[]> = {};
for (const g of GOLDEN_ARTIFACTS) (byType[g.artifactType] ||= []).push(g);
for (const t of ["prd", "adr", "project-charter", "chat-response"]) {
  assert((byType[t] || []).length === 5, `5 golden cases for ${t} (got ${(byType[t] || []).length})`);
}

// ID uniqueness + rubric existence
const goldenIds = new Set<string>();
for (const g of GOLDEN_ARTIFACTS) {
  if (goldenIds.has(g.id)) { assert(false, `Duplicate golden id: ${g.id}`); continue; }
  goldenIds.add(g.id);
  try {
    const r = getRubric(g.artifactType);
    assert(r !== undefined, `${g.id}: rubric exists for artifactType "${g.artifactType}"`);
  } catch (err: any) {
    assert(false, `${g.id}: ${err.message}`);
  }
  assert(g.artifact.length > 0, `${g.id}: artifact content present`);
  assert(g.expectedScore >= 0 && g.expectedScore <= 1, `${g.id}: expectedScore in [0,1]`);
  assert(g.direction === "min" || g.direction === "max", `${g.id}: direction is min|max`);
}

// ─── Legacy accuracy-eval structure (kept for parity with prior runner) ────

console.log("\n━━━ Accuracy-eval corpus ━━━");
assert(ALL_EVAL_CASES.length >= 100, `Legacy eval corpus has ≥100 cases (got ${ALL_EVAL_CASES.length})`);
const categoryCounts: Record<string, number> = {};
for (const c of ALL_EVAL_CASES) categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
const allCategories: EvalCategory[] = [
  "factual", "opinion", "calculation", "advice", "creative", "hallucination-trap", "confidence-calibration",
];
for (const cat of allCategories) {
  const count = categoryCounts[cat] || 0;
  const target = EVAL_TARGETS[cat];
  console.log(`  ${cat}: ${count} cases (target pass rate: ${target}%)`);
  assert(count >= 3, `${cat}: at least 3 cases`);
}

// ─── GAN-separation unit check (runs in both modes) ────────────────────────

async function main() {
console.log("\n━━━ GAN-separation guard ━━━");
try {
  const fakeEvaluator: AIProvider = {
    id: "openai",
    name: "OpenAI",
    chat: async () => ({ content: "", model: "fake" }),
    // eslint-disable-next-line require-yield
    async *stream() { /* unreachable */ },
    embed: async () => [],
    countTokens: () => 0,
  };
  await evaluateArtifact({
    artifactId: "gan-test",
    artifact: "irrelevant",
    rubric: ALL_RUBRICS[0],
    evaluator: fakeEvaluator,
    generatorProviderId: "openai", // same as evaluator.id → must throw
  });
  assert(false, "evaluator refuses when generator id matches evaluator id");
} catch (err: any) {
  const msg = String(err?.message ?? "");
  assert(
    msg.includes("GAN separation violated"),
    `evaluator refuses when generator id matches evaluator id (got: ${msg.slice(0, 60)})`
  );
}

if (!LIVE) {
  console.log("\n━━━ Dry-run complete ━━━");
  console.log(`Pass --live to run ${GOLDEN_ARTIFACTS.length} golden cases through the evaluator (makes API calls).`);
  console.log("\n" + bar());
  console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(bar() + "\n");
  process.exit(failed === 0 ? 0 : 1);
}

// ─── Live evaluation ───────────────────────────────────────────────────────

if (!process.env.OPENAI_API_KEY) {
  console.error("\n--live requires OPENAI_API_KEY in the environment.");
  process.exit(1);
}

// The golden artifacts are hand-written, not LLM-generated, so there is
// no real generator to separate from here. The GAN-separation guard is
// still exercised above with a synthetic matching id.
//
// When the Virtual Company Engine starts generating live artifacts, the
// caller of evaluateArtifact must pass `generatorProviderId` to assert
// the pipeline's generator differs from the evaluator. Our policy: the
// evaluator runs on OpenAI; the generator runs on Anthropic (skill tier)
// when available, which is the strongest separation we can get.
const evaluator = getOpenAIProviderInstance();
const assumedGenerator = selectProvider("skill");

console.log(`\nEvaluator provider:   ${evaluator.id}:gpt-4o-mini`);
console.log(`Pipeline generator:   ${assumedGenerator.id} (skill tier) — GAN-separated: ${assumedGenerator.id !== evaluator.id ? "yes" : "WARN: same provider, model-level only"}\n`);
console.log(hr());
console.log(`  Scoring ${GOLDEN_ARTIFACTS.length} golden cases`);
console.log(hr());

interface RunRow {
  id: string;
  artifactType: string;
  direction: "min" | "max";
  expected: number;
  actual: number;
  pass: boolean;
  confidence: string;
}
const rows: RunRow[] = [];

for (const g of GOLDEN_ARTIFACTS) {
  const rubric = getRubric(g.artifactType);
  try {
    const result = await evaluateArtifact({
      artifactId: g.id,
      artifact: g.artifact,
      rubric,
      evaluator,
      // No generatorProviderId — goldens are hand-written, not generated.
    });
    const actual = result.overallScore;
    const pass = g.direction === "min" ? actual >= g.expectedScore : actual <= g.expectedScore;
    rows.push({
      id: g.id,
      artifactType: g.artifactType,
      direction: g.direction,
      expected: g.expectedScore,
      actual,
      pass,
      confidence: result.confidence,
    });
    const mark = pass ? "PASS" : "FAIL";
    const cmp = g.direction === "min" ? ">=" : "<=";
    console.log(
      `  ${mark}: ${g.id.padEnd(22)} score=${actual.toFixed(2)} ${cmp} ${g.expectedScore.toFixed(2)}  (${result.confidence})  ${g.label}`
    );
    if (pass) passed++; else { failed++; process.exitCode = 1; }
  } catch (err: any) {
    console.error(`  ERR : ${g.id} — ${err.message}`);
    failed++;
    process.exitCode = 1;
  }
}

// ─── Aggregate ─────────────────────────────────────────────────────────────

console.log("\n" + hr());
console.log("  Per-type averages");
console.log(hr());
const types = Array.from(new Set(rows.map((r) => r.artifactType)));
for (const t of types) {
  const rowsT = rows.filter((r) => r.artifactType === t);
  const strong = rowsT.filter((r) => r.direction === "min");
  const weak = rowsT.filter((r) => r.direction === "max");
  const strongAvg = strong.length ? strong.reduce((a, b) => a + b.actual, 0) / strong.length : 0;
  const weakAvg = weak.length ? weak.reduce((a, b) => a + b.actual, 0) / weak.length : 0;
  console.log(`  ${t.padEnd(18)} strong avg=${strongAvg.toFixed(2)}   weak avg=${weakAvg.toFixed(2)}`);
}

console.log("\n" + bar());
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(bar() + "\n");
process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("run-eval crashed:", err);
  process.exit(1);
});
