/**
 * Confidence Calibration Tests — proving domain-specific calibration
 * catches overclaiming, preserves AURA_CORE, and prevents hallucination.
 *
 * 100+ real-world scenarios across every domain and skill.
 *
 * Run: npx tsx tests/skill-confidence.test.ts
 */

import {
  buildCalibrationInstruction,
  validateConfidenceInResponse,
  DOMAIN_CONFIDENCE_RULES,
} from "../server/confidence-calibrator";
import { buildTruthSystemPrompt } from "../server/truth-engine";
import { getSkill, SKILL_REGISTRY, getSkillsByDomain } from "../server/skill-engine";

// ─── Test Harness ───────────────────────────────────────────────────────────

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

function describe(name: string, fn: () => void) {
  console.log(`\n━━━ ${name} ━━━`);
  fn();
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 1: Calibration instruction generation
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 1: Calibration instruction generation", () => {
  const domains = ["engineering", "marketing", "product", "finance", "leadership", "operations"] as const;

  // Every domain produces non-empty instruction with all 4 rule categories
  for (const domain of domains) {
    const inst = buildCalibrationInstruction(domain);
    assert(inst.length > 0, `${domain}: instruction is non-empty`);
    assert(inst.includes("CONFIDENCE CALIBRATION FOR " + domain.toUpperCase()), `${domain}: has correct header`);
    assert(inst.includes("High ONLY when:"), `${domain}: has highAllowed`);
    assert(inst.includes("NEVER High for:"), `${domain}: has highForbidden`);
    assert(inst.includes("Always Low for:"), `${domain}: has lowRequired`);
    assert(inst.includes("NEVER say:"), `${domain}: has neverClaim`);
  }

  // Finance-specific
  {
    const fin = buildCalibrationInstruction("finance");
    assert(fin.includes("assumptions explicitly"), "Finance: requires stating assumptions");
    assert(fin.includes("forward-looking"), "Finance: mentions forward-looking statements");
  }

  // Engineering-specific
  {
    const eng = buildCalibrationInstruction("engineering");
    assert(eng.includes("bulletproof"), "Engineering: warns about 'bulletproof' claims");
    assert(eng.includes("zero downtime"), "Engineering: warns about 'zero downtime' claims");
    assert(eng.includes("secure"), "Engineering: mentions security overclaiming");
  }

  // Marketing-specific
  {
    const mkt = buildCalibrationInstruction("marketing");
    assert(mkt.includes("viral"), "Marketing: warns about viral predictions");
    assert(mkt.includes("guaranteed ROI"), "Marketing: warns about ROI guarantees");
  }

  // Product-specific
  {
    const prod = buildCalibrationInstruction("product");
    assert(prod.includes("users will love"), "Product: warns about user prediction claims");
  }

  // Leadership-specific
  {
    const lead = buildCalibrationInstruction("leadership");
    assert(lead.includes("culture"), "Leadership: warns about culture fix claims");
  }

  // Operations-specific
  {
    const ops = buildCalibrationInstruction("operations");
    assert(ops.includes("story points"), "Operations: warns about velocity predictions");
    assert(ops.includes("adoption"), "Operations: warns about adoption claims");
  }

  // Non-finance domains should NOT have assumptions requirement
  for (const d of ["engineering", "marketing", "product", "leadership", "operations"] as const) {
    assert(!DOMAIN_CONFIDENCE_RULES[d].alwaysStateAssumptions, `${d}: no forced assumptions`);
  }

  // Rule completeness: every domain has at least 3 items per category
  for (const [domain, rules] of Object.entries(DOMAIN_CONFIDENCE_RULES)) {
    assert(rules.highAllowedWhen.length >= 3, `${domain}: >= 3 highAllowed`);
    assert(rules.highForbiddenFor.length >= 3, `${domain}: >= 3 highForbidden`);
    assert(rules.lowRequiredFor.length >= 3, `${domain}: >= 3 lowRequired`);
    assert(rules.mediumDefaultFor.length >= 2, `${domain}: >= 2 mediumDefault`);
    assert(rules.neverClaimFor.length >= 3, `${domain}: >= 3 neverClaim`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 2: Response confidence validation — real-world scenarios
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 2: Finance domain validation — real-world responses", () => {
  // MUST be flagged (overclaiming)
  assert(
    !validateConfidenceInResponse(
      "Based on your trajectory, guaranteed returns of $1M by Q3 are likely.\nConfidence: High (strong growth trend)",
      "finance"
    ).isAppropriate,
    "FIN: 'guaranteed returns' revenue prediction with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "The valuation will be around $10M based on industry multiples.\nConfidence: High",
      "finance"
    ).isAppropriate,
    "FIN: valuation prediction with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "You'll raise at a $20M valuation in this market.\nConfidence: High",
      "finance"
    ).isAppropriate,
    "FIN: 'you'll raise at' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "Your runway will last until December if you maintain this burn rate.\nConfidence: High",
      "finance"
    ).isAppropriate,
    "FIN: 'runway will last until' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "This investment will return 3x within 18 months.\nConfidence: High",
      "finance"
    ).isAppropriate,
    "FIN: 'this investment will' return prediction → flagged"
  );

  // MUST be appropriate (valid High)
  assert(
    validateConfidenceInResponse(
      "The LTV calculation: $500 ARPU × 24 months = $12,000 LTV. CAC is $4,000. LTV:CAC = 3:1.\nConfidence: High (mathematical calculation)",
      "finance"
    ).isAppropriate,
    "FIN: math calculation with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "Rule of 40 score: 25% growth + 15% margin = 40. This meets the benchmark.\nConfidence: High (established ratio)",
      "finance"
    ).isAppropriate,
    "FIN: established ratio with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "Your CAC payback period is 8 months (under 12 month benchmark).\nConfidence: Medium (depends on sustained metrics)",
      "finance"
    ).isAppropriate,
    "FIN: Medium for benchmark analysis → always appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "Market conditions make any forecast unreliable right now.\nConfidence: Low",
      "finance"
    ).isAppropriate,
    "FIN: Low for market forecast → always appropriate"
  );
});

