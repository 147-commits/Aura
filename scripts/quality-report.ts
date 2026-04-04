/**
 * Aura Quality Metrics Dashboard
 *
 * Runs all test suites and outputs a comprehensive quality report.
 * Track this weekly — it's the single source of truth for quality.
 *
 * Run: npx tsx scripts/quality-report.ts
 *      or: npm run test:quality
 */

import { execSync } from "child_process";
import { ALL_EVAL_CASES, EVAL_TARGETS, type EvalCategory } from "../tests/eval/accuracy-eval";

const SUITES = [
  { name: "hallucination.test.ts", label: "Truth Engine / Hallucination", component: "Truth Engine" },
  { name: "skill-routing.test.ts", label: "Skill Routing", component: "Skills" },
  { name: "skill-confidence.test.ts", label: "Skill Confidence", component: "Skills" },
  { name: "skill-e2e.test.ts", label: "Skill E2E Integration", component: "Skills" },
  { name: "craft-generation.test.ts", label: "Craft Generation", component: "Crafts" },
  { name: "rag-pipeline.test.ts", label: "RAG Pipeline", component: "Truth Engine v2" },
  { name: "verification-engine.test.ts", label: "Verification Engine", component: "Truth Engine v2" },
  { name: "truth-engine-v2.test.ts", label: "Truth Engine v2", component: "Truth Engine v2" },
  { name: "builder.test.ts", label: "Builder", component: "Builder" },
  { name: "phase-checklist.test.ts", label: "Phase Checklist", component: "Cross-Phase" },
];

interface SuiteResult {
  label: string;
  component: string;
  passed: number;
  failed: number;
  status: "pass" | "fail" | "error";
}

const results: SuiteResult[] = [];
let totalPassed = 0;
let totalFailed = 0;

const today = new Date().toISOString().split("T")[0];

console.log();
console.log("═".repeat(60));
console.log(`  AURA QUALITY REPORT — ${today}`);
console.log("═".repeat(60));

// ── Run Test Suites ─────────────────────────────────────────────────────────

console.log("\nRunning test suites...\n");

