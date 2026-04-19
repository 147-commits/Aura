/**
 * Agent Router — two-layer domain detection with agent chaining.
 *
 * Design: fast heuristic path first, API call only when heuristics fail.
 * Cost target: < $0.0001 per routing decision.
 *
 * Layer 1: keyword scoring (free, instant)
 * Layer 2: gpt-4o-mini classification (only when Layer 1 returns null)
 *
 * Note: the router operates on the 9 "advisor domains" that currently have
 * agents registered. AgentDomain is wider (14 values) to accommodate future
 * pipeline agents, but until those domains have agents, they are not routable.
 */

import OpenAI from "openai";
import type {
  AgentDefinition,
  AdvisorDomain,
} from "../../shared/agent-schema";
import { getAgentsByDomain } from "./agent-registry";
import type { AgentContext } from "../truth-engine";

/** Domains the router actively considers (mirrors current advisor coverage). */
const DOMAINS: AdvisorDomain[] = [
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
const DOMAIN_KEYWORDS: Record<AdvisorDomain, string[]> = {
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
    "tech strategy", "cto", "build vs buy", "technical debt",
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

export function scoreDomains(message: string): Record<AdvisorDomain, number> {
  const lower = message.toLowerCase();
  const scores = {} as Record<AdvisorDomain, number>;
  for (const domain of DOMAINS) {
    scores[domain] = DOMAIN_KEYWORDS[domain].filter((kw) =>
      lower.includes(kw)
    ).length;
  }
  return scores;
}

export function heuristicDomain(message: string): AdvisorDomain | null {
  const scores = scoreDomains(message);
  let best: AdvisorDomain | null = null;
  let bestScore = 0;

  for (const domain of DOMAINS) {
    if (scores[domain] >= MATCH_THRESHOLD && scores[domain] > bestScore) {
      best = domain;
      bestScore = scores[domain];
    }
  }

  if (best) {
    console.log(`[agent-router] Layer 1 heuristic: ${best} (score: ${bestScore})`);
  }
  return best;
}

// ── Layer 2: AI Classification ──────────────────────────────────────────────

export async function detectDomainAI(
  message: string,
  projectContext: string,
  openai: OpenAI
): Promise<AdvisorDomain | "general"> {
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
    const valid: (AdvisorDomain | "general")[] = [...DOMAINS, "general"];
    const result = valid.includes(raw as AdvisorDomain | "general")
      ? (raw as AdvisorDomain | "general")
      : "general";

    console.log(`[agent-router] Layer 2 AI: ${result} (raw: "${raw}")`);
    return result;
  } catch (err) {
    console.warn("[agent-router] Layer 2 AI failed, defaulting to general:", err);
    return "general";
  }
}

// ── Routing Result ──────────────────────────────────────────────────────────

export interface RouteResult {
  primary: AdvisorDomain;
  secondary: AdvisorDomain | null;
  layer: "heuristic" | "ai";
}

export async function routeAgents(
  message: string,
  projectContext: string,
  memories: { text: string; category: string }[],
  openai: OpenAI
): Promise<RouteResult> {
  const scores = scoreDomains(message);

  const ranked = DOMAINS
    .map((d) => ({ domain: d, score: scores[d] }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const runner = ranked[1];

  if (top.score >= MATCH_THRESHOLD && runner.score >= MATCH_THRESHOLD) {
    const secondary = validateChaining(top.domain, runner.domain);
    console.log(
      `[agent-router] Multi-domain: ${top.domain}(${top.score}) + ${runner.domain}(${runner.score}), chained: ${secondary !== null}`
    );
    return { primary: top.domain, secondary, layer: "heuristic" };
  }

  if (top.score >= MATCH_THRESHOLD) {
    console.log(`[agent-router] Single domain: ${top.domain}(${top.score})`);
    return { primary: top.domain, secondary: null, layer: "heuristic" };
  }

  const memoryContext = memories
    .slice(0, 3)
    .map((m) => m.text)
    .join("; ")
    .slice(0, 100);
  const fullContext = [projectContext, memoryContext].filter(Boolean).join(" | ");
  const aiDomain = await detectDomainAI(message, fullContext, openai);

  if (aiDomain === "general") {
    return { primary: "engineering", secondary: null, layer: "ai" };
  }

  return { primary: aiDomain, secondary: null, layer: "ai" };
}

// ── Chaining Validation ─────────────────────────────────────────────────────

function validateChaining(
  primaryDomain: AdvisorDomain,
  secondaryDomain: AdvisorDomain
): AdvisorDomain | null {
  const primaryAgents = getAgentsByDomain(primaryDomain);
  const secondaryAgents = getAgentsByDomain(secondaryDomain);
  const secondaryIds = new Set(secondaryAgents.map((a) => a.id));

  for (const agent of primaryAgents) {
    if (agent.chainsWith.some((id) => secondaryIds.has(id))) {
      return secondaryDomain;
    }
  }
  return null;
}

// ── Prompt Composition ──────────────────────────────────────────────────────

export function composeChainedPrompt(
  primary: AgentDefinition,
  secondary: AgentDefinition,
  _context: AgentContext
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