describe("BLOCK 2: Engineering domain validation — real-world responses", () => {
  // MUST be flagged
  assert(
    !validateConfidenceInResponse(
      "After these changes, the system is completely secure.\nConfidence: High",
      "engineering"
    ).isAppropriate,
    "ENG: 'completely secure' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "This architecture is bulletproof and will handle any load.\nConfidence: High",
      "engineering"
    ).isAppropriate,
    "ENG: 'bulletproof' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "This will scale to 10 million users without performance issues.\nConfidence: High",
      "engineering"
    ).isAppropriate,
    "ENG: scale prediction without benchmarks with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "Zero downtime guaranteed during the migration.\nConfidence: High",
      "engineering"
    ).isAppropriate,
    "ENG: 'zero downtime guaranteed' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "This system is future-proof and won't need changes for years.\nConfidence: High",
      "engineering"
    ).isAppropriate,
    "ENG: 'future-proof' with High → flagged"
  );

  // MUST be appropriate
  assert(
    validateConfidenceInResponse(
      "REST is a well-documented architectural style with clear constraints.\nConfidence: High (established pattern)",
      "engineering"
    ).isAppropriate,
    "ENG: established REST pattern with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "SQL injection is a critical vulnerability. Use parameterized queries.\nConfidence: High (OWASP Top 10)",
      "engineering"
    ).isAppropriate,
    "ENG: known vulnerability remediation with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "The ACID properties of PostgreSQL guarantee transaction consistency.\nConfidence: High (documented behavior)",
      "engineering"
    ).isAppropriate,
    "ENG: documented database behavior with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "Performance depends on your specific workload. I'd recommend benchmarking.\nConfidence: Medium",
      "engineering"
    ).isAppropriate,
    "ENG: performance caveat with Medium → appropriate"
  );
});