for (const suite of SUITES) {
  try {
    const output = execSync(`npx tsx tests/${suite.name} 2>&1`, {
      cwd: process.cwd(), encoding: "utf-8", timeout: 60000,
    });
    const match = output.match(/(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/);
    if (match) {
      const p = parseInt(match[1]); const f = parseInt(match[2]);
      results.push({ label: suite.label, component: suite.component, passed: p, failed: f, status: f === 0 ? "pass" : "fail" });
      totalPassed += p; totalFailed += f;
    } else {
      results.push({ label: suite.label, component: suite.component, passed: 0, failed: 0, status: "error" });
    }
  } catch (err: any) {
    const output = err.stdout || err.stderr || "";
    const match = output.match(/(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/);
    if (match) {
      const p = parseInt(match[1]); const f = parseInt(match[2]);
      results.push({ label: suite.label, component: suite.component, passed: p, failed: f, status: "fail" });
      totalPassed += p; totalFailed += f;
    } else {
      results.push({ label: suite.label, component: suite.component, passed: 0, failed: 0, status: "error" });
    }
  }
}

// ── Test Results ────────────────────────────────────────────────────────────

console.log(`Tests: ${totalPassed} passing / ${totalFailed} failing ${totalFailed === 0 ? "✅" : "❌"}`);

console.log("\n━━━ Test Results by Suite ━━━\n");
for (const r of results) {
  const icon = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : "⚠️";
  console.log(`  ${icon} ${r.label.padEnd(30)} ${String(r.passed).padStart(4)} passed  ${r.failed > 0 ? `${r.failed} failed` : ""}`);
}

// ── Component Coverage ──────────────────────────────────────────────────────

console.log("\n━━━ Test Results by Component ━━━\n");
const components: Record<string, { passed: number; failed: number }> = {};
for (const r of results) {
  if (!components[r.component]) components[r.component] = { passed: 0, failed: 0 };
  components[r.component].passed += r.passed;
  components[r.component].failed += r.failed;
}
for (const [comp, data] of Object.entries(components).sort(([, a], [, b]) => b.passed - a.passed)) {
  const icon = data.failed === 0 ? "✅" : "❌";
  console.log(`  ${icon} ${comp.padEnd(20)} ${String(data.passed).padStart(5)} tests`);
}

// ── Eval Coverage by Category ───────────────────────────────────────────────

console.log("\n━━━ Eval Coverage by Category ━━━\n");

const catCounts: Record<string, number> = {};
for (const c of ALL_EVAL_CASES) catCounts[c.category] = (catCounts[c.category] || 0) + 1;

const allCats: EvalCategory[] = ["factual", "opinion", "calculation", "advice", "creative", "hallucination-trap", "confidence-calibration"];
for (const cat of allCats) {
  const count = catCounts[cat] || 0;
  const target = EVAL_TARGETS[cat];
  const icon = count >= 5 ? "✅" : "⚠️";
  console.log(`  ${icon} ${cat.padEnd(25)} ${String(count).padStart(3)} cases  (target pass rate: ${target}%)`);
}

// ── Confidence Calibration ──────────────────────────────────────────────────

console.log("\n━━━ Confidence Calibration ━━━\n");

const confDist: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
for (const c of ALL_EVAL_CASES) confDist[c.requiredConfidence]++;

const confTotal = ALL_EVAL_CASES.length;
console.log(`  When Aura should say High:   ${confDist.High} cases (${Math.round(confDist.High / confTotal * 100)}% of eval set)`);
console.log(`  When Aura should say Medium: ${confDist.Medium} cases (${Math.round(confDist.Medium / confTotal * 100)}% of eval set)`);
console.log(`  When Aura should say Low:    ${confDist.Low} cases (${Math.round(confDist.Low / confTotal * 100)}% of eval set)`);

// ── Domain Coverage ─────────────────────────────────────────────────────────

console.log("\n━━━ Eval Coverage by Domain ━━━\n");

const domainCounts: Record<string, number> = {};
for (const c of ALL_EVAL_CASES) domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1;

const sortedDomains = Object.entries(domainCounts).sort(([, a], [, b]) => b - a);
for (const [domain, count] of sortedDomains) {
  const icon = count >= 5 ? "✅" : "⚠️";
  console.log(`  ${icon} ${domain.padEnd(15)} ${String(count).padStart(3)} cases`);
}

const weakestDomain = sortedDomains[sortedDomains.length - 1];

// ── Skills Performance ──────────────────────────────────────────────────────

console.log("\n━━━ Skills Coverage ━━━\n");

const skillDomains: Record<string, string[]> = {
  engineering: ["engineering-architect", "engineering-code-reviewer", "security-auditor", "fullstack-engineer"],
  marketing: ["gtm-strategist", "content-strategist", "growth-marketer"],
  product: ["product-manager", "ux-researcher", "roadmap-planner"],
  finance: ["financial-analyst", "saas-metrics-coach"],
  leadership: ["startup-ceo", "cto-advisor", "okr-coach"],
  operations: ["senior-pm", "scrum-master", "technical-writer"],
};

for (const [domain, skills] of Object.entries(skillDomains)) {
  const evalCount = domainCounts[domain] || 0;
  console.log(`  ${domain.padEnd(15)} ${skills.length} skills, ${evalCount} eval cases`);
}

// ── User Feedback (placeholder — needs DB) ──────────────────────────────────

console.log("\n━━━ User Feedback (requires running server) ━━━\n");
console.log("  To view feedback: GET /api/feedback/summary");
console.log("  Thumbs up/down stored in feedback table");
console.log("  Review thumbs-down quarterly to improve prompts");

// ── Action Items ────────────────────────────────────────────────────────────

console.log("\n━━━ Recommended Actions ━━━\n");

if (totalFailed > 0) {
  console.log(`  ❌ FIX: ${totalFailed} test failures detected — investigate immediately`);
}

if (weakestDomain && (domainCounts[weakestDomain[0]] || 0) < 5) {
  console.log(`  ⚠️  ADD: More eval cases for "${weakestDomain[0]}" domain (only ${weakestDomain[1]} cases)`);
}

const missingCitation = ALL_EVAL_CASES.filter((c) => c.requiresCitation).length;
if (missingCitation < 5) {
  console.log(`  ⚠️  ADD: More eval cases requiring citations (only ${missingCitation} cases)`);
}

if (totalFailed === 0) {
  console.log("  ✅ All tests passing — system healthy");
}

console.log("  📋 Run evals with live API: npx tsx scripts/run-eval.ts --live");
console.log("  📋 Review PROMPT_CHANGELOG.md before any prompt changes");

// ── Summary ─────────────────────────────────────────────────────────────────

console.log();
console.log("═".repeat(60));
console.log(`  TOTAL: ${totalPassed + totalFailed} tests | ${ALL_EVAL_CASES.length} eval cases`);
console.log(`  STATUS: ${totalFailed === 0 ? "✅ HEALTHY" : "❌ NEEDS ATTENTION"}`);
console.log("═".repeat(60));
console.log();
