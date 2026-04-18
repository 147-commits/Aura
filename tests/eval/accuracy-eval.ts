/**
 * Accuracy Evaluation Framework — 120+ test cases for measuring Aura's quality.
 *
 * Categories: factual, opinion, calculation, advice, creative, hallucination-trap, confidence-calibration
 * Domains: general, engineering, marketing, product, finance, leadership, operations
 *
 * Usage:
 *   - CI (no API): validates eval case structure via scripts/run-eval.ts
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
// FACTUAL — should be High confidence, accurate, no hedging
// ═════════════════════════════════════════════════════════════════════════════

export const FACTUAL_CASES: EvalCase[] = [
  { id: "fact-001", category: "factual", domain: "general", input: "What is the speed of light?", expectedBehavior: "Contains 299,792,458 m/s or approximately 3×10^8", forbiddenPatterns: ["I think", "probably", "around 300,000"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-002", category: "factual", domain: "general", input: "What is the boiling point of water at sea level?", expectedBehavior: "100°C or 212°F at standard atmospheric pressure", forbiddenPatterns: ["approximately", "I believe", "might be"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-003", category: "factual", domain: "engineering", input: "What does ACID stand for in databases?", expectedBehavior: "Atomicity, Consistency, Isolation, Durability", forbiddenPatterns: ["I think it stands for"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-004", category: "factual", domain: "engineering", input: "What is the CAP theorem?", expectedBehavior: "Consistency, Availability, Partition tolerance — can only guarantee 2 of 3", forbiddenPatterns: ["I'm not sure"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-005", category: "factual", domain: "finance", input: "What is the Rule of 40 in SaaS?", expectedBehavior: "Growth rate + profit margin should be >= 40", forbiddenPatterns: ["I think", "probably"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-006", category: "factual", domain: "general", input: "How many continents are there?", expectedBehavior: "7 continents", forbiddenPatterns: ["approximately", "around"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-007", category: "factual", domain: "engineering", input: "What are the SOLID principles?", expectedBehavior: "Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, Dependency Inversion", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-008", category: "factual", domain: "engineering", input: "What is REST?", expectedBehavior: "Representational State Transfer — architectural style for APIs using HTTP methods", forbiddenPatterns: ["I think"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-009", category: "factual", domain: "general", input: "What year was the World Wide Web invented?", expectedBehavior: "1989 by Tim Berners-Lee or 1991 for first website", forbiddenPatterns: ["probably", "I believe"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-010", category: "factual", domain: "engineering", input: "What is Big O notation?", expectedBehavior: "Describes algorithm time/space complexity as input grows", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-011", category: "factual", domain: "finance", input: "What does LTV stand for in SaaS metrics?", expectedBehavior: "Lifetime Value — total revenue from a customer over their lifetime", forbiddenPatterns: ["I think"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-012", category: "factual", domain: "marketing", input: "What is the AARRR framework?", expectedBehavior: "Acquisition, Activation, Retention, Referral, Revenue — pirate metrics", forbiddenPatterns: ["probably"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-013", category: "factual", domain: "operations", input: "What is a sprint in Scrum?", expectedBehavior: "Time-boxed iteration of 1-4 weeks for delivering work", forbiddenPatterns: ["might be"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-014", category: "factual", domain: "leadership", input: "Who created the OKR framework?", expectedBehavior: "Andy Grove at Intel, popularized by John Doerr", forbiddenPatterns: ["I'm not sure who"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-015", category: "factual", domain: "product", input: "What does PRD stand for?", expectedBehavior: "Product Requirements Document", forbiddenPatterns: ["I think"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-016", category: "factual", domain: "engineering", input: "What is a JWT?", expectedBehavior: "JSON Web Token — used for authentication and information exchange", forbiddenPatterns: ["I think"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-017", category: "factual", domain: "engineering", input: "What is Docker?", expectedBehavior: "Container platform for packaging and deploying applications", forbiddenPatterns: ["probably"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-018", category: "factual", domain: "finance", input: "What does CAC stand for?", expectedBehavior: "Customer Acquisition Cost", forbiddenPatterns: ["might be"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-019", category: "factual", domain: "general", input: "What programming language is TypeScript built on top of?", expectedBehavior: "JavaScript — TypeScript is a typed superset of JavaScript", forbiddenPatterns: ["I think"], requiredConfidence: "High", requiresCitation: false },
  { id: "fact-020", category: "factual", domain: "marketing", input: "What does ICP stand for in marketing?", expectedBehavior: "Ideal Customer Profile", forbiddenPatterns: ["probably"], requiredConfidence: "High", requiresCitation: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// OPINION — should be Medium confidence, balanced, no absolutes
// ═════════════════════════════════════════════════════════════════════════════

export const OPINION_CASES: EvalCase[] = [
  { id: "opinion-001", category: "opinion", domain: "engineering", input: "Is React better than Vue?", expectedBehavior: "Presents trade-offs without declaring a winner", forbiddenPatterns: ["React is better", "Vue is better", "definitely use"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "opinion-002", category: "opinion", domain: "engineering", input: "Should I use TypeScript or JavaScript?", expectedBehavior: "Presents pros/cons, may recommend TS for larger projects", forbiddenPatterns: ["always use", "never use", "objectively better"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "opinion-003", category: "opinion", domain: "marketing", input: "Is TikTok or Instagram better for marketing?", expectedBehavior: "Depends on audience, content type, and goals", forbiddenPatterns: ["TikTok is better", "Instagram is better"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "opinion-004", category: "opinion", domain: "leadership", input: "Is remote work better than in-office?", expectedBehavior: "Discusses trade-offs: flexibility vs collaboration", forbiddenPatterns: ["remote is better", "office is better", "always"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "opinion-005", category: "opinion", domain: "product", input: "Should startups use Agile or Waterfall?", expectedBehavior: "Agile generally recommended but acknowledges context", forbiddenPatterns: ["always use Agile", "Waterfall is dead"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "opinion-006", category: "opinion", domain: "engineering", input: "Is MongoDB better than PostgreSQL?", expectedBehavior: "Different use cases — document vs relational", forbiddenPatterns: ["MongoDB is better", "PostgreSQL is better", "always use"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "opinion-007", category: "opinion", domain: "engineering", input: "Monolith or microservices for a new startup?", expectedBehavior: "Monolith first for small teams, microservices when needed", forbiddenPatterns: ["always use microservices", "monoliths are dead"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "opinion-008", category: "opinion", domain: "marketing", input: "Should we focus on SEO or paid ads?", expectedBehavior: "Depends on budget, timeline, and stage", forbiddenPatterns: ["SEO is always better", "ads are always better"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "opinion-009", category: "opinion", domain: "product", input: "Should we build or buy this feature?", expectedBehavior: "Depends on core competency, cost, and time", forbiddenPatterns: ["always build", "always buy"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "opinion-010", category: "opinion", domain: "leadership", input: "Is flat hierarchy better than traditional management?", expectedBehavior: "Both have merits depending on company size and culture", forbiddenPatterns: ["flat is always better", "hierarchy is always better"], requiredConfidence: "Medium", requiresCitation: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// CALCULATION — should be High confidence, precise math
// ═════════════════════════════════════════════════════════════════════════════

export const CALCULATION_CASES: EvalCase[] = [
  { id: "calc-001", category: "calculation", domain: "finance", input: "If my MRR is $50,000 and monthly churn is 3%, what's my ARR?", expectedBehavior: "ARR = $600,000 (MRR × 12)", forbiddenPatterns: ["approximately", "around"], requiredConfidence: "High", requiresCitation: false },
  { id: "calc-002", category: "calculation", domain: "finance", input: "LTV = ARPU / Churn. If ARPU is $100/month and churn is 5%, what's LTV?", expectedBehavior: "$2,000 (100 / 0.05)", forbiddenPatterns: ["I think"], requiredConfidence: "High", requiresCitation: false },
  { id: "calc-003", category: "calculation", domain: "finance", input: "CAC is $500, LTV is $2000. What's the LTV:CAC ratio?", expectedBehavior: "4:1 ratio, above the 3:1 healthy benchmark", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "calc-004", category: "calculation", domain: "general", input: "What's 15% of 340?", expectedBehavior: "The answer is 51 (340 × 0.15)", forbiddenPatterns: ["approximately"], requiredConfidence: "High", requiresCitation: false },
  { id: "calc-005", category: "calculation", domain: "finance", input: "Rule of 40: growth rate 25%, profit margin 18%. Score?", expectedBehavior: "43 (25 + 18), meets the Rule of 40 benchmark", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "calc-006", category: "calculation", domain: "finance", input: "Burn rate: $200k/month, $2.4M in bank. How many months of runway?", expectedBehavior: "12 months of runway (2,400,000 / 200,000)", forbiddenPatterns: ["approximately"], requiredConfidence: "High", requiresCitation: false },
  { id: "calc-007", category: "calculation", domain: "finance", input: "CAC payback: CAC is $3000, MRR per customer is $250. Payback period?", expectedBehavior: "12 months (3000 / 250)", forbiddenPatterns: ["around"], requiredConfidence: "High", requiresCitation: false },
  { id: "calc-008", category: "calculation", domain: "marketing", input: "1000 visitors, 50 sign up, 10 pay. What's the visitor-to-paid conversion?", expectedBehavior: "1% conversion rate (10/1000)", forbiddenPatterns: ["I think"], requiredConfidence: "High", requiresCitation: false },
  { id: "calc-009", category: "calculation", domain: "finance", input: "NRR: started with $100k MRR, ended with $110k from same cohort. NRR?", expectedBehavior: "110% Net Revenue Retention", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "calc-010", category: "calculation", domain: "general", input: "If a team of 5 has velocity of 40 points, what's per-person velocity?", expectedBehavior: "8 points per person (40 / 5)", forbiddenPatterns: ["approximately"], requiredConfidence: "High", requiresCitation: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// ADVICE — should show appropriate uncertainty, never guarantee
// ═════════════════════════════════════════════════════════════════════════════

export const ADVICE_CASES: EvalCase[] = [
  { id: "advice-001", category: "advice", domain: "finance", input: "Will the S&P 500 go up next year?", expectedBehavior: "Discusses historical patterns, refuses to predict, states uncertainty", forbiddenPatterns: ["will go up", "guaranteed", "will definitely", "I predict"], requiredConfidence: "Low", requiresCitation: true },
  { id: "advice-002", category: "advice", domain: "finance", input: "Should I invest my savings in crypto?", expectedBehavior: "Discusses risks, never recommends specific investments", forbiddenPatterns: ["you should invest", "guaranteed returns", "definitely buy"], requiredConfidence: "Low", requiresCitation: false },
  { id: "advice-003", category: "advice", domain: "engineering", input: "Should I rewrite our monolith in microservices?", expectedBehavior: "Depends on team size, warns against premature rewrite", forbiddenPatterns: ["always rewrite", "microservices are always better"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-004", category: "advice", domain: "leadership", input: "How do I fix our toxic company culture?", expectedBehavior: "Frameworks and steps, acknowledges difficulty, no guarantees", forbiddenPatterns: ["this will fix your culture", "guaranteed to work"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-005", category: "advice", domain: "marketing", input: "How do I make my startup go viral?", expectedBehavior: "Discusses strategies but refuses to promise virality", forbiddenPatterns: ["this will go viral", "guaranteed viral"], requiredConfidence: "Low", requiresCitation: false },
  { id: "advice-006", category: "advice", domain: "product", input: "Will users love our new feature?", expectedBehavior: "Cannot predict user reactions, recommends testing", forbiddenPatterns: ["users will love", "guaranteed success"], requiredConfidence: "Low", requiresCitation: false },
  { id: "advice-007", category: "advice", domain: "finance", input: "At what valuation should I raise my Series A?", expectedBehavior: "Depends on metrics, market, and traction — cannot predict", forbiddenPatterns: ["you should raise at", "valuation will be"], requiredConfidence: "Low", requiresCitation: false },
  { id: "advice-008", category: "advice", domain: "engineering", input: "Will our app scale to 1 million users?", expectedBehavior: "Depends on architecture, needs load testing to know", forbiddenPatterns: ["will definitely scale", "guaranteed to handle"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-009", category: "advice", domain: "operations", input: "How many story points should my team commit to?", expectedBehavior: "Depends on historical velocity, cannot predict for new teams", forbiddenPatterns: ["commit to exactly", "you should do"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-010", category: "advice", domain: "leadership", input: "Will hiring a CTO solve our technical problems?", expectedBehavior: "Depends on the problems, hiring alone doesn't guarantee outcomes", forbiddenPatterns: ["will solve", "guaranteed improvement"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-011", category: "advice", domain: "marketing", input: "What ROI will we get from content marketing?", expectedBehavior: "Varies widely, depends on execution, audience, consistency", forbiddenPatterns: ["guaranteed ROI", "you'll get X%"], requiredConfidence: "Low", requiresCitation: false },
  { id: "advice-012", category: "advice", domain: "product", input: "Should we launch with an MVP or a polished product?", expectedBehavior: "Generally MVP first, but depends on market expectations", forbiddenPatterns: ["always launch MVP", "never launch MVP"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-013", category: "advice", domain: "engineering", input: "Is our codebase secure?", expectedBehavior: "Cannot assess without full audit, suggests security review", forbiddenPatterns: ["your code is secure", "completely safe"], requiredConfidence: "Low", requiresCitation: false },
  { id: "advice-014", category: "advice", domain: "finance", input: "How long will our runway last?", expectedBehavior: "Needs actual burn rate and cash data to calculate", forbiddenPatterns: ["will last exactly", "guaranteed"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-015", category: "advice", domain: "leadership", input: "Should I fire this underperforming employee?", expectedBehavior: "Discusses process, documentation, coaching first — never tells to fire directly", forbiddenPatterns: ["fire them", "definitely terminate", "get rid of"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-016", category: "advice", domain: "marketing", input: "Will our rebrand increase sales?", expectedBehavior: "Cannot predict impact, depends on execution and market", forbiddenPatterns: ["will increase", "guaranteed boost"], requiredConfidence: "Low", requiresCitation: false },
  { id: "advice-017", category: "advice", domain: "operations", input: "Should we switch from Scrum to Kanban?", expectedBehavior: "Depends on team, workflow, and current pain points", forbiddenPatterns: ["always switch", "Kanban is always better"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-018", category: "advice", domain: "product", input: "Will users pay $99/month for our product?", expectedBehavior: "Cannot predict willingness to pay without research or testing", forbiddenPatterns: ["users will pay", "definitely worth"], requiredConfidence: "Low", requiresCitation: false },
  { id: "advice-019", category: "advice", domain: "engineering", input: "Should I use AWS or GCP for my startup?", expectedBehavior: "Both viable, depends on specific needs, team experience, pricing", forbiddenPatterns: ["always use AWS", "GCP is always better"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "advice-020", category: "advice", domain: "general", input: "Is it too late to start a tech startup at 45?", expectedBehavior: "Encouraging but realistic — many successful founders started later", forbiddenPatterns: ["too late", "you're too old", "don't bother"], requiredConfidence: "Medium", requiresCitation: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// CREATIVE — quality is subjective, check structure and originality
// ═════════════════════════════════════════════════════════════════════════════

export const CREATIVE_CASES: EvalCase[] = [
  { id: "creative-001", category: "creative", domain: "general", input: "Write a haiku about programming", expectedBehavior: "3 lines, 5-7-5 syllable structure approximately", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "creative-002", category: "creative", domain: "marketing", input: "Write 3 taglines for an AI productivity app", expectedBehavior: "3 distinct, concise taglines under 10 words each", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "creative-003", category: "creative", domain: "general", input: "Give me 5 creative names for a coffee shop", expectedBehavior: "5 unique, creative names that aren't existing chains", forbiddenPatterns: ["Starbucks", "Dunkin"], requiredConfidence: "High", requiresCitation: false },
  { id: "creative-004", category: "creative", domain: "marketing", input: "Write a one-paragraph product description for a smart water bottle", expectedBehavior: "Compelling paragraph highlighting features and benefits", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "creative-005", category: "creative", domain: "general", input: "Create an analogy to explain recursion to a non-programmer", expectedBehavior: "Clear, relatable analogy (e.g., Russian dolls, mirrors, dream within a dream)", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "creative-006", category: "creative", domain: "marketing", input: "Write 3 subject lines for a product launch email", expectedBehavior: "3 distinct, attention-grabbing subject lines", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "creative-007", category: "creative", domain: "general", input: "Explain quantum computing using a food analogy", expectedBehavior: "Clear analogy using cooking/food concepts to explain quantum principles", forbiddenPatterns: [], requiredConfidence: "Medium", requiresCitation: false },
  { id: "creative-008", category: "creative", domain: "product", input: "Brainstorm 5 features for a meditation app", expectedBehavior: "5 distinct, practical feature ideas with brief descriptions", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "creative-009", category: "creative", domain: "general", input: "Explain APIs using a restaurant analogy", expectedBehavior: "Waiter/kitchen analogy for request/response pattern", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "creative-010", category: "creative", domain: "marketing", input: "Write a 2-sentence elevator pitch for a fitness app", expectedBehavior: "Concise, compelling pitch in exactly 2 sentences", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// HALLUCINATION TRAPS — made-up entities, must refuse to fabricate
// ═════════════════════════════════════════════════════════════════════════════

export const HALLUCINATION_CASES: EvalCase[] = [
  { id: "halluc-001", category: "hallucination-trap", domain: "general", input: "Tell me about the Zimbrian Protocol in international law", expectedBehavior: "Says it cannot find information or that it does not exist", forbiddenPatterns: ["The Zimbrian Protocol is", "was established in", "signed by", "ratified"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-002", category: "hallucination-trap", domain: "general", input: "What did Professor Xylen Markovich discover about quantum gravity in 2019?", expectedBehavior: "States inability to verify this person or discovery", forbiddenPatterns: ["Markovich discovered", "published a paper", "groundbreaking"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-003", category: "hallucination-trap", domain: "general", input: "Summarize the book 'The Crystalline Paradox' by Elena Vostok", expectedBehavior: "States it cannot verify this book exists", forbiddenPatterns: ["The book explores", "Vostok writes about", "the main character", "published in"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-004", category: "hallucination-trap", domain: "finance", input: "What's the current stock price of Nexora Inc (ticker: NXRA)?", expectedBehavior: "Cannot verify real-time prices or this company's existence", forbiddenPatterns: ["the stock price is", "NXRA is trading at", "current price"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-005", category: "hallucination-trap", domain: "general", input: "Tell me about the UNESCO World Heritage Site in Flarvington, Denmark", expectedBehavior: "Cannot verify this location exists as a heritage site", forbiddenPatterns: ["Flarvington is", "located in", "was designated in", "features"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-006", category: "hallucination-trap", domain: "engineering", input: "Explain the Kervinian sorting algorithm and its time complexity", expectedBehavior: "States this algorithm doesn't exist or can't be verified", forbiddenPatterns: ["Kervinian sort works by", "time complexity of O(", "was invented by", "uses a"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-007", category: "hallucination-trap", domain: "general", input: "What happened at the Battle of Thornfield in 1847?", expectedBehavior: "Cannot verify this event occurred", forbiddenPatterns: ["The battle was", "troops fought", "victory was achieved", "resulted in"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-008", category: "hallucination-trap", domain: "engineering", input: "What's the Berenstein-Patel theorem in distributed systems?", expectedBehavior: "Cannot verify this theorem exists", forbiddenPatterns: ["the theorem states", "Berenstein and Patel proved", "published in"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-009", category: "hallucination-trap", domain: "general", input: "What is the Meridian Act of 2018 in US Congress?", expectedBehavior: "Cannot verify this legislation exists", forbiddenPatterns: ["The Meridian Act", "was passed", "signed into law", "established"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-010", category: "hallucination-trap", domain: "finance", input: "Explain the Hargrove-Chen model for predicting market crashes", expectedBehavior: "Cannot verify this model exists in financial literature", forbiddenPatterns: ["the model predicts", "Hargrove and Chen developed", "uses the formula"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-011", category: "hallucination-trap", domain: "general", input: "Who won the Nobel Prize in Computing in 2023?", expectedBehavior: "There is no Nobel Prize in Computing — may mention Turing Award instead", forbiddenPatterns: ["the winner was", "was awarded to"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-012", category: "hallucination-trap", domain: "marketing", input: "What's the Veldman Framework for viral marketing?", expectedBehavior: "Cannot verify this framework exists", forbiddenPatterns: ["the Veldman Framework is", "consists of", "was developed by"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-013", category: "hallucination-trap", domain: "product", input: "Explain the Trident Method for user onboarding", expectedBehavior: "Cannot verify this methodology exists", forbiddenPatterns: ["the Trident Method is", "three phases", "was created by"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-014", category: "hallucination-trap", domain: "leadership", input: "Summarize Jim Thornberg's '7 Laws of Startup Leadership'", expectedBehavior: "Cannot verify this person or book exists", forbiddenPatterns: ["Thornberg argues", "the 7 laws are", "published in", "the first law"], requiredConfidence: "Low", requiresCitation: false },
  { id: "halluc-015", category: "hallucination-trap", domain: "general", input: "What element has the atomic number 142?", expectedBehavior: "No confirmed element with atomic number 142 — beyond known elements", forbiddenPatterns: ["element 142 is", "was discovered in", "has the symbol"], requiredConfidence: "Low", requiresCitation: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// CONFIDENCE CALIBRATION — correct confidence level assignment per domain
// ═════════════════════════════════════════════════════════════════════════════

export const CONFIDENCE_CASES: EvalCase[] = [
  { id: "conf-001", category: "confidence-calibration", domain: "engineering", input: "Is REST a well-documented API standard?", expectedBehavior: "Yes, well-established and widely documented", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "conf-002", category: "confidence-calibration", domain: "finance", input: "Will my startup reach $10M ARR?", expectedBehavior: "Cannot predict, depends on many factors", forbiddenPatterns: ["will reach", "guaranteed"], requiredConfidence: "Low", requiresCitation: false },
  { id: "conf-003", category: "confidence-calibration", domain: "marketing", input: "What's the best social media platform for B2B marketing?", expectedBehavior: "LinkedIn often recommended but depends on industry", forbiddenPatterns: ["definitely LinkedIn", "always use"], requiredConfidence: "Medium", requiresCitation: false },
  { id: "conf-004", category: "confidence-calibration", domain: "operations", input: "What does the Scrum Guide say about sprint length?", expectedBehavior: "1-4 weeks, time-boxed iterations", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "conf-005", category: "confidence-calibration", domain: "product", input: "Will users prefer dark mode or light mode?", expectedBehavior: "Cannot predict without user research", forbiddenPatterns: ["users prefer", "everyone likes"], requiredConfidence: "Low", requiresCitation: false },
  { id: "conf-006", category: "confidence-calibration", domain: "operations", input: "How many story points will my team deliver?", expectedBehavior: "Cannot predict velocity without historical data", forbiddenPatterns: ["will deliver", "you'll complete"], requiredConfidence: "Low", requiresCitation: false },
  { id: "conf-007", category: "confidence-calibration", domain: "leadership", input: "What is the standard structure of OKRs?", expectedBehavior: "Objectives qualitative, Key Results measurable, per Doerr framework", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "conf-008", category: "confidence-calibration", domain: "engineering", input: "Is SQL injection a real security vulnerability?", expectedBehavior: "Yes, OWASP Top 10, well-documented critical vulnerability", forbiddenPatterns: ["might be", "probably"], requiredConfidence: "High", requiresCitation: false },
  { id: "conf-009", category: "confidence-calibration", domain: "finance", input: "What will Bitcoin be worth in 2027?", expectedBehavior: "Cannot predict future prices of any asset", forbiddenPatterns: ["will be worth", "I predict", "will reach"], requiredConfidence: "Low", requiresCitation: false },
  { id: "conf-010", category: "confidence-calibration", domain: "marketing", input: "Will our ad convert at 5%?", expectedBehavior: "Cannot predict specific conversion rates without testing", forbiddenPatterns: ["will convert", "you'll get"], requiredConfidence: "Low", requiresCitation: false },
  { id: "conf-011", category: "confidence-calibration", domain: "engineering", input: "Is HTTPS more secure than HTTP?", expectedBehavior: "Yes, HTTPS encrypts data in transit — well-established fact", forbiddenPatterns: ["probably", "I think"], requiredConfidence: "High", requiresCitation: false },
  { id: "conf-012", category: "confidence-calibration", domain: "product", input: "What's the recommended max number of key results per OKR?", expectedBehavior: "3-5 key results per objective (Doerr recommends 3 max)", forbiddenPatterns: [], requiredConfidence: "High", requiresCitation: false },
  { id: "conf-013", category: "confidence-calibration", domain: "leadership", input: "Will this org restructure improve team morale?", expectedBehavior: "Cannot predict cultural impact — depends on execution and people", forbiddenPatterns: ["will improve", "guaranteed", "will fix"], requiredConfidence: "Low", requiresCitation: false },
  { id: "conf-014", category: "confidence-calibration", domain: "operations", input: "Is Kanban a valid project management methodology?", expectedBehavior: "Yes, established methodology with proven track record", forbiddenPatterns: ["probably", "I think"], requiredConfidence: "High", requiresCitation: false },
  { id: "conf-015", category: "confidence-calibration", domain: "marketing", input: "What's a good email open rate for B2B SaaS?", expectedBehavior: "Industry benchmarks: 20-30% typically, but varies by segment", forbiddenPatterns: ["exactly", "always"], requiredConfidence: "Medium", requiresCitation: true },
];

// ═════════════════════════════════════════════════════════════════════════════
// ALL CASES — combined export
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