describe("BLOCK 2: Marketing domain validation — real-world responses", () => {
  // MUST be flagged
  assert(
    !validateConfidenceInResponse(
      "This content strategy means this will go viral on TikTok.\nConfidence: High",
      "marketing"
    ).isAppropriate,
    "MKT: 'this will go viral' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "You'll see guaranteed ROI within 30 days of launch.\nConfidence: High",
      "marketing"
    ).isAppropriate,
    "MKT: 'guaranteed ROI' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "This content will definitely convert at 5% or higher.\nConfidence: High",
      "marketing"
    ).isAppropriate,
    "MKT: 'will definitely convert' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "Your product will outperform competitors in this market.\nConfidence: High",
      "marketing"
    ).isAppropriate,
    "MKT: 'outperform competitors' with High → flagged"
  );

  // MUST be appropriate
  assert(
    validateConfidenceInResponse(
      "Using April Dunford's positioning framework: FOR early-stage founders WHO...\nConfidence: High (established framework)",
      "marketing"
    ).isAppropriate,
    "MKT: applying established framework with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "The AARRR funnel shows your biggest leak is in activation.\nConfidence: High (framework application)",
      "marketing"
    ).isAppropriate,
    "MKT: AARRR framework analysis with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "SEO rankings depend on many factors. I'd estimate 3-6 months to see results.\nConfidence: Medium",
      "marketing"
    ).isAppropriate,
    "MKT: SEO timeline with Medium → appropriate"
  );
});

describe("BLOCK 2: Product domain validation — real-world responses", () => {
  // MUST be flagged
  assert(
    !validateConfidenceInResponse(
      "Users will love this new onboarding flow.\nConfidence: High",
      "product"
    ).isAppropriate,
    "PROD: 'users will love this' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "This feature will succeed and increase retention by 20%.\nConfidence: High",
      "product"
    ).isAppropriate,
    "PROD: 'this feature will succeed' + retention prediction with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "Based on my analysis, users want a dark mode option.\nConfidence: High",
      "product"
    ).isAppropriate,
    "PROD: 'users want' without research with High → flagged"
  );

  // MUST be appropriate
  assert(
    validateConfidenceInResponse(
      "Using RICE scoring: Reach=5000, Impact=3, Confidence=80%, Effort=2 weeks. Score: 600.\nConfidence: High (framework application)",
      "product"
    ).isAppropriate,
    "PROD: RICE scoring calculation with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "The PRD should include: Problem, Goals, Non-goals, Requirements, Metrics.\nConfidence: High (established format)",
      "product"
    ).isAppropriate,
    "PROD: PRD structure recommendation with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "User behavior here is unpredictable without A/B testing.\nConfidence: Low",
      "product"
    ).isAppropriate,
    "PROD: behavior uncertainty with Low → appropriate"
  );
});

describe("BLOCK 2: Leadership domain validation — real-world responses", () => {
  // MUST be flagged
  assert(
    !validateConfidenceInResponse(
      "This will fix your culture and improve team morale.\nConfidence: High",
      "leadership"
    ).isAppropriate,
    "LEAD: 'this will fix your culture' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "Your team will perform better if you switch to this structure.\nConfidence: High",
      "leadership"
    ).isAppropriate,
    "LEAD: 'team will perform better if' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "With these changes you will definitely get funded next round.\nConfidence: High",
      "leadership"
    ).isAppropriate,
    "LEAD: 'will definitely get funded' with High → flagged"
  );

  // MUST be appropriate
  assert(
    validateConfidenceInResponse(
      "OKR format: Objective should be inspiring and qualitative, KRs measurable with 3 max.\nConfidence: High (Doerr framework)",
      "leadership"
    ).isAppropriate,
    "LEAD: OKR framework description with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "Culture change depends on many factors specific to your org.\nConfidence: Low",
      "leadership"
    ).isAppropriate,
    "LEAD: culture uncertainty with Low → appropriate"
  );
});

