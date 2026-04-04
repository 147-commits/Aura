/**
 * Quality Report — runs all test suites and outputs a formatted summary.
 *
 * Run: npx tsx scripts/quality-report.ts
 *      or: npm run test:quality
 */

import { execSync } from "child_process";
import { ALL_EVAL_CASES, EVAL_TARGETS } from "../tests/eval/accuracy-eval";

const SUITES = [
  { name: "hallucination.test.ts", label: "Truth Engine / Hallucination" },
  { name: "skill-routing.test.ts", label: "Skill Routing" },
  { name: "skill-confidence.test.ts", label: "Skill Confidence" },
  { name: "skill-e2e.test.ts", label: "Skill E2E Integration" },
  { name: "craft-generation.test.ts", label: "Craft Generation" },
  { name: "rag-pipeline.test.ts", label: "RAG Pipeline" },
  { name: "verification-engine.test.ts", label: "Verification Engine" },
  { name: "truth-engine-v2.test.ts", label: "Truth Engine v2" },
  { name: "builder.test.ts", label: "Builder" },
];

interface SuiteResult {
  label: string;
  passed: number;
  failed: number;
  total: number;
  status: "pass" | "fail" | "error";
}

const results: SuiteResult[] = [];
let totalPassed = 0;
let totalFailed = 0;

console.log("\n" + "═".repeat(60));
console.log("  AURA QUALITY REPORT");
console.log("  " + new Date().toISOString().split("T")[0]);
console.log("═".repeat(60));

console.log("\nRunning test suites...\n");

for (const suite of SUITES) {
  try {
    const output = execSync(`npx tsx tests/${suite.name} 2>&1`, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 60000,
    });

    // Parse "X passed, Y failed, Z total" from output
    const match = output.match(/(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/);
    if (match) {
      const p = parseInt(match[1]);
      const f = parseInt(match[2]);
      results.push({ label: suite.label, passed: p, failed: f, total: p + f, status: f === 0 ? "pass" : "fail" });
      totalPassed += p;
      totalFailed += f;
    } else {
      results.push({ label: suite.label, passed: 0, failed: 0, total: 0, status: "error" });
    }
  } catch (err: any) {
    // Try to parse even from failed runs
    const output = err.stdout || err.stderr || "";
    const match = output.match(/(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/);
    if (match) {
      const p = parseInt(match[1]);
      const f = parseInt(match[2]);
      results.push({ label: suite.label, passed: p, failed: f, total: p + f, status: "fail" });
      totalPassed += p;
      totalFailed += f;
    } else {
      results.push({ label: suite.label, passed: 0, failed: 0, total: 0, status: "error" });
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────

console.log("\n━━━ Test Results ━━━\n");

for (const r of results) {
  const icon = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : "⚠️";
  console.log(`  ${icon} ${r.label.padEnd(30)} ${String(r.passed).padStart(4)} passed  ${r.failed > 0 ? `${r.failed} failed` : ""}`);
}

console.log(`\n  TOTAL: ${totalPassed} passed, ${totalFailed} failed, ${totalPassed + totalFailed} tests`);
console.log(`  STATUS: ${totalFailed === 0 ? "✅ ALL PASSING" : "❌ FAILURES DETECTED"}`);

// ── Eval Coverage ────────────────────────────────────────────────────────

console.log("\n━━━ Eval Coverage ━━━\n");
console.log(`  Total eval cases: ${ALL_EVAL_CASES.length}`);

const categories: Record<string, number> = {};
for (const c of ALL_EVAL_CASES) categories[c.category] = (categories[c.category] || 0) + 1;

for (const [cat, count] of Object.entries(categories).sort(([, a], [, b]) => b - a)) {
  const target = EVAL_TARGETS[cat as keyof typeof EVAL_TARGETS] || 0;
  console.log(`  ${cat.padEnd(25)} ${count} cases  (target: ${target}%)`);
}

console.log(`\n${"═".repeat(60)}\n`);
