/**
 * Skill Router — two-layer domain detection with skill chaining.
 *
 * Design: fast heuristic path first, API call only when heuristics fail.
 * Cost target: < $0.0001 per routing decision.
 *
 * Layer 1: keyword scoring (free, instant)
 * Layer 2: gpt-4o-mini classification (only when Layer 1 returns null)
 */

import OpenAI from "openai";
import {
  type SkillDomain,
  type SkillDefinition,
  getSkillsByDomain,
} from "./skill-engine";
import type { SkillContext } from "./truth-engine";

/** All routable domains */
const DOMAINS: SkillDomain[] = [
  "engineering",
  "marketing",
  "product",
  "finance",
  "leadership",
  "operations",
  "legal",
  "education",
  "health",
];

/** Keyword scoring matrix — 2+ matches in a category triggers detection */
const DOMAIN_KEYWORDS: Record<SkillDomain, string[]> = {
  engineering: [
    "api", "deploy", "database", "architecture", "microservice",
    "frontend", "backend", "kubernetes", "ci/cd", "typescript",
    "react", "docker", "infrastructure", "server", "endpoint",
  ],
  marketing: [
    "gtm", "positioning", "seo", "campaign", "brand",
    "content strategy", "funnel", "ad copy", "launch",
    "ideal customer", "icp", "growth",
  ],
  product: [
    "prd", "user story", "roadmap", "prioritize", "feature",
    "mvp", "wireframe", "ux", "user research",
    "acceptance criteria", "sprint",
  ],
  finance: [
    "revenue", "mrr", "burn rate", "runway", "valuation",
    "unit economics", "p&l", "arr", "cac", "ltv",
    "ebitda", "fundraising",
  ],
  leadership: [
    "okr", "hiring", "culture", "strategy", "vision",
    "mission", "board", "investors", "co-founder", "org design",
  ],
  operations: [
    "process", "workflow", "scrum", "kanban", "sprint",
    "velocity", "retrospective", "documentation", "runbook",
  ],
  legal: [
    "contract", "compliance", "GDPR", "CCPA", "HIPAA",
    "terms of service", "liability", "NDA", "regulation",
    "legal review", "indemnification", "intellectual property",
  ],
  education: [
    "curriculum", "lesson plan", "learning objectives", "syllabus",
    "teach me", "explain like", "course design", "pedagogy",
    "training program", "study", "tutor",
  ],
  health: [
    "exercise", "nutrition", "sleep", "stress management",
    "workout", "diet", "fitness", "meditation", "wellness",
    "healthy habits", "mental health",
  ],
};

/** Minimum keyword matches required to trigger a domain */
const MATCH_THRESHOLD = 2;

/** Max combined characters for a chained prompt */
const CHAINED_PROMPT_BUDGET = 900;

// ── Layer 1: Heuristic Scoring ──────────────────────────────────────────────

/**
 * Returns raw keyword match counts for each domain.
 * Used to detect multi-domain queries and rank domains by relevance.
 */
export function scoreDomains(message: string): Record<SkillDomain, number> {
  const lower = message.toLowerCase();
  const scores = {} as Record<SkillDomain, number>;
  for (const domain of DOMAINS) {
    scores[domain] = DOMAIN_KEYWORDS[domain].filter((kw) =>
      lower.includes(kw)
    ).length;
  }
  return scores;
}

/**
 * Fast keyword-based domain detection — no API call.
 * Returns the highest-scoring domain if it meets the threshold, or null.
 */
export function heuristicDomain(message: string): SkillDomain | null {
  const scores = scoreDomains(message);
  let best: SkillDomain | null = null;
  let bestScore = 0;

  for (const domain of DOMAINS) {
    if (scores[domain] >= MATCH_THRESHOLD && scores[domain] > bestScore) {
      best = domain;
      bestScore = scores[domain];
    }
  }

  if (best) {
    console.log(`[skill-router] Layer 1 heuristic: ${best} (score: ${bestScore})`);
  }
  return best;
}

// ── Layer 2: AI Classification ──────────────────────────────────────────────

/**
 * AI-powered domain classification using gpt-4o-mini.
 * Only called when heuristic scoring fails (no domain reaches threshold).
 * Returns "general" as a typed string if classification fails.
 */
export async function detectDomainAI(
  message: string,
  projectContext: string,
  openai: OpenAI
): Promise<SkillDomain | "general"> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Classify domain. Return ONE word only.
engineering|marketing|product|finance|leadership|operations|general

