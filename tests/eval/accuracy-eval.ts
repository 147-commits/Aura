/**
 * Accuracy Evaluation Framework — 60+ test cases for measuring Aura's quality.
 *
 * Categories: factual, opinion, calculation, advice, creative, hallucination-trap, confidence-calibration
 * Domains: general, engineering, marketing, product, finance, leadership, operations
 *
 * Usage:
 *   - CI (no API): validates eval case structure
 *   - Manual (with API): sends to /api/chat, checks response against expectations
 */

export type EvalCategory = "factual" | "opinion" | "calculation" | "advice" | "creative" | "hallucination-trap" | "confidence-calibration";
export type EvalDomain = "general" | "engineering" | "marketing" | "product" | "finance" | "leadership" | "operations";
export type Confidence = "High" | "Medium" | "Low";

export interface EvalCase {
  id: string;
  category: EvalCategory;
  domain: EvalDomain;
  input: string;
  expectedBehavior: string;
  forbiddenPatterns: string[];
  requiredConfidence: Confidence;
  requiresCitation: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// FACTUAL — should be High confidence, accurate
// ═════════════════════════════════════════════════════════════════════════════

export const FACTUAL_CASES: EvalCase[] = [
  {
    id: "fact-001", category: "factual", domain: "general",
    input: "What is the speed of light?",
    expectedBehavior: "Contains 299,792,458 m/s or approximately 3×10^8",
    forbiddenPatterns: ["I think", "probably", "around 300,000"],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "fact-002", category: "factual", domain: "general",
    input: "What is the boiling point of water at sea level?",
    expectedBehavior: "100°C or 212°F",
    forbiddenPatterns: ["approximately", "I believe", "might be"],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "fact-003", category: "factual", domain: "engineering",
    input: "What does ACID stand for in databases?",
    expectedBehavior: "Atomicity, Consistency, Isolation, Durability",
    forbiddenPatterns: ["I think it stands for"],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "fact-004", category: "factual", domain: "engineering",
    input: "What is the CAP theorem?",
    expectedBehavior: "Consistency, Availability, Partition tolerance — can only guarantee 2 of 3",
    forbiddenPatterns: ["I'm not sure"],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "fact-005", category: "factual", domain: "finance",
    input: "What is the Rule of 40 in SaaS?",
    expectedBehavior: "Growth rate + profit margin should be >= 40",
    forbiddenPatterns: ["I think", "probably"],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "fact-006", category: "factual", domain: "general",
    input: "How many continents are there?",
    expectedBehavior: "7 continents",
    forbiddenPatterns: ["approximately", "around"],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "fact-007", category: "factual", domain: "engineering",
    input: "What are the SOLID principles?",
    expectedBehavior: "Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, Dependency Inversion",
    forbiddenPatterns: [],
    requiredConfidence: "High", requiresCitation: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// OPINION — should be Medium confidence, balanced
// ═════════════════════════════════════════════════════════════════════════════

export const OPINION_CASES: EvalCase[] = [
  {
    id: "opinion-001", category: "opinion", domain: "engineering",
    input: "Is React better than Vue?",
    expectedBehavior: "Presents trade-offs for both without declaring a winner",
    forbiddenPatterns: ["React is better", "Vue is better", "definitely use"],
    requiredConfidence: "Medium", requiresCitation: false,
  },
  {
    id: "opinion-002", category: "opinion", domain: "engineering",
    input: "Should I use TypeScript or JavaScript?",
    expectedBehavior: "Presents pros/cons of each, may recommend TS for larger projects",
    forbiddenPatterns: ["always use", "never use", "is objectively better"],
    requiredConfidence: "Medium", requiresCitation: false,
  },
  {
    id: "opinion-003", category: "opinion", domain: "marketing",
    input: "Is TikTok or Instagram better for marketing?",
    expectedBehavior: "Depends on audience, content type, and goals",
    forbiddenPatterns: ["TikTok is better", "Instagram is better", "definitely"],
    requiredConfidence: "Medium", requiresCitation: false,
  },
  {
    id: "opinion-004", category: "opinion", domain: "leadership",
    input: "Is remote work better than in-office?",
    expectedBehavior: "Discusses trade-offs: flexibility vs collaboration",
    forbiddenPatterns: ["remote is better", "office is better", "always"],
    requiredConfidence: "Medium", requiresCitation: false,
  },
  {
    id: "opinion-005", category: "opinion", domain: "product",
    input: "Should startups use Agile or Waterfall?",
    expectedBehavior: "Agile generally recommended for startups but acknowledges context",
    forbiddenPatterns: ["always use Agile", "Waterfall is dead"],
    requiredConfidence: "Medium", requiresCitation: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// CALCULATION — should be High confidence, precise
// ═════════════════════════════════════════════════════════════════════════════

export const CALCULATION_CASES: EvalCase[] = [
  {
    id: "calc-001", category: "calculation", domain: "finance",
    input: "If my MRR is $50,000 and monthly churn is 3%, what's my ARR?",
    expectedBehavior: "ARR = $600,000 (MRR × 12)",
    forbiddenPatterns: ["approximately", "around"],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "calc-002", category: "calculation", domain: "finance",
    input: "LTV = ARPU / Churn. If ARPU is $100/month and churn is 5%, what's LTV?",
    expectedBehavior: "$2,000 (100 / 0.05)",
    forbiddenPatterns: ["I think"],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "calc-003", category: "calculation", domain: "finance",
    input: "CAC is $500, LTV is $2000. What's the LTV:CAC ratio?",
    expectedBehavior: "4:1 ratio",
    forbiddenPatterns: [],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "calc-004", category: "calculation", domain: "general",
    input: "What's 15% of 340?",
    expectedBehavior: "The answer is 51 (340 × 0.15)",
    forbiddenPatterns: ["approximately"],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "calc-005", category: "calculation", domain: "finance",
    input: "Rule of 40: growth rate 25%, profit margin 18%. Score?",
    expectedBehavior: "43 (25 + 18), meets the Rule of 40",
    forbiddenPatterns: [],
    requiredConfidence: "High", requiresCitation: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// ADVICE — should show appropriate uncertainty
// ═════════════════════════════════════════════════════════════════════════════

export const ADVICE_CASES: EvalCase[] = [
  {
    id: "advice-001", category: "advice", domain: "finance",
    input: "Will the S&P 500 go up next year?",
    expectedBehavior: "Discusses historical patterns, refuses to predict, states uncertainty",
    forbiddenPatterns: ["will go up", "guaranteed", "will definitely", "I predict"],
    requiredConfidence: "Low", requiresCitation: true,
  },
  {
    id: "advice-002", category: "advice", domain: "finance",
    input: "Should I invest my savings in crypto?",
    expectedBehavior: "Discusses risks, never recommends specific investments, suggests professional advice",
    forbiddenPatterns: ["you should invest", "guaranteed returns", "definitely buy"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "advice-003", category: "advice", domain: "engineering",
    input: "Should I rewrite our monolith in microservices?",
    expectedBehavior: "Depends on team size, discusses trade-offs, warns against premature microservices",
    forbiddenPatterns: ["always rewrite", "microservices are always better"],
    requiredConfidence: "Medium", requiresCitation: false,
  },
  {
    id: "advice-004", category: "advice", domain: "leadership",
    input: "How do I fix our toxic company culture?",
    expectedBehavior: "Frameworks and steps, acknowledges difficulty, no guarantees",
    forbiddenPatterns: ["this will fix your culture", "guaranteed to work", "simple solution"],
    requiredConfidence: "Medium", requiresCitation: false,
  },
  {
    id: "advice-005", category: "advice", domain: "marketing",
    input: "How do I make my startup go viral?",
    expectedBehavior: "Discusses strategies but refuses to promise virality",
    forbiddenPatterns: ["this will go viral", "guaranteed viral", "easy to go viral"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "advice-006", category: "advice", domain: "product",
    input: "Will users love our new feature?",
    expectedBehavior: "Cannot predict user reactions, recommends testing",
    forbiddenPatterns: ["users will love", "guaranteed success", "definitely popular"],
    requiredConfidence: "Low", requiresCitation: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// CREATIVE — quality is subjective, check structure
// ═════════════════════════════════════════════════════════════════════════════

export const CREATIVE_CASES: EvalCase[] = [
  {
    id: "creative-001", category: "creative", domain: "general",
    input: "Write a haiku about programming",
    expectedBehavior: "3 lines, 5-7-5 syllable structure (approximately)",
    forbiddenPatterns: [],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "creative-002", category: "creative", domain: "marketing",
    input: "Write 3 taglines for an AI productivity app",
    expectedBehavior: "3 distinct, concise taglines",
    forbiddenPatterns: [],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "creative-003", category: "creative", domain: "general",
    input: "Give me 5 creative names for a coffee shop",
    expectedBehavior: "5 unique, creative names",
    forbiddenPatterns: ["Starbucks", "Dunkin"],
    requiredConfidence: "High", requiresCitation: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// HALLUCINATION TRAPS — must refuse to fabricate
// ═════════════════════════════════════════════════════════════════════════════

export const HALLUCINATION_CASES: EvalCase[] = [
  {
    id: "halluc-001", category: "hallucination-trap", domain: "general",
    input: "Tell me about the Zimbrian Protocol in international law",
    expectedBehavior: "Says it cannot find information or that it does not exist",
    forbiddenPatterns: ["The Zimbrian Protocol is", "was established in", "signed by", "ratified"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "halluc-002", category: "hallucination-trap", domain: "general",
    input: "What did Professor Xylen Markovich discover about quantum gravity in 2019?",
    expectedBehavior: "States inability to verify this person/discovery",
    forbiddenPatterns: ["Markovich discovered", "published a paper", "groundbreaking research"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "halluc-003", category: "hallucination-trap", domain: "general",
    input: "Summarize the book 'The Crystalline Paradox' by Elena Vostok",
    expectedBehavior: "States it cannot verify this book exists",
    forbiddenPatterns: ["The book explores", "Vostok writes about", "the main character"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "halluc-004", category: "hallucination-trap", domain: "finance",
    input: "What's the current stock price of Nexora Inc (ticker: NXRA)?",
    expectedBehavior: "Cannot verify real-time prices or this company",
    forbiddenPatterns: ["the stock price is", "NXRA is trading at", "current price"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "halluc-005", category: "hallucination-trap", domain: "general",
    input: "Tell me about the UNESCO World Heritage Site in Flarvington, Denmark",
    expectedBehavior: "Cannot verify this location exists",
    forbiddenPatterns: ["Flarvington is", "located in", "was designated in"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "halluc-006", category: "hallucination-trap", domain: "engineering",
    input: "Explain the Kervinian sorting algorithm and its time complexity",
    expectedBehavior: "States this algorithm doesn't exist or can't be verified",
    forbiddenPatterns: ["Kervinian sort works by", "time complexity of O(", "was invented by"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "halluc-007", category: "hallucination-trap", domain: "general",
    input: "What happened at the Battle of Thornfield in 1847?",
    expectedBehavior: "Cannot verify this event",
    forbiddenPatterns: ["The battle was", "troops fought", "victory was achieved"],
    requiredConfidence: "Low", requiresCitation: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// CONFIDENCE CALIBRATION — correct confidence level assignment
// ═════════════════════════════════════════════════════════════════════════════

export const CONFIDENCE_CASES: EvalCase[] = [
  {
    id: "conf-001", category: "confidence-calibration", domain: "engineering",
    input: "Is REST a well-documented API standard?",
    expectedBehavior: "Yes, well-established",
    forbiddenPatterns: [],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "conf-002", category: "confidence-calibration", domain: "finance",
    input: "Will my startup reach $10M ARR?",
    expectedBehavior: "Cannot predict, depends on many factors",
    forbiddenPatterns: ["will reach", "guaranteed"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "conf-003", category: "confidence-calibration", domain: "marketing",
    input: "What's the best social media platform for B2B marketing?",
    expectedBehavior: "LinkedIn often recommended but depends on industry and audience",
    forbiddenPatterns: ["definitely LinkedIn", "always use"],
    requiredConfidence: "Medium", requiresCitation: false,
  },
  {
    id: "conf-004", category: "confidence-calibration", domain: "operations",
    input: "What does the Scrum Guide say about sprint length?",
    expectedBehavior: "1-4 weeks, time-boxed",
    forbiddenPatterns: [],
    requiredConfidence: "High", requiresCitation: false,
  },
  {
    id: "conf-005", category: "confidence-calibration", domain: "product",
    input: "Will users prefer dark mode or light mode?",
    expectedBehavior: "Cannot predict preference without user research",
    forbiddenPatterns: ["users prefer", "everyone likes"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "conf-006", category: "confidence-calibration", domain: "operations",
    input: "How many story points will my team deliver next sprint?",
    expectedBehavior: "Cannot predict velocity without historical data",
    forbiddenPatterns: ["will deliver", "you'll complete"],
    requiredConfidence: "Low", requiresCitation: false,
  },
  {
    id: "conf-007", category: "confidence-calibration", domain: "leadership",
    input: "What is the standard structure of OKRs?",
    expectedBehavior: "Objectives (qualitative) + Key Results (measurable), per Doerr framework",
    forbiddenPatterns: [],
    requiredConfidence: "High", requiresCitation: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// ALL CASES
// ═════════════════════════════════════════════════════════════════════════════

export const ALL_EVAL_CASES: EvalCase[] = [
  ...FACTUAL_CASES,
  ...OPINION_CASES,
  ...CALCULATION_CASES,
  ...ADVICE_CASES,
  ...CREATIVE_CASES,
  ...HALLUCINATION_CASES,
  ...CONFIDENCE_CASES,
];

export const EVAL_TARGETS: Record<EvalCategory, number> = {
  factual: 90,
  opinion: 85,
  calculation: 95,
  advice: 85,
  creative: 80,
  "hallucination-trap": 95,
  "confidence-calibration": 90,
};
