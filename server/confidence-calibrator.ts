/**
 * Confidence Calibrator — domain-specific confidence rating calibration.
 *
 * The problem: "High" confidence for an architecture recommendation means
 * something different than "High" for a math calculation. This layer provides
 * per-domain rules that make confidence ratings dramatically more trustworthy,
 * which is core to Aura's zero-hallucination promise.
 *
 * This module does NOT modify responses. It:
 *   1. Generates calibration instructions to inject into skill prompts
 *   2. Validates confidence claims in responses for monitoring
 */

import type { AdvisorDomain, AgentDomain } from "../shared/agent-schema";

/** True when a domain has confidence rules registered. */
function isAdvisorDomain(domain: AgentDomain): domain is AdvisorDomain {
  return domain in DOMAIN_CONFIDENCE_RULES;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type Confidence = "High" | "Medium" | "Low";

export interface ConfidenceRules {
  /** Domain these rules apply to */
  domain: AdvisorDomain;
  /** Conditions where High confidence is appropriate */
  highAllowedWhen: string[];
  /** Things that can NEVER be rated High */
  highForbiddenFor: string[];
  /** Default to Medium for these topics */
  mediumDefaultFor: string[];
  /** Must be Low for these topics */
  lowRequiredFor: string[];
  /** Whether the model must state assumptions before any projection */
  alwaysStateAssumptions: boolean;
  /** Phrases that indicate overclaiming — model should never use these */
  neverClaimFor: string[];
}

export interface ConfidenceValidationResult {
  /** The confidence level claimed in the response */
  claimed: Confidence;
  /** Whether the claimed level is appropriate per domain rules */
  isAppropriate: boolean;
  /** Warning message if inappropriate */
  warning?: string;
}

// ── Domain Confidence Rules ─────────────────────────────────────────────────

export const DOMAIN_CONFIDENCE_RULES: Record<AdvisorDomain, ConfidenceRules> = {
  engineering: {
    domain: "engineering",
    highAllowedWhen: [
      "established patterns (CQRS, REST, ACID, 12-factor, OWASP Top 10)",
      "documented framework behavior with official sources",
      "mathematical correctness of algorithms",
      "well-known security vulnerabilities (SQLi, XSS, CSRF)",
    ],
    highForbiddenFor: [
      "performance predictions without benchmarks or profiling data",
      "claims that a system 'will scale' without load testing evidence",
      "security completeness ('this is fully secure')",
      "technology longevity predictions beyond 2 years",
    ],
    mediumDefaultFor: [
      "architecture recommendations (context-dependent trade-offs)",
      "code quality assessments involving style preferences",
      "library and framework comparisons",
    ],
    lowRequiredFor: [
      "any claim that a system is 'secure' without full audit",
      "performance predictions without profiling data",
      "future behavior of emerging technologies",
      "browser compatibility without cross-browser testing",
    ],
    alwaysStateAssumptions: false,
    neverClaimFor: [
      "bulletproof",
      "zero downtime guaranteed",
      "infinitely scalable",
      "completely secure",
      "future-proof",
    ],
  },

  marketing: {
    domain: "marketing",
    highAllowedWhen: [
      "established positioning frameworks (April Dunford, Porter)",
      "AARRR pirate metrics framework application",
      "content structure and editorial process design",
      "audience segmentation methodology",
    ],
    highForbiddenFor: [
      "ad performance predictions for specific campaigns",
      "viral potential or sharing coefficients",
      "exact conversion rate predictions",
      "customer acquisition cost predictions for new channels",
    ],
    mediumDefaultFor: [
      "channel-specific tactic recommendations",
      "content format effectiveness predictions",
      "SEO ranking predictions",
    ],
    lowRequiredFor: [
      "market timing predictions",
      "competitor intent or strategy forecasts",
      "viral coefficients and sharing predictions",
      "exact traffic or revenue projections from content",
    ],
    alwaysStateAssumptions: false,
    neverClaimFor: [
      "this will go viral",
      "guaranteed ROI",
      "outperform competitors",
      "guaranteed to rank",
      "will definitely convert",
    ],
  },

  finance: {
    domain: "finance",
    highAllowedWhen: [
      "mathematical calculations and established ratios",
      "Rule of 40, LTV formula, CAC payback calculation methodology",
      "benchmark comparisons using documented industry standards",
      "unit economics math with user-provided numbers",
    ],
    highForbiddenFor: [
      "ALL forward-looking financial statements",
      "valuation predictions or estimates",
      "fundraising outcome predictions",
      "market size estimates without cited research",
      "revenue projections beyond stated assumptions",
    ],
    mediumDefaultFor: [
      "financial health diagnosis against benchmarks",
      "projections with clearly stated assumptions",
      "budget allocation recommendations",
    ],
    lowRequiredFor: [
      "market forecasts and macro-economic predictions",
      "IPO timing or next-round valuation estimates",
      "competitor financial performance predictions",
      "industry growth rate predictions without cited data",
    ],
    alwaysStateAssumptions: true,
    neverClaimFor: [
      "you'll raise at",
      "runway will last until",
      "valuation will be",
      "guaranteed returns",
      "this investment will",
    ],
  },

  product: {
    domain: "product",
    highAllowedWhen: [
      "framework application (RICE scoring process, PRD format, JTBD)",
      "user story and acceptance criteria structure",
      "prioritization methodology application",
      "established UX heuristics (Nielsen's 10)",
    ],
    highForbiddenFor: [
      "user behavior predictions without research data",
      "feature success probability estimates",
      "adoption rate forecasts for new features",
      "user emotional response predictions",
    ],
    mediumDefaultFor: [
      "prioritization recommendations (depends on business context)",
      "design recommendations from limited research data",
      "persona accuracy with small sample sizes",
    ],
    lowRequiredFor: [
      "claims about what users want without research evidence",
      "feature success or failure predictions",
      "specific retention or engagement lift predictions",
      "user behavior forecasts without testing",
    ],
    alwaysStateAssumptions: false,
    neverClaimFor: [
      "users will love this",
      "this feature will succeed",
      "users want",
      "this will increase retention by",
      "guaranteed product-market fit",
    ],
  },

  leadership: {
    domain: "leadership",
    highAllowedWhen: [
      "documented startup patterns (fundraising mechanics, cap table math)",
      "OKR framework structure and quality assessment",
      "hiring process frameworks and best practices",
      "established engineering org patterns (DORA, team topologies)",
    ],
    highForbiddenFor: [
      "culture transformation predictions",
      "team performance forecasts",
      "individual behavior change predictions",
      "fundraising success probability",
    ],
    mediumDefaultFor: [
      "strategic recommendations (highly context-dependent)",
      "team structure recommendations",
      "goal-setting recommendations for specific orgs",
    ],
    lowRequiredFor: [
      "market predictions affecting company strategy",
      "hiring market forecasts",
      "cultural adoption timelines",
      "specific productivity improvement estimates from org changes",
    ],
    alwaysStateAssumptions: false,
    neverClaimFor: [
      "your team will perform better if",
      "this will fix your culture",
      "guaranteed to improve morale",
      "will definitely get funded",
    ],
  },

  operations: {
    domain: "operations",
    highAllowedWhen: [
      "process frameworks (Scrum Guide, Kanban principles, critical path)",
      "documentation structure frameworks (Divio, Diataxis)",
      "estimation techniques with buffer guidance",
      "ceremony structure and anti-pattern identification",
    ],
    highForbiddenFor: [
      "velocity predictions for new or recently changed teams",
      "adoption rate forecasts for new processes",
      "dependency predictions involving external teams",
      "time-to-comprehension estimates for documentation",
    ],
    mediumDefaultFor: [
      "timeline estimates (always recommend adding 30%+ buffer)",
      "team dynamics recommendations",
      "content recommendations for specific audiences",
    ],
    lowRequiredFor: [
      "specific story point or velocity predictions",
      "cultural transformation timelines",
      "vendor delivery commitments",
      "self-service deflection rate predictions",
    ],
    alwaysStateAssumptions: false,
    neverClaimFor: [
      "your team will deliver X story points",
      "adoption will be smooth",
      "guaranteed on-time delivery",
      "this process will eliminate all blockers",
    ],
  },

  legal: {
    domain: "legal",
    highAllowedWhen: [
      "Identifying well-known risky clause patterns (unlimited liability, broad non-compete)",
      "Explaining standard legal terms in plain language",
      "Listing which regulations apply to a described business activity",
      "Standard compliance framework descriptions (GDPR, SOX, HIPAA structure)",
    ],
    highForbiddenFor: [
      "Jurisdiction-specific legal interpretations or rulings",
      "Whether a specific contract is legally enforceable",
      "Advice to sign or not sign any legal document",
      "Predictions about legal outcomes or litigation results",
    ],
    mediumDefaultFor: [
      "Contract risk assessment (depends on full context and jurisdiction)",
      "Compliance gap analysis (depends on completeness of information)",
      "Negotiation suggestions for contract terms",
    ],
    lowRequiredFor: [
      "Any jurisdiction-specific legal advice",
      "Enforceability predictions for specific clauses",
      "Litigation outcome predictions",
      "Tax implications of specific structures",
    ],
    alwaysStateAssumptions: true,
    neverClaimFor: [
      "this contract is safe to sign",
      "you don't need a lawyer",
      "this is legally compliant",
      "you will win this case",
    ],
  },

  education: {
    domain: "education",
    highAllowedWhen: [
      "Established pedagogical frameworks (Bloom's Taxonomy, backward design, constructive alignment)",
      "Standard curriculum structure and sequencing principles",
      "Well-documented learning theories (Vygotsky ZPD, Piaget, constructivism)",
      "Explaining well-established concepts in established fields",
    ],
    highForbiddenFor: [
      "Predictions about learning outcomes for specific student populations",
      "Claims about learning styles being definitively proven (debunked in research)",
      "Guaranteed effectiveness of specific teaching methods without context",
      "Student performance predictions",
    ],
    mediumDefaultFor: [
      "Audience-specific recommendations (depends on learner demographics)",
      "Time estimates for content delivery and mastery",
      "Assessment design recommendations",
    ],
    lowRequiredFor: [
      "How quickly a specific person will learn a topic",
      "Whether a specific curriculum will succeed without piloting",
      "Student engagement predictions for untested content",
    ],
    alwaysStateAssumptions: false,
    neverClaimFor: [
      "this curriculum will definitely work",
      "students will learn faster with",
      "guaranteed learning outcomes",
      "this teaching method is always superior",
    ],
  },

  health: {
    domain: "health",
    highAllowedWhen: [
      "WHO physical activity guidelines (150 min/week moderate)",
      "Established sleep hygiene principles (consistent schedule, dark room)",
      "Habit formation frameworks (Atomic Habits, evidence-based behavioral science)",
      "General wellness principles backed by meta-analyses and systematic reviews",
    ],
    highForbiddenFor: [
      "ANY medical diagnosis, treatment, or prescription",
      "Specific supplement or medication recommendations",
      "Dietary plans for medical conditions (diabetes, allergies, eating disorders)",
      "Claims about curing or treating any disease or condition",
      "Mental health diagnoses or therapy recommendations",
    ],
    mediumDefaultFor: [
      "General workout recommendations (depends on individual fitness, injuries)",
      "Nutrition guidance for general health (not medical conditions)",
      "Stress management techniques (effectiveness varies by individual)",
    ],
    lowRequiredFor: [
      "Any claim about treating, curing, or preventing disease",
      "Specific health outcome predictions for individuals",
      "Supplement effectiveness claims",
      "Diet plan effectiveness for weight loss or medical conditions",
    ],
    alwaysStateAssumptions: false,
    neverClaimFor: [
      "this will cure",
      "guaranteed weight loss",
      "you don't need to see a doctor",
      "this supplement will",
      "stop taking your medication",
    ],
  },
};

// ── Calibration Instruction Builder ─────────────────────────────────────────

/**
 * Generates a formatted confidence calibration instruction block for a domain.
 * This is appended to every skill prompt to make confidence ratings
 * domain-specific and dramatically more trustworthy.
 */
export function buildCalibrationInstruction(domain: AgentDomain): string {
  if (!isAdvisorDomain(domain)) return "";
  const rules = DOMAIN_CONFIDENCE_RULES[domain];
  const lines: string[] = [];

  lines.push(`CONFIDENCE CALIBRATION FOR ${domain.toUpperCase()}:`);
  lines.push(`→ High ONLY when: ${rules.highAllowedWhen.join(", ")}`);
  lines.push(`→ NEVER High for: ${rules.highForbiddenFor.join(", ")}`);
  lines.push(`→ Always Low for: ${rules.lowRequiredFor.join(", ")}`);
  lines.push(`→ NEVER say: ${rules.neverClaimFor.map((p) => `"${p}"`).join(", ")}`);

  if (rules.alwaysStateAssumptions) {
    lines.push("→ Always state your assumptions explicitly before any projection or forecast.");
  }

  return lines.join("\n");
}

// ── Response Confidence Validator ───────────────────────────────────────────

/**
 * Validates whether the confidence level claimed in a response is appropriate
 * for the given domain. Does NOT modify the response — this is for monitoring
 * and future fine-tuning data collection.
 */
export function validateConfidenceInResponse(
  response: string,
  domain: AgentDomain
): ConfidenceValidationResult {
  // Parse the confidence line
  const match = response.match(/Confidence:\s*(High|Medium|Low)/i);
  if (!match) {
    return { claimed: "Medium", isAppropriate: true };
  }

  const raw = match[1];
  const claimed = (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as Confidence;
  if (!isAdvisorDomain(domain)) {
    return { claimed, isAppropriate: true };
  }
  const rules = DOMAIN_CONFIDENCE_RULES[domain];
  const lower = response.toLowerCase();

  // Only validate High claims — Medium and Low are always acceptable
  if (claimed !== "High") {
    return { claimed, isAppropriate: true };
  }

  // Check if response contains forbidden High patterns
  for (const forbidden of rules.highForbiddenFor) {
    const keywords = forbidden.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
    if (matchCount >= 2) {
      const warning = `High confidence claimed for domain "${domain}" but response may contain: ${forbidden}`;
      console.warn(`[confidence-calibrator] ${warning}`);
      return { claimed, isAppropriate: false, warning };
    }
  }

  // Check for "never claim" phrases
  for (const phrase of rules.neverClaimFor) {
    if (lower.includes(phrase.toLowerCase())) {
      const warning = `Response contains overclaiming phrase "${phrase}" with High confidence in ${domain}`;
      console.warn(`[confidence-calibrator] ${warning}`);
      return { claimed, isAppropriate: false, warning };
    }
  }

  // Check lowRequired topics — High should never appear for these
  for (const required of rules.lowRequiredFor) {
    const keywords = required.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
    if (matchCount >= 2) {
      const warning = `High confidence claimed but topic requires Low: ${required}`;
      console.warn(`[confidence-calibrator] ${warning}`);
      return { claimed, isAppropriate: false, warning };
    }
  }

  return { claimed, isAppropriate: true };
}