describe("BLOCK 2: Operations domain validation — real-world responses", () => {
  // MUST be flagged
  assert(
    !validateConfidenceInResponse(
      "Your team will deliver 40 story points per sprint consistently.\nConfidence: High",
      "operations"
    ).isAppropriate,
    "OPS: 'team will deliver X story points' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "Adoption will be smooth once you roll out the new process.\nConfidence: High",
      "operations"
    ).isAppropriate,
    "OPS: 'adoption will be smooth' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "With this approach we'll have guaranteed on-time delivery for the release.\nConfidence: High",
      "operations"
    ).isAppropriate,
    "OPS: 'guaranteed on-time delivery' with High → flagged"
  );

  assert(
    !validateConfidenceInResponse(
      "This process will eliminate all blockers in your sprint.\nConfidence: High",
      "operations"
    ).isAppropriate,
    "OPS: 'eliminate all blockers' with High → flagged"
  );

  // MUST be appropriate
  assert(
    validateConfidenceInResponse(
      "The Scrum Guide defines sprints as time-boxed iterations of 1-4 weeks.\nConfidence: High (Scrum framework)",
      "operations"
    ).isAppropriate,
    "OPS: Scrum Guide fact with High → appropriate"
  );

  assert(
    validateConfidenceInResponse(
      "I'd recommend adding 30% buffer to all timeline estimates.\nConfidence: Medium (industry best practice)",
      "operations"
    ).isAppropriate,
    "OPS: estimation guidance with Medium → appropriate"
  );
});

describe("BLOCK 2: Cross-domain — Medium and Low always appropriate", () => {
  const domains = ["engineering", "marketing", "product", "finance", "leadership", "operations"] as const;

  // Medium is always appropriate for every domain
  for (const d of domains) {
    assert(
      validateConfidenceInResponse(`Some advice that depends on context.\nConfidence: Medium`, d).isAppropriate,
      `${d}: Medium always appropriate`
    );
  }

  // Low is always appropriate for every domain
  for (const d of domains) {
    assert(
      validateConfidenceInResponse(`I'm not certain about this.\nConfidence: Low`, d).isAppropriate,
      `${d}: Low always appropriate`
    );
  }

  // No confidence line defaults to Medium (appropriate)
  for (const d of domains) {
    const result = validateConfidenceInResponse("A response without a confidence line.", d);
    assert(result.claimed === "Medium", `${d}: no line → defaults to Medium`);
    assert(result.isAppropriate, `${d}: default Medium is appropriate`);
  }
});

