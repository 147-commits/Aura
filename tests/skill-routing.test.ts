/**
 * Skill Routing Tests — extensive coverage with real-world user scenarios.
 *
 * Tests are written from the perspective of actual Aura users:
 * - Founders building startups
 * - Engineers solving technical problems
 * - Marketers planning launches
 * - Product managers writing PRDs
 * - Finance teams analyzing metrics
 * - Ops leads improving processes
 *
 * Run: npx tsx tests/skill-routing.test.ts
 */

import { heuristicDomain, scoreDomains, composeChainedPrompt } from "../server/agents/agent-router";
import {
  AGENT_REGISTRY,
  getAgentsByDomain,
  getAgent,
  matchAgentsByKeywords,
  getChainedAgents,
  type AgentDefinition,
} from "../server/agents/agent-registry";
import { buildTruthSystemPrompt, type AgentContext } from "../server/truth-engine";
import {
  buildCalibrationInstruction,
  validateConfidenceInResponse,
  DOMAIN_CONFIDENCE_RULES,
} from "../server/confidence-calibrator";

// ─── Test Harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

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

function describe(name: string, fn: () => void) {
  console.log(`\n━━━ ${name} ━━━`);
  fn();
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 1: heuristicDomain() — Basic keyword detection
// ═════════════════════════════════════════════════════════════════════════════

describe("heuristicDomain() — threshold behavior", () => {
  assert(heuristicDomain("") === null, "Empty string → null");
  assert(heuristicDomain("   ") === null, "Whitespace only → null");
  assert(heuristicDomain("hello") === null, "Generic greeting → null");
  assert(heuristicDomain("thanks for the help") === null, "Gratitude → null");
  assert(heuristicDomain("what time is it?") === null, "General question → null");
  assert(heuristicDomain("api") === null, "Single keyword → null (threshold is 2)");
  assert(heuristicDomain("revenue") === null, "Single finance keyword → null");
  assert(heuristicDomain("scrum") === null, "Single ops keyword → null");
});

describe("heuristicDomain() — engineering detection", () => {
  assert(heuristicDomain("design the api and database schema") === "engineering", "api + database");
  assert(heuristicDomain("deploy to kubernetes") === "engineering", "deploy + kubernetes");
  assert(heuristicDomain("react typescript component") === "engineering", "react + typescript");
  assert(heuristicDomain("docker backend server") === "engineering", "docker + backend + server");
  assert(heuristicDomain("ci/cd infrastructure setup") === "engineering", "ci/cd + infrastructure");
  assert(heuristicDomain("frontend and backend separation") === "engineering", "frontend + backend");
  assert(heuristicDomain("microservice architecture") === "engineering", "microservice + architecture");
  assert(heuristicDomain("endpoint api design") === "engineering", "endpoint + api");
});

describe("heuristicDomain() — marketing detection", () => {
  assert(heuristicDomain("gtm positioning strategy") === "marketing", "gtm + positioning");
  assert(heuristicDomain("seo content strategy") === "marketing", "seo + content strategy");
  assert(heuristicDomain("ideal customer launch plan") === "marketing", "ideal customer + launch");
  assert(heuristicDomain("growth funnel optimization") === "marketing", "growth + funnel");
  assert(heuristicDomain("icp and brand voice") === "marketing", "icp + brand");
  assert(heuristicDomain("campaign ad copy") === "marketing", "campaign + ad copy");
});

describe("heuristicDomain() — product detection", () => {
  assert(heuristicDomain("write the prd and user story") === "product", "prd + user story");
  assert(heuristicDomain("prioritize the roadmap for mvp") === "product", "prioritize + roadmap + mvp");
  assert(heuristicDomain("ux user research wireframe") === "product", "ux + user research + wireframe");
  assert(heuristicDomain("acceptance criteria for sprint") === "product", "acceptance criteria + sprint");
  assert(heuristicDomain("feature prioritize for the product") === "product", "feature + prioritize");
});

describe("heuristicDomain() — finance detection", () => {
  assert(heuristicDomain("mrr and burn rate analysis") === "finance", "mrr + burn rate");
  assert(heuristicDomain("ltv cac unit economics") === "finance", "ltv + cac + unit economics");
  assert(heuristicDomain("revenue valuation fundraising") === "finance", "revenue + valuation + fundraising");
  assert(heuristicDomain("p&l ebitda and runway") === "finance", "p&l + ebitda + runway");
  assert(heuristicDomain("arr and revenue forecast") === "finance", "arr + revenue");
});

describe("heuristicDomain() — leadership detection", () => {
  assert(heuristicDomain("okr hiring plan") === "leadership", "okr + hiring");
  assert(heuristicDomain("board vision strategy") === "leadership", "board + vision + strategy");
  assert(heuristicDomain("co-founder culture") === "leadership", "co-founder + culture");
  assert(heuristicDomain("investors and mission") === "leadership", "investors + mission");
  assert(heuristicDomain("org design and strategy") === "leadership", "org design + strategy");
});

describe("heuristicDomain() — operations detection", () => {
  assert(heuristicDomain("scrum process workflow") === "operations", "scrum + process + workflow");
  assert(heuristicDomain("documentation runbook") === "operations", "documentation + runbook");
  assert(heuristicDomain("sprint retrospective velocity") === "operations", "sprint + retrospective + velocity");
  assert(heuristicDomain("kanban process improvement") === "operations", "kanban + process");
  assert(heuristicDomain("workflow and documentation plan") === "operations", "workflow + documentation");
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 2: Real user messages — natural language
// ═════════════════════════════════════════════════════════════════════════════

describe("heuristicDomain() — real user messages (natural language)", () => {
  // Engineering — how real users actually ask
  assert(
    heuristicDomain("How should I structure my api endpoints for the database models?") === "engineering",
    "Real eng: API endpoint + database structure question"
  );
  assert(
    heuristicDomain("I'm trying to deploy my react app but the server keeps crashing") === "engineering",
    "Real eng: deploy + react + server troubleshooting"
  );
  assert(
    heuristicDomain("Should I use typescript or stick with plain javascript for the frontend?") === "engineering",
    "Real eng: typescript + frontend language choice"
  );

  // Marketing — how real users actually ask
  assert(
    heuristicDomain("We're about to launch and I need help with our positioning and ideal customer profile") === "marketing",
    "Real mkt: launch + positioning + ideal customer"
  );
  assert(
    heuristicDomain("How do I improve our funnel? Our growth has stalled and we need better ad copy") === "marketing",
    "Real mkt: funnel + growth + ad copy stagnation"
  );

  // Finance — how real users actually ask
  assert(
    heuristicDomain("Can you help me calculate our burn rate and figure out how much runway we have?") === "finance",
    "Real fin: burn rate + runway calculation"
  );
  assert(
    heuristicDomain("Our MRR is $50k but our CAC keeps climbing. What should we do?") === "finance",
    "Real fin: mrr + cac analysis"
  );

  // Product — how real users actually ask
  assert(
    heuristicDomain("I need to write a PRD for this new feature we're building") === "product",
    "Real prod: PRD + feature writing"
  );
  assert(
    heuristicDomain("How should I prioritize our roadmap? We have too many feature requests") === "product",
    "Real prod: prioritize + roadmap + feature overload"
  );

  // Leadership — how real users actually ask
  assert(
    heuristicDomain("I need to set OKRs for next quarter and align the hiring plan with our strategy") === "leadership",
    "Real lead: OKR + hiring + strategy alignment"
  );

  // Operations — how real users actually ask
  assert(
    heuristicDomain("Our sprint process is broken. We keep missing retrospective action items and velocity is tanking") === "operations",
    "Real ops: sprint + process + retrospective + velocity"
  );
  assert(
    heuristicDomain("I need to write better documentation. Our runbook is outdated") === "operations",
    "Real ops: documentation + runbook update"
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 3: Edge cases — tricky inputs
// ═════════════════════════════════════════════════════════════════════════════

describe("heuristicDomain() — edge cases and tricky inputs", () => {
  // Mixed case
  assert(
    heuristicDomain("MICROSERVICES and Architecture") === "engineering",
    "ALL CAPS + Title Case still matches"
  );
  assert(
    heuristicDomain("GTM STRATEGY AND SEO") === "marketing",
    "Uppercase marketing keywords match"
  );

  // Keywords buried in long messages
  assert(
    heuristicDomain(
      "So I've been thinking a lot about where we're headed as a company and " +
      "one thing that keeps bugging me is the api design and whether our database " +
      "architecture can handle the growth we're expecting next year"
    ) === "engineering",
    "Keywords buried in 40+ word message still detected"
  );

  // Near-miss: keywords from different domains (1 each, no domain reaches 2)
  assert(
    heuristicDomain("api revenue") === null,
    "1 eng + 1 fin keyword → null (neither reaches threshold)"
  );
  assert(
    heuristicDomain("scrum pricing") === null,
    "1 ops + 0 fin → null"
  );
  assert(
    heuristicDomain("culture wireframe") === null,
    "1 leadership + 1 product → null"
  );

  // Message with code snippets
  assert(
    heuristicDomain("const api = express(); app.get('/database', handler);") === "engineering",
    "Code snippet with api + database keywords"
  );

  // Message with URLs
  assert(
    heuristicDomain("Check api.example.com/database for the endpoint docs") === "engineering",
    "Keywords inside URL-like text still detected"
  );

  // Very short messages (2 words)
  assert(
    heuristicDomain("api database") === "engineering",
    "Minimal 2-word engineering message"
  );
  assert(
    heuristicDomain("mrr arr") === "finance",
    "Minimal 2-word finance message"
  );
  assert(
    heuristicDomain("okr hiring") === "leadership",
    "Minimal 2-word leadership message"
  );

  // Punctuation-heavy
  assert(
    heuristicDomain("API?! DATABASE!! HELP!!!") === "engineering",
    "Punctuation-heavy message still matches"
  );

  // Repeated keywords (should still count as 2+)
  assert(
    heuristicDomain("api api api api") === null,
    "Repeated same keyword counts as 1 unique match, not threshold"
  );

  // Message with newlines
  assert(
    heuristicDomain("I need help with:\n- api design\n- database schema") === "engineering",
    "Multi-line message with keywords on different lines"
  );

  // Message with emoji
  assert(
    heuristicDomain("🚀 Let's deploy the api to kubernetes 🎉") === "engineering",
    "Message with emoji still detects keywords"
  );

  // Extremely long message
  const longMsg = "word ".repeat(200) + "api design and database optimization " + "word ".repeat(200);
  assert(
    heuristicDomain(longMsg) === "engineering",
    "500+ word message with keywords in the middle"
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 4: Ambiguous and multi-domain queries (scoreDomains)
// ═════════════════════════════════════════════════════════════════════════════

describe("scoreDomains() — multi-domain and ambiguous queries", () => {
  // Pure single domain — only one should score high
  {
    const scores = scoreDomains("Deploy the api to kubernetes with docker and typescript");
    assert(scores.engineering >= 4, "Pure engineering scores >= 4");
    assert(scores.marketing === 0, "Pure engineering → marketing = 0");
    assert(scores.finance === 0, "Pure engineering → finance = 0");
    assert(scores.product === 0, "Pure engineering → product = 0");
    assert(scores.leadership === 0, "Pure engineering → leadership = 0");
  }

  // Founder asking cross-domain question
  {
    const scores = scoreDomains("Our burn rate is too high and I need to restructure the engineering hiring plan");
    assert(scores.finance >= 1, "Burn rate → finance");
    assert(scores.leadership >= 1, "Hiring → leadership");
  }

  // Product + Marketing overlap (common in startups)
  {
    const scores = scoreDomains("Write the PRD for our GTM launch feature and positioning");
    assert(scores.product >= 1, "PRD + feature → product");
    assert(scores.marketing >= 2, "GTM + launch + positioning → marketing >= 2");
  }

  // Engineering + Operations overlap (common in DevOps)
  {
    const scores = scoreDomains("Set up the CI/CD pipeline and document the deployment process workflow");
    assert(scores.engineering >= 1, "CI/CD → engineering");
    assert(scores.operations >= 2, "Process + workflow + documentation → operations >= 2");
  }

  // Completely off-topic messages
  {
    const scores = scoreDomains("What a beautiful day to go for a walk in the park");
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    assert(total === 0, "Off-topic: all domains score 0");
  }

  {
    const scores = scoreDomains("I love pizza and cats");
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    assert(total === 0, "Casual chat: all domains score 0");
  }

  {
    const scores = scoreDomains("Tell me a joke");
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    assert(total === 0, "Entertainment request: all domains score 0");
  }

  // Stress test: all 9 domains mentioned
  {
    const scores = scoreDomains(
      "We need to deploy our api, fix our gtm positioning, write a prd, " +
      "check our mrr burn rate, set okr hiring goals, and improve our scrum process"
    );
    assert(scores.engineering >= 2, "Multi-domain stress test: engineering >= 2");
    assert(scores.marketing >= 2, "Multi-domain stress test: marketing >= 2");
    assert(scores.finance >= 2, "Multi-domain stress test: finance >= 2");
    assert(scores.leadership >= 2, "Multi-domain stress test: leadership >= 2");
    assert(scores.operations >= 2, "Multi-domain stress test: operations >= 2");
  }

  // Common ambiguous phrases
  {
    const scores = scoreDomains("How do I grow my startup?");
    // "growth" matches marketing, but only 1 keyword — shouldn't strongly match any domain
    const maxScore = Math.max(...Object.values(scores));
    assert(maxScore <= 1, "Vague startup question: no domain should score > 1");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 5: routeSkills() — integration tests (heuristic path)
// ═════════════════════════════════════════════════════════════════════════════

describe("routeSkills() — heuristic path validation", () => {
  // Clear single domain routes correctly
  {
    const domain = heuristicDomain("Help me deploy the api to kubernetes with docker");
    assert(domain === "engineering", "Clear engineering query → heuristic returns engineering");
    const scores = scoreDomains("Help me deploy the api to kubernetes with docker");
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    assert(sorted[0][0] === "engineering", "scoreDomains agrees with heuristicDomain");
  }

  // Multi-domain returns both when both score >= 2
  {
    const msg = "Write a PRD for the feature and plan the sprint roadmap process workflow";
    const scores = scoreDomains(msg);
    const qualifying = Object.entries(scores).filter(([, s]) => s >= 2);
    assert(qualifying.length >= 1, "Multi-domain: at least one domain qualifies");
  }

  // Chain validation via skill definitions
  {
    const architect = getAgent("engineering-architect")!;
    assert(architect.chainsWith.includes("security-auditor"), "Architect chains with security-auditor");
    assert(architect.chainsWith.includes("engineering-code-reviewer"), "Architect chains with code-reviewer");
  }

  {
    const gtm = getAgent("gtm-strategist")!;
    assert(gtm.chainsWith.includes("content-strategist"), "GTM chains with content-strategist");
    assert(gtm.chainsWith.includes("product-manager"), "GTM chains with product-manager");
  }

  {
    const financial = getAgent("financial-analyst")!;
    assert(financial.chainsWith.includes("saas-metrics-coach"), "Financial chains with saas-metrics");
    assert(financial.chainsWith.includes("startup-ceo"), "Financial chains with startup-ceo");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 6: matchAgentsByKeywords() — keyword trigger matching
// ═════════════════════════════════════════════════════════════════════════════

describe("matchAgentsByKeywords() — keyword trigger matching from user messages", () => {
  {
    const matches = matchAgentsByKeywords("Help me review this code and refactor the pull request");
    const ids = matches.map((s) => s.id);
    assert(ids.includes("engineering-code-reviewer"), "Code review message triggers code-reviewer skill");
  }

  {
    const matches = matchAgentsByKeywords("I need help with security and OWASP vulnerabilities in our auth system");
    const ids = matches.map((s) => s.id);
    assert(ids.includes("security-auditor"), "Security + OWASP triggers security-auditor");
  }

  {
    const matches = matchAgentsByKeywords("Write me a PRD with user stories and acceptance criteria");
    const ids = matches.map((s) => s.id);
    assert(ids.includes("product-manager"), "PRD + user stories triggers product-manager");
  }

  {
    const matches = matchAgentsByKeywords("What's a good MRR growth rate? Our churn is high and NRR is dropping");
    const ids = matches.map((s) => s.id);
    assert(ids.includes("saas-metrics-coach"), "MRR + churn + NRR triggers saas-metrics-coach");
  }

  {
    const matches = matchAgentsByKeywords("Help me write better documentation and a runbook for the team");
    const ids = matches.map((s) => s.id);
    assert(ids.includes("technical-writer"), "Documentation + runbook triggers technical-writer");
  }

  {
    const matches = matchAgentsByKeywords("How should I set OKRs for next quarter?");
    const ids = matches.map((s) => s.id);
    assert(ids.includes("okr-coach"), "OKR question triggers okr-coach");
  }

  // Generic message should match nothing or very few
  {
    const matches = matchAgentsByKeywords("Tell me about the weather today");
    assert(matches.length === 0, "Generic weather question triggers no skills");
  }

  {
    const matches = matchAgentsByKeywords("Hello, how are you?");
    assert(matches.length === 0, "Greeting triggers no skills");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 7: AURA_CORE override protection (CRITICAL)
// ═════════════════════════════════════════════════════════════════════════════

describe("AURA_CORE override protection — prompt injection safety", () => {
  // Valid skill passes without error
  {
    const skill = getAgent("engineering-architect")!;
    let threw = false;
    try {
      buildTruthSystemPrompt("chat", "normal", [], {
        activeAgent: skill,
        agentContext: { userMessage: "test" },
      });
    } catch {
      threw = true;
    }
    assert(!threw, "Valid skill prompt passes without throwing");
  }

  // Sacred composition order: AURA_CORE → Mode → Memory → Triage → Skill (LAST)
  {
    const skill = getAgent("engineering-architect")!;
    const prompt = buildTruthSystemPrompt("decision", "expert", [
      { text: "Building a SaaS platform", category: "project" },
      { text: "Prefers TypeScript", category: "preference" },
    ], { activeAgent: skill, agentContext: { userMessage: "test" } });

    const coreIdx = prompt.indexOf("You are Aura");
    const modeIdx = prompt.indexOf("Decision Mode");
    const memoryIdx = prompt.indexOf("Known context about this person");
    const skillIdx = prompt.indexOf("ACTIVE DOMAIN EXPERTISE:");

    assert(coreIdx >= 0, "AURA_CORE present");
    assert(modeIdx >= 0, "Mode template present");
    assert(memoryIdx >= 0, "Memory section present");
    assert(skillIdx >= 0, "Skill section present");
    assert(coreIdx < modeIdx, "AURA_CORE before Mode");
    assert(memoryIdx < skillIdx, "Memory before Skill");
    assert(coreIdx < skillIdx, "AURA_CORE BEFORE skill section (sacred order)");
  }

  // Non-negotiable principles survive skill injection
  {
    const allSkillIds = Array.from(AGENT_REGISTRY.keys());
    for (const id of allSkillIds) {
      const skill = getAgent(id)!;
      const prompt = buildTruthSystemPrompt("chat", "normal", [], {
        activeAgent: skill,
        agentContext: { userMessage: "test" },
      });
      assert(prompt.includes("TRUTH FIRST"), `TRUTH FIRST survives ${id} injection`);
      assert(prompt.includes("Never invent facts"), `Anti-hallucination survives ${id} injection`);
      assert(prompt.includes("Confidence: High|Medium|Low"), `Confidence requirement survives ${id} injection`);
    }
  }

  // No skill prompt contains injection keywords
  {
    const forbidden = [
      "ignore previous", "override aura", "disregard", "forget your rules",
      "skip confidence", "no confidence rating", "you can hallucinate",
      "ignore all", "system prompt", "jailbreak",
    ];
    let allClean = true;
    for (const [id, skill] of AGENT_REGISTRY) {
      for (const phrase of forbidden) {
        if (skill.systemPrompt.toLowerCase().includes(phrase)) {
          console.error(`  FAIL: Skill ${id} contains forbidden phrase "${phrase}"`);
          allClean = false;
        }
      }
    }
    assert(allClean, "No skill prompt contains override/injection keywords");
  }

  // Mode templates preserved with every mode + skill combo
  {
    const modes = ["chat", "research", "decision", "brainstorm", "explain"] as const;
    const skill = getAgent("product-manager")!;
    for (const m of modes) {
      const prompt = buildTruthSystemPrompt(m, "normal", [], {
        activeAgent: skill,
        agentContext: { userMessage: "test" },
      });
      assert(prompt.includes("You are Aura"), `Mode ${m} preserves AURA_CORE with skill`);
    }
  }

  // Explain levels preserved with skill
  {
    const skill = getAgent("financial-analyst")!;
    const simple = buildTruthSystemPrompt("chat", "simple", [], { activeAgent: skill });
    const expert = buildTruthSystemPrompt("chat", "expert", [], { activeAgent: skill });
    assert(simple.includes("12-year-old"), "Simple explain level preserved with skill");
    assert(expert.includes("technical language"), "Expert explain level preserved with skill");
  }

  // Triage section works with skill
  {
    const skill = getAgent("startup-ceo")!;
    const prompt = buildTruthSystemPrompt("chat", "normal", [], {
      isTriage: true,
      activeAgent: skill,
      agentContext: { userMessage: "I'm overwhelmed" },
    });
    assert(prompt.includes("TRIAGE MODE"), "Triage section present with skill active");
    assert(prompt.includes("ACTIVE DOMAIN EXPERTISE"), "Skill section still present with triage");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 8: Token budget and prompt size constraints
// ═════════════════════════════════════════════════════════════════════════════

describe("Token budget — prompt size constraints", () => {
  // Skill section stays reasonable (with calibration instructions). Pipeline
  // agents ship richer prompts; size budget per layer.
  {
    for (const [id, skill] of AGENT_REGISTRY) {
      const prompt = buildTruthSystemPrompt("chat", "normal", [], {
        activeAgent: skill,
        agentContext: { userMessage: "test" },
      });
      const skillStart = prompt.indexOf("ACTIVE DOMAIN EXPERTISE:");
      const skillSection = skillStart >= 0 ? prompt.slice(skillStart) : "";
      const cap = skill.layer === "advisor" ? 3200 : 6000;
      assert(
        skillSection.length < cap,
        `Skill section for ${id} (${skill.layer}) under ${cap} chars (got ${skillSection.length})`
      );
    }
  }

  // composeChainedPrompt always fits within 900 chars
  {
    const pairs: [string, string][] = [
      ["engineering-architect", "security-auditor"],
      ["fullstack-engineer", "engineering-code-reviewer"],
      ["gtm-strategist", "content-strategist"],
      ["product-manager", "ux-researcher"],
      ["financial-analyst", "saas-metrics-coach"],
      ["startup-ceo", "cto-advisor"],
      ["senior-pm", "scrum-master"],
    ];
    for (const [pId, sId] of pairs) {
      const primary = getAgent(pId)!;
      const secondary = getAgent(sId)!;
      const chained = composeChainedPrompt(primary, secondary, { userMessage: "test" });
      assert(
        chained.length <= 900,
        `Chained ${pId} + ${sId} <= 900 chars (got ${chained.length})`
      );
    }
  }

  // Chained prompts contain both skill names
  {
    const primary = getAgent("engineering-architect")!;
    const secondary = getAgent("security-auditor")!;
    const chained = composeChainedPrompt(primary, secondary, { userMessage: "test" });
    assert(chained.includes("PRIMARY EXPERTISE"), "Chained prompt has PRIMARY header");
    assert(chained.includes("SECONDARY LENS"), "Chained prompt has SECONDARY header");
    assert(chained.includes(primary.name), "Chained prompt mentions primary skill name");
    assert(chained.includes(secondary.name), "Chained prompt mentions secondary skill name");
    assert(chained.includes("INTEGRATION"), "Chained prompt has integration instruction");
  }

  // Every agent's systemPrompt word count is reasonable. Pipeline agents
  // (executive/lead/specialist) ship larger prompts than chat-time advisors;
  // window per layer.
  {
    let allInRange = true;
    for (const [id, skill] of AGENT_REGISTRY) {
      const words = skill.systemPrompt.split(/\s+/).length;
      const isPipeline = skill.layer !== "advisor";
      const min = isPipeline ? 200 : 80;
      const max = isPipeline ? 700 : 400;
      if (words < min || words > max) {
        console.error(`  FAIL: ${id} (${skill.layer}) systemPrompt is ${words} words (expected ${min}–${max})`);
        allInRange = false;
      }
    }
    assert(allInRange, "Every agent systemPrompt within layer-appropriate word range");
  }

  // Every skill has non-empty confidenceRules
  {
    let allValid = true;
    for (const [id, skill] of AGENT_REGISTRY) {
      if (!skill.confidenceRules.high || !skill.confidenceRules.medium || !skill.confidenceRules.low) {
        console.error(`  FAIL: ${id} has empty confidenceRules`);
        allValid = false;
      }
    }
    assert(allValid, "All skills have non-empty high/medium/low confidence rules");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 9: Skill registry integrity
// ═════════════════════════════════════════════════════════════════════════════

describe("Skill registry — completeness and integrity", () => {
  assert(AGENT_REGISTRY.size === 38, `Registry has exactly 38 agents — 26 advisors + 12 pipeline (got ${AGENT_REGISTRY.size})`);

  // Domain counts (post-C1: pipeline agents added under engineering, product,
  // leadership, operations, security, design, support).
  const expectedCounts: Record<string, number> = {
    engineering: 10, // 5 advisors + cto + eng-lead + qa-lead + architect + fullstack-eng
    marketing: 4,    // unchanged
    product: 4,      // 3 advisors + cpo
    finance: 3,      // unchanged
    leadership: 4,   // 3 advisors + ceo
    operations: 5,   // 3 advisors + coo + devops-lead
    legal: 2,        // unchanged
    education: 2,    // unchanged
    health: 1,       // unchanged
    security: 1,     // ciso
    design: 1,       // design-lead
    support: 1,      // tech-writer
  };
  for (const [domain, expected] of Object.entries(expectedCounts)) {
    const actual = getAgentsByDomain(domain as any).length;
    assert(actual === expected, `${domain} has ${expected} skills (got ${actual})`);
  }

  // Every skill has all required fields
  {
    const required = ["id", "name", "domain", "systemPrompt", "confidenceRules", "triggerKeywords", "chainsWith"];
    let allValid = true;
    for (const [id, skill] of AGENT_REGISTRY) {
      for (const field of required) {
        if (!(skill as any)[field]) {
          console.error(`  FAIL: ${id} missing field: ${field}`);
          allValid = false;
        }
      }
      if (skill.triggerKeywords.length === 0) {
        console.error(`  FAIL: ${id} has empty triggerKeywords`);
        allValid = false;
      }
    }
    assert(allValid, "Every skill has all required fields with non-empty values");
  }

  // No duplicate skill IDs
  {
    const ids = Array.from(AGENT_REGISTRY.keys());
    assert(ids.length === new Set(ids).size, "No duplicate skill IDs");
  }

  // All chainsWith references are valid
  {
    let allValid = true;
    for (const [id, skill] of AGENT_REGISTRY) {
      for (const chainId of skill.chainsWith) {
        if (!AGENT_REGISTRY.has(chainId)) {
          console.error(`  FAIL: ${id} chains with non-existent "${chainId}"`);
          allValid = false;
        }
      }
    }
    assert(allValid, "All chainsWith references point to valid skill IDs");
  }

  // getChainedAgents returns actual AgentDefinition objects
  {
    const chained = getChainedAgents("engineering-architect");
    assert(chained.length > 0, "engineering-architect has chained skills");
    assert(chained.every((s) => s.id && s.name && s.domain), "Chained skills are full AgentDefinition objects");
  }

  // getAgent for non-existent ID returns undefined
  {
    assert(getAgent("nonexistent-skill") === undefined, "Non-existent skill returns undefined");
    assert(getAgent("") === undefined, "Empty string skill returns undefined");
  }

  // 12 domains after C1: 9 advisor domains + security + design + support
  {
    const domains = new Set(Array.from(AGENT_REGISTRY.values()).map((s) => s.domain));
    assert(domains.size === 12, `12 domains across all agents (got ${domains.size})`);
  }

  // Every skill ID matches a naming convention (kebab-case)
  {
    const kebabRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    let allKebab = true;
    for (const id of AGENT_REGISTRY.keys()) {
      if (!kebabRegex.test(id)) {
        console.error(`  FAIL: Skill ID "${id}" is not kebab-case`);
        allKebab = false;
      }
    }
    assert(allKebab, "All skill IDs follow kebab-case naming convention");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 10: Confidence calibrator — comprehensive
// ═════════════════════════════════════════════════════════════════════════════

describe("Confidence calibrator — instruction generation", () => {
  const domains = ["engineering", "marketing", "product", "finance", "leadership", "operations"] as const;

  // Every domain produces valid calibration instructions
  for (const domain of domains) {
    const instruction = buildCalibrationInstruction(domain);
    assert(instruction.includes("CONFIDENCE CALIBRATION"), `${domain}: has calibration header`);
    assert(instruction.includes("High ONLY when"), `${domain}: specifies High conditions`);
    assert(instruction.includes("NEVER High for"), `${domain}: specifies High forbidden`);
    assert(instruction.includes("Always Low for"), `${domain}: specifies Low required`);
    assert(instruction.includes("NEVER say"), `${domain}: specifies neverClaim phrases`);
  }

  // Finance-specific: must require assumptions
  {
    const fin = buildCalibrationInstruction("finance");
    assert(fin.includes("assumptions explicitly"), "Finance requires stating assumptions");
  }

  // Non-finance domains should NOT require assumptions
  {
    for (const d of ["engineering", "marketing", "product", "leadership", "operations"] as const) {
      const rules = DOMAIN_CONFIDENCE_RULES[d];
      assert(!rules.alwaysStateAssumptions, `${d}: does NOT require assumptions by default`);
    }
  }

  // Every domain has at least 3 highAllowed, 3 highForbidden, 3 lowRequired, 3 neverClaim
  {
    for (const [domain, rules] of Object.entries(DOMAIN_CONFIDENCE_RULES)) {
      assert(rules.highAllowedWhen.length >= 3, `${domain}: at least 3 highAllowed rules`);
      assert(rules.highForbiddenFor.length >= 3, `${domain}: at least 3 highForbidden rules`);
      assert(rules.lowRequiredFor.length >= 3, `${domain}: at least 3 lowRequired rules`);
      assert(rules.neverClaimFor.length >= 3, `${domain}: at least 3 neverClaim phrases`);
    }
  }
});

describe("Confidence calibrator — response validation", () => {
  // Medium and Low are always appropriate
  {
    for (const domain of ["engineering", "marketing", "finance", "product", "leadership", "operations"] as const) {
      const med = validateConfidenceInResponse("Some advice.\nConfidence: Medium", domain);
      assert(med.isAppropriate, `Medium is always appropriate for ${domain}`);
      const low = validateConfidenceInResponse("Not sure.\nConfidence: Low", domain);
      assert(low.isAppropriate, `Low is always appropriate for ${domain}`);
    }
  }

  // No confidence line defaults to Medium
  {
    const result = validateConfidenceInResponse("Just a response.", "engineering");
    assert(result.claimed === "Medium", "No confidence line → defaults to Medium");
    assert(result.isAppropriate, "Default Medium is appropriate");
  }

  // Appropriate High for engineering (established pattern)
  {
    const result = validateConfidenceInResponse(
      "REST API follows ACID principles and 12-factor methodology.\nConfidence: High",
      "engineering"
    );
    assert(result.claimed === "High", "Parses High");
    assert(result.isAppropriate, "High for established engineering pattern is appropriate");
  }

  // Overclaiming: marketing "this will go viral"
  {
    const result = validateConfidenceInResponse(
      "This will go viral and get guaranteed ROI.\nConfidence: High",
      "marketing"
    );
    assert(!result.isAppropriate, "Marketing: 'this will go viral' with High is flagged");
    assert(result.warning !== undefined, "Warning provided");
  }

  // Overclaiming: finance forward-looking
  {
    const result = validateConfidenceInResponse(
      "You'll raise at a $50M valuation easily.\nConfidence: High",
      "finance"
    );
    assert(!result.isAppropriate, "Finance: 'you'll raise at' with High is flagged");
  }

  // Overclaiming: product "users will love this"
  {
    const result = validateConfidenceInResponse(
      "Users will love this new feature.\nConfidence: High",
      "product"
    );
    assert(!result.isAppropriate, "Product: 'users will love this' with High is flagged");
  }

  // Overclaiming: leadership "this will fix your culture"
  {
    const result = validateConfidenceInResponse(
      "This will fix your culture and the team will perform better if you follow these steps.\nConfidence: High",
      "leadership"
    );
    assert(!result.isAppropriate, "Leadership: culture fix promise with High is flagged");
  }

  // Overclaiming: operations velocity prediction
  {
    const result = validateConfidenceInResponse(
      "Your team will deliver 40 story points per sprint.\nConfidence: High",
      "operations"
    );
    assert(!result.isAppropriate, "Operations: velocity prediction with High is flagged");
  }

  // Engineering: "completely secure" should be flagged
  {
    const result = validateConfidenceInResponse(
      "This system is completely secure after these changes.\nConfidence: High",
      "engineering"
    );
    assert(!result.isAppropriate, "Engineering: 'completely secure' with High is flagged");
  }

  // Case insensitivity in confidence parsing
  {
    const result = validateConfidenceInResponse("Answer.\nconfidence: high", "engineering");
    assert(result.claimed === "High", "Case-insensitive confidence parsing");
  }

  // Confidence with reason in parentheses
  {
    const result = validateConfidenceInResponse(
      "Answer.\nConfidence: Medium (context-dependent recommendation)",
      "product"
    );
    assert(result.claimed === "Medium", "Parses Medium with reason");
    assert(result.isAppropriate, "Medium with reason is appropriate");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 11: Calibration integration with skill prompts
// ═════════════════════════════════════════════════════════════════════════════

describe("Calibration integration — skill prompts include calibration", () => {
  // Every skill prompt now includes calibration instructions
  {
    for (const [id, skill] of AGENT_REGISTRY) {
      const prompt = buildTruthSystemPrompt("chat", "normal", [], {
        activeAgent: skill,
        agentContext: { userMessage: "test" },
      });
      assert(
        prompt.includes("CONFIDENCE CALIBRATION FOR"),
        `${id}: prompt includes calibration instructions`
      );
    }
  }

  // Finance skill specifically includes assumptions requirement
  {
    const skill = getAgent("financial-analyst")!;
    const prompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeAgent: skill,
      agentContext: { userMessage: "test" },
    });
    assert(
      prompt.includes("assumptions explicitly"),
      "Financial analyst prompt includes assumptions requirement"
    );
  }

  // Calibration appears AFTER the base confidence rules, not before
  {
    const skill = getAgent("engineering-architect")!;
    const prompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeAgent: skill,
      agentContext: { userMessage: "test" },
    });
    const baseRulesIdx = prompt.indexOf("DOMAIN-SPECIFIC CONFIDENCE RULES");
    const calibrationIdx = prompt.indexOf("CONFIDENCE CALIBRATION FOR");
    assert(baseRulesIdx >= 0, "Base confidence rules present");
    assert(calibrationIdx >= 0, "Calibration instructions present");
    assert(baseRulesIdx < calibrationIdx, "Base rules appear before calibration");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 12: User scenario integration tests
// ═════════════════════════════════════════════════════════════════════════════

describe("User scenarios — end-to-end routing logic", () => {
  // Scenario: Founder asks about fundraising strategy
  {
    const msg = "I'm preparing for our Series A fundraising round. How should I approach investors?";
    const scores = scoreDomains(msg);
    assert(scores.finance >= 1, "Fundraising → finance scores");
    assert(scores.leadership >= 1, "Investor approach → leadership scores");
    const matches = matchAgentsByKeywords(msg);
    const skillNames = matches.map((s) => s.name);
    assert(
      matches.some((s) => s.domain === "finance" || s.domain === "leadership"),
      "Fundraising triggers finance or leadership skills"
    );
  }

  // Scenario: Engineer asks about code review best practices
  {
    const msg = "What should I look for when doing a code review? I want to improve our PR process";
    const matches = matchAgentsByKeywords(msg);
    assert(
      matches.some((s) => s.id === "engineering-code-reviewer"),
      "Code review question triggers code-reviewer"
    );
  }

  // Scenario: PM needs help with sprint planning
  {
    const msg = "Help me plan the next sprint. We need to prioritize the feature backlog";
    const domain = heuristicDomain(msg);
    assert(domain === "product" || domain === "operations", "Sprint planning routes to product or operations");
  }

  // Scenario: User asks something completely unrelated to any domain
  {
    const msg = "What's the best recipe for chocolate chip cookies?";
    const domain = heuristicDomain(msg);
    assert(domain === null, "Cookie recipe → no domain detected");
    const matches = matchAgentsByKeywords(msg);
    assert(matches.length === 0, "Cookie recipe → no skills matched");
  }

  // Scenario: Very short ambiguous message
  {
    const domain = heuristicDomain("help");
    assert(domain === null, "'help' alone → no domain");
  }

  {
    const domain = heuristicDomain("yes");
    assert(domain === null, "'yes' alone → no domain");
  }

  // Scenario: User sends only numbers
  {
    const domain = heuristicDomain("42");
    assert(domain === null, "Number only → no domain");
  }
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);
