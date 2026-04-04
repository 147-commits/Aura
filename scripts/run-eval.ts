/**
 * Eval Runner — validates eval case structure and reports coverage.
 *
 * CI mode (default): validates all eval cases without API calls.
 * Manual mode (--live): sends to /api/chat and checks responses.
 *
 * Run: npx tsx scripts/run-eval.ts
 */

import {
  ALL_EVAL_CASES,
  EVAL_TARGETS,
  type EvalCase,
  type EvalCategory,
} from "../tests/eval/accuracy-eval";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${message}`);
    passed++;
  }
}

console.log("\n" + "═".repeat(60));
console.log("  AURA ACCURACY EVAL — Structure Validation");
console.log("═".repeat(60));

// ── Validate eval case structure ────────────────────────────────────────

console.log(`\nTotal eval cases: ${ALL_EVAL_CASES.length}`);

assert(ALL_EVAL_CASES.length >= 100, `At least 100 eval cases (got ${ALL_EVAL_CASES.length})`);

// Check all required fields
for (const c of ALL_EVAL_CASES) {
  assert(typeof c.id === "string" && c.id.length > 0, `${c.id}: has id`);
  assert(typeof c.input === "string" && c.input.length > 5, `${c.id}: has meaningful input`);
  assert(typeof c.expectedBehavior === "string" && c.expectedBehavior.length > 5, `${c.id}: has expected behavior`);
  assert(Array.isArray(c.forbiddenPatterns), `${c.id}: has forbidden patterns array`);
  assert(["High", "Medium", "Low"].includes(c.requiredConfidence), `${c.id}: valid confidence level`);
  assert(typeof c.requiresCitation === "boolean", `${c.id}: has citation flag`);
}

// No duplicate IDs
const ids = ALL_EVAL_CASES.map((c) => c.id);
assert(ids.length === new Set(ids).size, "No duplicate eval case IDs");

// ── Category coverage ───────────────────────────────────────────────────

console.log("\n━━━ Category Coverage ━━━");
const categories: Record<string, number> = {};
for (const c of ALL_EVAL_CASES) {
  categories[c.category] = (categories[c.category] || 0) + 1;
}

const allCategories: EvalCategory[] = ["factual", "opinion", "calculation", "advice", "creative", "hallucination-trap", "confidence-calibration"];
for (const cat of allCategories) {
  const count = categories[cat] || 0;
  const target = EVAL_TARGETS[cat];
  console.log(`  ${cat}: ${count} cases (target pass rate: ${target}%)`);
  assert(count >= 3, `${cat}: at least 3 eval cases (got ${count})`);
}

// ── Domain coverage ─────────────────────────────────────────────────────

console.log("\n━━━ Domain Coverage ━━━");
const domains: Record<string, number> = {};
for (const c of ALL_EVAL_CASES) {
  domains[c.domain] = (domains[c.domain] || 0) + 1;
}

for (const [domain, count] of Object.entries(domains).sort(([, a], [, b]) => b - a)) {
  console.log(`  ${domain}: ${count} cases`);
}

// ── Hallucination trap quality ──────────────────────────────────────────

console.log("\n━━━ Hallucination Trap Quality ━━━");
const hallucCases = ALL_EVAL_CASES.filter((c) => c.category === "hallucination-trap");
for (const c of hallucCases) {
  assert(c.forbiddenPatterns.length >= 2, `${c.id}: has at least 2 forbidden patterns`);
  assert(c.requiredConfidence === "Low", `${c.id}: requires Low confidence`);
}

// ── Confidence calibration coverage ─────────────────────────────────────

console.log("\n━━━ Confidence Distribution ━━━");
const confDist: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
for (const c of ALL_EVAL_CASES) confDist[c.requiredConfidence]++;
for (const [level, count] of Object.entries(confDist)) {
  console.log(`  ${level}: ${count} cases`);
}
assert(confDist.High > 0, "Has cases requiring High confidence");
assert(confDist.Medium > 0, "Has cases requiring Medium confidence");
assert(confDist.Low > 0, "Has cases requiring Low confidence");

// ── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`  Eval Validation: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);
