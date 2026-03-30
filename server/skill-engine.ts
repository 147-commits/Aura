/**
 * Skill Engine — adds domain expertise to Aura's responses.
 *
 * Skills provide frameworks and structure for specific professional domains.
 * They CANNOT change Aura's core tone (calm, trusted colleague),
 * CANNOT remove confidence ratings, and CANNOT enable hallucination.
 * They only layer domain-specific reasoning on top of Aura's base behavior.
 */

export type SkillDomain =
  | "engineering"
  | "marketing"
  | "product"
  | "finance"
  | "leadership"
  | "operations";

export interface ConfidenceRules {
  /** When to assign High confidence */
  high: string;
  /** When to assign Medium confidence */
  medium: string;
  /** When to assign Low confidence */
  low: string;
}

export interface SkillDefinition {
  /** Unique skill identifier (matches filename without extension) */
  id: string;
  /** Human-readable skill name */
  name: string;
  /** Professional domain this skill belongs to */
  domain: SkillDomain;
  /** Keywords that trigger this skill's activation */
  triggerKeywords: string[];
  /** Domain-specific system prompt injected when skill is active */
  systemPrompt: string;
  /** Rules governing confidence level assignment for this domain */
  confidenceRules: ConfidenceRules;
  /** IDs of skills this one composes well with */
  chainsWith: string[];
}

// ── Skill Registry ──────────────────────────────────────────────────────────

import { engineeringArchitect } from "./skills/engineering-architect";
import { engineeringCodeReviewer } from "./skills/engineering-code-reviewer";
import { securityAuditor } from "./skills/security-auditor";
import { fullstackEngineer } from "./skills/fullstack-engineer";
import { gtmStrategist } from "./skills/gtm-strategist";
import { contentStrategist } from "./skills/content-strategist";
import { growthMarketer } from "./skills/growth-marketer";
import { productManager } from "./skills/product-manager";
import { uxResearcher } from "./skills/ux-researcher";
import { roadmapPlanner } from "./skills/roadmap-planner";
import { financialAnalyst } from "./skills/financial-analyst";
import { saasMetricsCoach } from "./skills/saas-metrics-coach";
import { startupCeo } from "./skills/startup-ceo";
import { ctoAdvisor } from "./skills/cto-advisor";
import { okrCoach } from "./skills/okr-coach";
import { seniorPm } from "./skills/senior-pm";
import { scrumMaster } from "./skills/scrum-master";
import { technicalWriter } from "./skills/technical-writer";

/** All registered skills, keyed by skill ID */
export const SKILL_REGISTRY: Map<string, SkillDefinition> = new Map([
  [engineeringArchitect.id, engineeringArchitect],
  [engineeringCodeReviewer.id, engineeringCodeReviewer],
  [securityAuditor.id, securityAuditor],
  [fullstackEngineer.id, fullstackEngineer],
  [gtmStrategist.id, gtmStrategist],
  [contentStrategist.id, contentStrategist],
  [growthMarketer.id, growthMarketer],
  [productManager.id, productManager],
  [uxResearcher.id, uxResearcher],
  [roadmapPlanner.id, roadmapPlanner],
  [financialAnalyst.id, financialAnalyst],
  [saasMetricsCoach.id, saasMetricsCoach],
  [startupCeo.id, startupCeo],
  [ctoAdvisor.id, ctoAdvisor],
  [okrCoach.id, okrCoach],
  [seniorPm.id, seniorPm],
  [scrumMaster.id, scrumMaster],
  [technicalWriter.id, technicalWriter],
]);

// ── Query Functions ─────────────────────────────────────────────────────────

/** Get all skills for a specific domain */
export function getSkillsByDomain(domain: SkillDomain): SkillDefinition[] {
  return Array.from(SKILL_REGISTRY.values()).filter(
    (skill) => skill.domain === domain
  );
}

/** Find skills whose trigger keywords match the user's message */
export function matchSkills(message: string): SkillDefinition[] {
  const lower = message.toLowerCase();
  return Array.from(SKILL_REGISTRY.values()).filter((skill) =>
    skill.triggerKeywords.some((kw) => lower.includes(kw.toLowerCase()))
  );
}

/** Get a skill by ID */
export function getSkill(id: string): SkillDefinition | undefined {
  return SKILL_REGISTRY.get(id);
}

/** Get skills that chain well with a given skill */
export function getChainedSkills(skillId: string): SkillDefinition[] {
  const skill = SKILL_REGISTRY.get(skillId);
  if (!skill) return [];
  return skill.chainsWith
    .map((id) => SKILL_REGISTRY.get(id))
    .filter((s): s is SkillDefinition => s !== undefined);
}