Context: ${projectContext.slice(0, 100)}
Message: ${message.slice(0, 300)}`,
        },
      ],
      max_completion_tokens: 10,
    });

    const raw = response.choices[0]?.message?.content?.trim().toLowerCase() || "";
    const valid: (SkillDomain | "general")[] = [...DOMAINS, "general"];
    const result = valid.includes(raw as SkillDomain | "general")
      ? (raw as SkillDomain | "general")
      : "general";

    console.log(`[skill-router] Layer 2 AI: ${result} (raw: "${raw}")`);
    return result;
  } catch (err) {
    console.warn("[skill-router] Layer 2 AI failed, defaulting to general:", err);
    return "general";
  }
}

// ── Routing Result ──────────────────────────────────────────────────────────

export interface RouteResult {
  /** Primary domain detected */
  primary: SkillDomain;
  /** Secondary domain for chaining, or null if single-domain query */
  secondary: SkillDomain | null;
  /** Which layer made the primary decision */
  layer: "heuristic" | "ai";
}

/**
 * Full routing pipeline: heuristic first, AI fallback, with chaining detection.
 *
 * 1. Score all domains via keyword matching
 * 2. If top 2 domains both meet threshold: return both (chained)
 * 3. If only one meets threshold: return primary only
 * 4. If none meet threshold: use AI for primary, no secondary
 * 5. Validate chaining: secondary must appear in primary skill's chainsWith
 */
export async function routeSkills(
  message: string,
  projectContext: string,
  memories: { text: string; category: string }[],
  openai: OpenAI
): Promise<RouteResult> {
  const scores = scoreDomains(message);

  // Sort domains by score descending
  const ranked = DOMAINS
    .map((d) => ({ domain: d, score: scores[d] }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const runner = ranked[1];

  // Both top domains meet threshold — potential chaining
  if (top.score >= MATCH_THRESHOLD && runner.score >= MATCH_THRESHOLD) {
    const secondary = validateChaining(top.domain, runner.domain);
    console.log(
      `[skill-router] Multi-domain: ${top.domain}(${top.score}) + ${runner.domain}(${runner.score}), chained: ${secondary !== null}`
    );
    return { primary: top.domain, secondary, layer: "heuristic" };
  }

  // Single domain meets threshold
  if (top.score >= MATCH_THRESHOLD) {
    console.log(`[skill-router] Single domain: ${top.domain}(${top.score})`);
    return { primary: top.domain, secondary: null, layer: "heuristic" };
  }

  // No domain meets threshold — fall back to AI
  const memoryContext = memories
    .slice(0, 3)
    .map((m) => m.text)
    .join("; ")
    .slice(0, 100);
  const fullContext = [projectContext, memoryContext].filter(Boolean).join(" | ");
  const aiDomain = await detectDomainAI(message, fullContext, openai);

  if (aiDomain === "general") {
    // No specific domain detected — return engineering as safe default
    return { primary: "engineering", secondary: null, layer: "ai" };
  }

  return { primary: aiDomain, secondary: null, layer: "ai" };
}

// ── Chaining Validation ─────────────────────────────────────────────────────

/**
 * Validates that the secondary domain can chain with the primary.
 * Returns the secondary domain if any skill in the primary domain
 * lists a skill from the secondary domain in its chainsWith array.
 * Returns null if chaining is not valid.
 */
function validateChaining(
  primaryDomain: SkillDomain,
  secondaryDomain: SkillDomain
): SkillDomain | null {
  const primarySkills = getSkillsByDomain(primaryDomain);
  const secondarySkills = getSkillsByDomain(secondaryDomain);
  const secondaryIds = new Set(secondarySkills.map((s) => s.id));

  for (const skill of primarySkills) {
    if (skill.chainsWith.some((id) => secondaryIds.has(id))) {
      return secondaryDomain;
    }
  }
  return null;
}

// ── Prompt Composition ──────────────────────────────────────────────────────

/**
 * Composes a chained prompt from primary and secondary skills.
 * Primary prompt is preserved in full; secondary is truncated first
 * if the combined output exceeds the 900-character budget.
 */
export function composeChainedPrompt(
  primary: SkillDefinition,
  secondary: SkillDefinition,
  context: SkillContext
): string {
  const primaryHeader = `PRIMARY EXPERTISE — ${primary.name}:\n`;
  const secondaryHeader = `\n\nSECONDARY LENS — ${secondary.name}:\nAlso consider ${secondary.name} perspective:\n`;
  const integrationNote =
    `\n\nINTEGRATION: Address the primary domain first (${primary.name}), ` +
    `then add ${secondary.name} considerations as a clearly labeled section.`;

  const overhead = primaryHeader.length + secondaryHeader.length + integrationNote.length;
  const contentBudget = CHAINED_PROMPT_BUDGET - overhead;

  if (contentBudget <= 40) {
    return primaryHeader + primary.systemPrompt.slice(0, CHAINED_PROMPT_BUDGET - primaryHeader.length - 3) + "...";
  }

  // Split budget: 60% primary, 40% secondary
  const primaryBudget = Math.floor(contentBudget * 0.6);
  const secondaryBudget = contentBudget - primaryBudget;

  const primaryText = primary.systemPrompt.length <= primaryBudget
    ? primary.systemPrompt
    : primary.systemPrompt.slice(0, primaryBudget - 3) + "...";

  const secondaryText = secondary.systemPrompt.length <= secondaryBudget
    ? secondary.systemPrompt
    : secondary.systemPrompt.slice(0, secondaryBudget - 3) + "...";

  return primaryHeader + primaryText + secondaryHeader + secondaryText + integrationNote;
}
