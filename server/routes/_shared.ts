/**
 * Shared state and helpers for domain routers.
 *
 * Not a Router — utilities only. Domain routers import from here rather
 * than re-declaring cost tables, skill metadata, the OpenAI client, etc.
 */

import { getOpenAI } from "../ai-provider";
import { AGENT_REGISTRY, getAgentsByDomain } from "../agents/agent-registry";
import type {
  AgentDefinition,
  AdvisorDomain,
} from "../../shared/agent-schema";

// ── OpenAI client (cached) ──────────────────────────────────────────────────

export const openai = getOpenAI();

// ── Performance logging ─────────────────────────────────────────────────────

export const COST_PER_1M_INPUT: Record<string, number> = {
  "gpt-4o-mini": 0.15,
  "gpt-4o": 1.0,
  "claude-sonnet-4-6": 3.0,
};

export function perfLog(data: Record<string, unknown>): void {
  console.log(`[perf] ${JSON.stringify(data)}`);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Agent metadata (cached, never changes at runtime) ──────────────────────

const SKILL_ICONS: Record<AdvisorDomain, string> = {
  engineering: "code",
  marketing: "megaphone",
  product: "package",
  finance: "bar-chart",
  leadership: "compass",
  operations: "settings",
  legal: "shield-checkmark",
  education: "school",
  health: "heart",
};

const SKILL_DESCRIPTIONS: Record<string, string> = {
  "engineering-architect": "System design, scalability, and infrastructure architecture",
  "engineering-code-reviewer": "Code quality, refactoring, and pull request reviews",
  "security-auditor": "Vulnerability assessment, threat modeling, and OWASP compliance",
  "fullstack-engineer": "Modern web development across React, Node, TypeScript, and APIs",
  "gtm-strategist": "Go-to-market positioning, ICP definition, and launch strategy",
  "content-strategist": "Editorial planning, SEO strategy, and content-market fit",
  "growth-marketer": "Funnel optimization, AARRR metrics, and growth experiments",
  "product-manager": "PRDs, RICE prioritization, and product requirements",
  "ux-researcher": "User research methods, usability testing, and design insights",
  "roadmap-planner": "Quarterly planning, OKR alignment, and dependency mapping",
  "financial-analyst": "Unit economics, P&L analysis, and financial health metrics",
  "saas-metrics-coach": "MRR, NRR, churn analysis, and SaaS benchmarking",
  "startup-ceo": "Company strategy, fundraising, and leadership decisions",
  "cto-advisor": "Tech strategy, engineering org design, and build-vs-buy decisions",
  "okr-coach": "Objective and key result setting, alignment, and goal quality",
  "senior-pm": "Project delivery, critical path analysis, and stakeholder management",
  "scrum-master": "Scrum ceremonies, team health, and continuous improvement",
  "technical-writer": "Documentation strategy, Diataxis framework, and content structure",
  "legal-contract-reviewer": "Contract risk analysis, clause explanation, and amendment suggestions",
  "legal-compliance-advisor": "GDPR, CCPA, HIPAA compliance checklists and gap analysis",
  "curriculum-designer": "Course design with backward design, Bloom's taxonomy, and assessment alignment",
  "tutoring-expert": "Socratic teaching, scaffolded learning, and concept explanation",
  "wellness-coach": "Evidence-based wellness, habit formation, and fitness principles",
  "data-engineer": "Data pipelines, ETL/ELT, warehousing, and data modeling",
  "brand-strategist": "Brand identity, voice and tone, positioning, and brand architecture",
  "investor-relations": "Pitch decks, cap tables, term sheets, and investor updates",
};

export function buildSkillSummary(agent: AgentDefinition) {
  return {
    id: agent.id,
    name: agent.name,
    domain: agent.domain,
    icon: SKILL_ICONS[agent.domain as AdvisorDomain] ?? "ellipsis",
    description: SKILL_DESCRIPTIONS[agent.id] || agent.name,
    chainsWith: agent.chainsWith,
    triggerKeywords: agent.triggerKeywords,
  };
}

let cachedSkillsResponse: Record<string, ReturnType<typeof buildSkillSummary>[]> | null = null;

export function getGroupedSkills(): Record<string, ReturnType<typeof buildSkillSummary>[]> {
  if (cachedSkillsResponse) return cachedSkillsResponse;
  const domains: AdvisorDomain[] = ["engineering", "marketing", "product", "finance", "leadership", "operations"];
  cachedSkillsResponse = {};
  for (const domain of domains) {
    cachedSkillsResponse[domain] = getAgentsByDomain(domain).map(buildSkillSummary);
  }
  return cachedSkillsResponse;
}

export function getAllSkillIds(): string[] {
  return Array.from(AGENT_REGISTRY.keys());
}

// ── Conversation heartbeat ──────────────────────────────────────────────────

export async function conversationHeartbeat(conversationId: string): Promise<void> {
  try {
    const { query } = await import("../db");
    await query("UPDATE conversations SET updated_at = NOW() WHERE id = $1", [conversationId]);
  } catch {
    /* swallow — heartbeat is best-effort */
  }
}