describe("BLOCK 2: Edge cases — parsing and format", () => {
  // Case insensitive
  assert(
    validateConfidenceInResponse("Answer.\nconfidence: high", "engineering").claimed === "High",
    "Lowercase 'confidence: high' parsed as High"
  );
  assert(
    validateConfidenceInResponse("Answer.\nCONFIDENCE: LOW", "finance").claimed === "Low",
    "Uppercase 'CONFIDENCE: LOW' parsed as Low"
  );

  // With parenthetical reason
  assert(
    validateConfidenceInResponse(
      "Answer.\nConfidence: Medium (context-dependent trade-off)",
      "product"
    ).claimed === "Medium",
    "Confidence with parenthetical reason parsed correctly"
  );

  // Confidence in middle of response (not just at end)
  {
    const result = validateConfidenceInResponse(
      "Some initial thoughts.\nConfidence: High\nAnd some more text after.",
      "engineering"
    );
    assert(result.claimed === "High", "Confidence line in middle of response still parsed");
  }

  // Multiple confidence lines — first one wins
  {
    const result = validateConfidenceInResponse(
      "Part 1.\nConfidence: High\nPart 2.\nConfidence: Low",
      "finance"
    );
    assert(result.claimed === "High", "First confidence line wins when multiple exist");
  }

  // Warning object structure when flagged
  {
    const result = validateConfidenceInResponse(
      "This will go viral.\nConfidence: High",
      "marketing"
    );
    assert(result.warning !== undefined, "Flagged result has warning string");
    assert(typeof result.warning === "string", "Warning is a string");
    assert(result.warning!.length > 10, "Warning is descriptive (not empty)");
  }

  // Empty response
  {
    const result = validateConfidenceInResponse("", "engineering");
    assert(result.claimed === "Medium", "Empty response → defaults to Medium");
    assert(result.isAppropriate, "Empty response → appropriate");
  }

  // Very long response with confidence buried
  {
    const longText = "word ".repeat(500) + "\nConfidence: High (established fact)";
    const result = validateConfidenceInResponse(longText, "engineering");
    assert(result.claimed === "High", "Confidence parsed from very long response");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 3: Skill injection includes calibration
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 3: Every skill prompt includes calibration instructions", () => {
  // All 18 skills get calibration
  for (const [id, skill] of SKILL_REGISTRY) {
    const prompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: skill,
      skillContext: { userMessage: "test" },
    });
    assert(
      prompt.includes("CONFIDENCE CALIBRATION FOR " + skill.domain.toUpperCase()),
      `${id}: has domain-specific calibration header`
    );
  }

  // Finance skills specifically mention assumptions
  {
    const skills = getSkillsByDomain("finance");
    for (const skill of skills) {
      const prompt = buildTruthSystemPrompt("chat", "normal", [], {
        activeSkill: skill,
        skillContext: { userMessage: "test" },
      });
      assert(
        prompt.includes("assumptions explicitly"),
        `${skill.id}: finance prompt includes assumptions requirement`
      );
    }
  }

  // Calibration appears AFTER the base confidence rules
  for (const [id, skill] of SKILL_REGISTRY) {
    const prompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: skill,
      skillContext: { userMessage: "test" },
    });
    const baseIdx = prompt.indexOf("DOMAIN-SPECIFIC CONFIDENCE RULES");
    const calIdx = prompt.indexOf("CONFIDENCE CALIBRATION FOR");
    assert(baseIdx >= 0 && calIdx >= 0, `${id}: both base and calibration present`);
    assert(baseIdx < calIdx, `${id}: base rules before calibration`);
  }

  // Calibration appears AFTER the skill's systemPrompt content
  {
    const skill = getSkill("engineering-architect")!;
    const prompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: skill,
      skillContext: { userMessage: "test" },
    });
    const systemPromptSnippet = "C4 Model";
    const calIdx = prompt.indexOf("CONFIDENCE CALIBRATION FOR");
    const snippetIdx = prompt.indexOf(systemPromptSnippet);
    assert(snippetIdx >= 0, "Architect systemPrompt content in final prompt");
    assert(snippetIdx < calIdx, "systemPrompt content appears before calibration");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 4: Domain vs general comparison — calibration adds rigor
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 4: Domain skill adds calibration that general mode lacks", () => {
  // General mode (no skill) — has base AURA_CORE confidence only
  {
    const general = buildTruthSystemPrompt("chat", "normal", []);
    assert(!general.includes("CONFIDENCE CALIBRATION FOR"), "General mode: NO domain calibration");
    assert(general.includes("Confidence: High|Medium|Low"), "General mode: has base confidence rules");
    assert(general.includes("High: Well-established fact"), "General mode: has base High definition");
  }

  // Each domain adds calibration that general doesn't have
  {
    const general = buildTruthSystemPrompt("chat", "normal", []);

    const engSkill = getSkill("engineering-architect")!;
    const engPrompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: engSkill, skillContext: { userMessage: "test" },
    });
    assert(!general.includes("bulletproof"), "General: doesn't mention 'bulletproof'");
    assert(engPrompt.includes("bulletproof"), "Engineering: mentions 'bulletproof' as forbidden");

    const finSkill = getSkill("financial-analyst")!;
    const finPrompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: finSkill, skillContext: { userMessage: "test" },
    });
    assert(!general.includes("forward-looking"), "General: doesn't mention 'forward-looking'");
    assert(finPrompt.includes("forward-looking"), "Finance: mentions 'forward-looking' as forbidden");

    const mktSkill = getSkill("gtm-strategist")!;
    const mktPrompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: mktSkill, skillContext: { userMessage: "test" },
    });
    assert(!general.includes("go viral"), "General: doesn't mention 'go viral'");
    assert(mktPrompt.includes("go viral"), "Marketing: mentions 'go viral' as forbidden");

    const prodSkill = getSkill("product-manager")!;
    const prodPrompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: prodSkill, skillContext: { userMessage: "test" },
    });
    assert(prodPrompt.includes("users will love"), "Product: mentions 'users will love' as forbidden");

    const leadSkill = getSkill("startup-ceo")!;
    const leadPrompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: leadSkill, skillContext: { userMessage: "test" },
    });
    assert(leadPrompt.includes("fix your culture"), "Leadership: mentions 'fix your culture' as forbidden");

    const opsSkill = getSkill("senior-pm")!;
    const opsPrompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: opsSkill, skillContext: { userMessage: "test" },
    });
    assert(opsPrompt.includes("story points"), "Operations: mentions 'story points' as forbidden");
  }

  // Domain calibration is MORE SPECIFIC than general base rules
  {
    const general = buildTruthSystemPrompt("chat", "normal", []);
    const engSkill = getSkill("security-auditor")!;
    const engPrompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: engSkill, skillContext: { userMessage: "test" },
    });

    // General just says "Well-established fact" for High
    // Engineering calibration says specific things like "OWASP Top 10"
    assert(engPrompt.includes("OWASP"), "Security auditor prompt mentions OWASP specifically");
    assert(!general.includes("OWASP"), "General prompt does NOT mention OWASP");
    assert(engPrompt.length > general.length, "Domain prompt is longer than general (more instructions)");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 5: Regression — AURA_CORE confidence preserved with all skills
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 5: AURA_CORE base confidence rules preserved with every skill", () => {
  // The exact base confidence rules from AURA_CORE that must survive
  const baseRules = [
    "High: Well-established fact",
    "Medium: Plausible, partially supported",
    "Low: Unverified, depends on",
    "Confidence: High|Medium|Low",
  ];

  for (const [id, skill] of SKILL_REGISTRY) {
    const prompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: skill,
      skillContext: { userMessage: "test" },
    });

    for (const rule of baseRules) {
      assert(prompt.includes(rule), `${id}: base rule "${rule.slice(0, 40)}..." preserved`);
    }
  }

  // Domain calibration ADDS to base — doesn't replace
  {
    const skill = getSkill("financial-analyst")!;
    const prompt = buildTruthSystemPrompt("chat", "normal", [], {
      activeSkill: skill, skillContext: { userMessage: "test" },
    });

    // Base AURA_CORE confidence
    assert(prompt.includes("High: Well-established fact"), "Finance: base High rule present");
    // Plus domain calibration
    assert(prompt.includes("CONFIDENCE CALIBRATION FOR FINANCE"), "Finance: domain calibration present");
    // Both coexist
    const baseIdx = prompt.indexOf("High: Well-established fact");
    const domainIdx = prompt.indexOf("CONFIDENCE CALIBRATION FOR FINANCE");
    assert(baseIdx < domainIdx, "Finance: base rules appear before domain calibration (layered)");
  }

  // Non-negotiable principles survive with every mode + skill combo
  {
    const modes = ["chat", "research", "decision", "brainstorm", "explain"] as const;
    const skill = getSkill("engineering-architect")!;
    for (const m of modes) {
      const prompt = buildTruthSystemPrompt(m, "normal", [], {
        activeSkill: skill, skillContext: { userMessage: "test" },
      });
      assert(prompt.includes("TRUTH FIRST"), `Mode ${m} + skill: TRUTH FIRST preserved`);
      assert(prompt.includes("Never invent facts"), `Mode ${m} + skill: anti-hallucination preserved`);
      assert(prompt.includes("HELP FIRST"), `Mode ${m} + skill: HELP FIRST preserved`);
    }
  }

  // Triage + skill: both triage AND base confidence rules present
  {
    const skill = getSkill("startup-ceo")!;
    const prompt = buildTruthSystemPrompt("chat", "normal", [], {
      isTriage: true,
      activeSkill: skill,
      skillContext: { userMessage: "I'm overwhelmed" },
    });
    assert(prompt.includes("TRIAGE MODE"), "Triage + skill: triage instructions present");
    assert(prompt.includes("High: Well-established fact"), "Triage + skill: base confidence present");
    assert(prompt.includes("CONFIDENCE CALIBRATION"), "Triage + skill: domain calibration present");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 6: Real-world scenario stress tests
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 6: Real-world scenarios — complex multi-sentence responses", () => {
  // Scenario: Financial advisor gives partially appropriate response
  {
    const response = `Based on your numbers, your unit economics are strong. LTV:CAC is 4:1 which is above the 3:1 benchmark. However, your burn rate suggests 14 months of runway.

I'd recommend reducing spend on marketing channels with CAC above $200 and focusing on organic growth.

Note: The runway estimate assumes your current burn rate stays constant, which may not be the case if you hire as planned.

Confidence: Medium (calculations are solid but projections depend on stated assumptions)`;

    const result = validateConfidenceInResponse(response, "finance");
    assert(result.claimed === "Medium", "Complex finance response: Medium parsed");
    assert(result.isAppropriate, "Complex finance response: Medium appropriate for mixed analysis");
  }

  // Scenario: Engineer overclaims on performance
  {
    const response = `The microservice architecture with event sourcing will handle your load easily. This will scale to millions of users and provide zero downtime guaranteed during deployments.

I recommend using Kubernetes for orchestration and PostgreSQL for the event store.

Confidence: High (established patterns)`;

    const result = validateConfidenceInResponse(response, "engineering");
    assert(!result.isAppropriate, "Overclaiming eng response: 'zero downtime guaranteed' flagged despite valid patterns");
  }

  // Scenario: Marketer gives careful qualified response
  {
    const response = `Using the AARRR framework, your biggest leak is in Activation (only 12% of signups reach the aha moment).

I'd recommend testing a simplified onboarding flow (hypothesis: reducing steps from 7 to 3 will improve activation by 15-25%, though exact results require A/B testing).

Confidence: High (AARRR framework application and data-driven diagnosis)`;

    const result = validateConfidenceInResponse(response, "marketing");
    assert(result.isAppropriate, "Careful marketing response with framework: High appropriate");
  }

  // Scenario: Product manager predicts user behavior
  {
    const response = `Users want a simpler dashboard. Based on the support tickets I've analyzed, 40% mention complexity. I recommend stripping features down to core workflows.

This will increase retention by roughly 15% and users will love the cleaner experience.

Confidence: High`;

    const result = validateConfidenceInResponse(response, "product");
    assert(!result.isAppropriate, "PM predicting 'users will love' with High → flagged");
  }

  // Scenario: Leadership advisor gives nuanced advice
  {
    const response = `The OKR framework suggests structuring your Q2 goals as:

Objective: Become the default tool for mid-market SaaS teams
KR1: Achieve 50 enterprise pilot signups (currently 12)
KR2: Reach NPS 60 among pilot users (currently 45)
KR3: Close 10 paid conversions from pilots

These KRs are measurable and time-bound. I'd assign 70% confidence to KR1 and KR2, but KR3 depends heavily on your sales team capacity.

Confidence: High (OKR framework correctly applied)`;

    const result = validateConfidenceInResponse(response, "leadership");
    assert(result.isAppropriate, "OKR framework application with High → appropriate");
  }

  // Scenario: Ops lead makes velocity promise
  {
    const response = `After implementing these Scrum improvements, your team will deliver 30-35 story points per sprint consistently. The retrospective changes will eliminate the recurring deployment blockers.

I recommend a 2-week sprint cadence with 10% capacity reserved for tech debt.

Confidence: High`;

    const result = validateConfidenceInResponse(response, "operations");
    assert(!result.isAppropriate, "Ops velocity prediction with High → flagged");
  }
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);
