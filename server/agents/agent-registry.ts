/**
 * Agent Registry — single registry for every agent in Aura.
 *
 * Replaces the old advisor-only registry. Pipeline agents (Virtual Company Engine)
 * and chat-time advisors live side-by-side here; they differ only in the
 * `layer` and `phases` fields of AgentDefinition.
 *
 * Design rules:
 *   - Every agent ships as a module under ./advisors or ./pipeline and is
 *     registered at module load time via this file's imports.
 *   - The registry is frozen once at load time.
 *   - Query helpers never mutate the map.
 */

import type {
  AgentDefinition,
  AgentDomain,
  AgentLayer,
  PipelinePhase,
} from "../../shared/agent-schema";

// ── Advisor imports (chat-time domain expertise) ────────────────────────────

import { brandStrategist } from "./advisors/brand-strategist";
import { contentStrategist } from "./advisors/content-strategist";
import { ctoAdvisor } from "./advisors/cto-advisor";
import { curriculumDesigner } from "./advisors/curriculum-designer";
import { dataEngineer } from "./advisors/data-engineer";
import { engineeringArchitect } from "./advisors/engineering-architect";
import { engineeringCodeReviewer } from "./advisors/engineering-code-reviewer";
import { financialAnalyst } from "./advisors/financial-analyst";
import { fullstackEngineer } from "./advisors/fullstack-engineer";
import { growthMarketer } from "./advisors/growth-marketer";
import { gtmStrategist } from "./advisors/gtm-strategist";
import { investorRelations } from "./advisors/investor-relations";
import { legalComplianceAdvisor } from "./advisors/legal-compliance-advisor";
import { legalContractReviewer } from "./advisors/legal-contract-reviewer";
import { okrCoach } from "./advisors/okr-coach";
import { productManager } from "./advisors/product-manager";
import { roadmapPlanner } from "./advisors/roadmap-planner";
import { saasMetricsCoach } from "./advisors/saas-metrics-coach";
import { scrumMaster } from "./advisors/scrum-master";
import { securityAuditor } from "./advisors/security-auditor";
import { seniorPm } from "./advisors/senior-pm";
import { startupCeo } from "./advisors/startup-ceo";
import { technicalWriter } from "./advisors/technical-writer";
import { tutoringExpert } from "./advisors/tutoring-expert";
import { uxResearcher } from "./advisors/ux-researcher";
import { wellnessCoach } from "./advisors/wellness-coach";

// ── Pipeline imports (Virtual Company Engine roster) ────────────────────────

import { PIPELINE_AGENTS } from "./pipeline";

// ── Registry ────────────────────────────────────────────────────────────────

export const AGENT_REGISTRY: Map<string, AgentDefinition> = new Map();

/** Register an agent. Throws if the id is already taken. */
export function registerAgent(agent: AgentDefinition): void {
  if (AGENT_REGISTRY.has(agent.id)) {
    throw new Error(`Duplicate agent id: ${agent.id}`);
  }
  AGENT_REGISTRY.set(agent.id, agent);
}

// Bulk-register advisors. Registration order determines the default pick
// for getAgentsByDomain() — we preserve the legacy order so downstream
// tests that expect the historical "first agent in domain" selection keep
// passing.
for (const agent of [
  engineeringArchitect,
  engineeringCodeReviewer,
  securityAuditor,
  fullstackEngineer,
  gtmStrategist,
  contentStrategist,
  growthMarketer,
  productManager,
  uxResearcher,
  roadmapPlanner,
  financialAnalyst,
  saasMetricsCoach,
  ctoAdvisor,
  startupCeo,
  okrCoach,
  seniorPm,
  scrumMaster,
  technicalWriter,
  legalContractReviewer,
  legalComplianceAdvisor,
  curriculumDesigner,
  tutoringExpert,
  wellnessCoach,
  dataEngineer,
  brandStrategist,
  investorRelations,
]) {
  registerAgent(agent);
}

// Pipeline agents (executives, leads, specialists). Order is preserved so
// getAgentsByLayer() / getAgentsForPhase() iteration order is stable for tests.
for (const agent of PIPELINE_AGENTS) {
  registerAgent(agent);
}

// ── Query helpers ───────────────────────────────────────────────────────────

/** Get an agent by id. */
export function getAgent(id: string): AgentDefinition | undefined {
  return AGENT_REGISTRY.get(id);
}

/** All agents at a given layer (executive | lead | specialist | advisor). */
export function getAgentsByLayer(layer: AgentLayer): AgentDefinition[] {
  return Array.from(AGENT_REGISTRY.values()).filter((a) => a.layer === layer);
}

/** All agents in a given functional domain. */
export function getAgentsByDomain(domain: AgentDomain): AgentDefinition[] {
  return Array.from(AGENT_REGISTRY.values()).filter((a) => a.domain === domain);
}

/** All agents that participate in a given pipeline phase. */
export function getAgentsForPhase(phase: PipelinePhase): AgentDefinition[] {
  return Array.from(AGENT_REGISTRY.values()).filter((a) => a.phases.includes(phase));
}

/** Agents whose trigger keywords match the user's message (case-insensitive). */
export function matchAgentsByKeywords(message: string): AgentDefinition[] {
  const lower = message.toLowerCase();
  return Array.from(AGENT_REGISTRY.values()).filter((a) =>
    a.triggerKeywords.some((kw) => lower.includes(kw.toLowerCase()))
  );
}

/** Resolve an agent's chainsWith field to the actual AgentDefinition list. */
export function getChainedAgents(agentId: string): AgentDefinition[] {
  const agent = AGENT_REGISTRY.get(agentId);
  if (!agent) return [];
  return agent.chainsWith
    .map((id) => AGENT_REGISTRY.get(id))
    .filter((a): a is AgentDefinition => a !== undefined);
}
