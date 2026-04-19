/**
 * Intent classifier — rule-layer tests (no API).
 *
 * Run: npx tsx tests/intent-classifier.test.ts
 */

import {
  classifyIntent,
  classifyIntentRule,
} from "../server/orchestrator/intent-classifier";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

async function main(): Promise<void> {
  console.log("\n=== intent-classifier (rule layer) ===\n");

  // ─── Strong build ──────────────────────────────────────────────────────
  {
    const cases = [
      "build me a todo app",
      "build a chat client for my team",
      "Build the dashboard for tracking signups",
      "create me a landing page that converts",
      "create a SaaS for solo founders",
      "spin up a Stripe integration",
      "ship a working mvp this weekend",
      "deploy a simple API for my form",
      "scaffold a Next.js project with auth",
      "Make me a CLI tool for resizing images",
      "implement a cron job that sends emails",
      "code up a small utility for log filtering",
    ];
    for (const msg of cases) {
      const r = classifyIntentRule(msg);
      assert(r?.intent === "build" && r.confidence === "High",
        `build: "${msg}" → build/High (got ${r?.intent}/${r?.confidence})`);
      assert(r?.layer === "rule", `build: "${msg}" decided at rule layer`);
    }
  }

  // ─── Strong chat (questions) ──────────────────────────────────────────
  {
    const cases = [
      "what is TypeScript",
      "What is the speed of light?",
      "How do I deploy my Express app to Render?",
      "Why does Postgres prefer cooperative locking",
      "When was the WWW invented",
      "Where should I store user secrets",
      "Who created the OKR framework",
      "Can you explain monads",
      "Should I use MongoDB or Postgres",
      "Is this code idiomatic",
    ];
    for (const msg of cases) {
      const r = classifyIntentRule(msg);
      assert(r?.intent === "chat" && r.confidence === "High",
        `question: "${msg}" → chat/High (got ${r?.intent}/${r?.confidence})`);
      assert(r?.layer === "rule", `question: "${msg}" decided at rule layer`);
    }
  }

  // ─── Build-extend ──────────────────────────────────────────────────────
  {
    const cases = [
      "add to my existing dashboard",
      "extend my SaaS with billing",
      "update the landing page copy",
      "modify the existing checkout flow",
      "fix my login bug in the app",
      "iterate on my pitch deck content",
      "v2 of my onboarding emails",
      "follow up on the previous PRD",
      "continue building the chat feature",
      "build on top of the current auth",
    ];
    for (const msg of cases) {
      const r = classifyIntentRule(msg);
      assert(r?.intent === "build-extend" && r.confidence === "High",
        `extend: "${msg}" → build-extend/High (got ${r?.intent}/${r?.confidence})`);
    }
  }

  // ─── Short, no build keyword → chat (Medium) ──────────────────────────
  {
    const cases = [
      "tell me about Aura",
      "thanks for the response",
      "great, sounds good",
      "yes please continue",
      "I'm new here",
      "interesting take",
      "ok cool",
    ];
    for (const msg of cases) {
      const r = classifyIntentRule(msg);
      assert(r?.intent === "chat" && r.confidence === "Medium",
        `short-no-build: "${msg}" → chat/Medium (got ${r?.intent}/${r?.confidence})`);
    }
  }

  // ─── Long, no clear keyword → null (LLM fallback path) ────────────────
  {
    const longAmbiguous =
      "I'm thinking about my product strategy for next quarter and trying to figure out which features deserve investment given our limited engineering bandwidth and the upcoming runway pressure that the board flagged in our most recent sync.";
    const r = classifyIntentRule(longAmbiguous);
    assert(r === null, "long ambiguous prompt returns null from rule layer (will fall to LLM)");
  }

  // ─── Empty input ───────────────────────────────────────────────────────
  {
    const r = classifyIntentRule("");
    assert(r?.intent === "chat" && r.confidence === "Low", "empty input → chat/Low");
    const r2 = classifyIntentRule("   ");
    assert(r2?.intent === "chat" && r2.confidence === "Low", "whitespace-only → chat/Low");
  }

  // ─── Build-extend takes priority over plain build ─────────────────────
  {
    const r = classifyIntentRule("update my existing app and create a new feature");
    assert(r?.intent === "build-extend",
      `extend wins over plain create: ${r?.intent} (expected build-extend)`);
  }

  // ─── classifyIntent (entry point) honors ruleOnly to avoid the LLM ────
  {
    const r = await classifyIntent(
      "I'm thinking about my product strategy for next quarter and trying to figure out which features deserve investment given our limited engineering bandwidth and the upcoming runway pressure that the board flagged in our most recent sync.",
      { ruleOnly: true }
    );
    assert(r.intent === "ambiguous" && r.confidence === "Low",
      `ruleOnly bypass: long ambiguous → ambiguous/Low (got ${r.intent}/${r.confidence})`);
    assert(r.layer === "rule", "ruleOnly stays at rule layer");
  }

  // ─── classifyIntent (entry point) returns rule verdict when confident ─
  {
    const r = await classifyIntent("build me a todo app", { ruleOnly: true });
    assert(r.intent === "build", "entry point uses rule when confident");
  }

  console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
