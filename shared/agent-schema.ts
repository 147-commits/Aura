/**
 * Canonical Agent schema.
 *
 * Single source of truth for every agent definition across Aura — advisors
 * (chat-time domain expertise) and pipeline agents (Virtual Company Engine
 * agents mounted to Discovery → Design → Planning → Implementation →
 * Verification → Release → GTM phases).
 *
 * Import from this file everywhere. Do not redeclare these types.
 */

/** Where an agent sits in the org hierarchy. */
export type AgentLayer = "executive" | "lead" | "specialist" | "advisor";

/** Functional domain an agent works in. */
export type AgentDomain =
  | "engineering"
  | "product"
  | "design"
  | "security"
  | "operations"
  | "marketing"
  | "finance"
  | "legal"
  | "data"
  | "support"
  | "research"
  | "education"
  | "health"
  | "leadership";

/** A phase of the Virtual Company Engine pipeline. */
export type PipelinePhase =
  | "discovery"
  | "design"
  | "planning"
  | "implementation"
  | "verification"
  | "release"
  | "gtm";

/** Model routing tier. */
export type ModelTier = "mini" | "standard" | "skill" | "frontier";

/** Narrower subset of AgentDomain that currently has confidence rules. */
export type AdvisorDomain =
  | "engineering"
  | "marketing"
  | "product"
  | "finance"
  | "leadership"
  | "operations"
  | "legal"
  | "education"
  | "health";

/** Domain-specific confidence rules for the calibrator. */
export interface AgentConfidenceRules {
  /** When to assign High confidence */
  high: string;
  /** When to assign Medium confidence */
  medium: string;
  /** When to assign Low confidence */
  low: string;
}

/**
 * The canonical agent definition. Used by both chat-time advisors and
 * pipeline-time Virtual Company Engine agents.
 */
export interface AgentDefinition {
  /** Unique agent identifier (kebab-case, matches filename without extension). */
  id: string;
  /** Human-readable agent name. */
  name: string;
  /** Org-hierarchy position. */
  layer: AgentLayer;
  /** Functional domain. */
  domain: AgentDomain;
  /** Domain-specific system prompt injected when the agent is active. */
  systemPrompt: string;
  /** Keywords that trigger this agent via heuristic routing. */
  triggerKeywords: string[];
  /** Rules governing confidence level assignment for this agent's domain. */
  confidenceRules: AgentConfidenceRules;
  /** Pipeline phases this agent participates in (empty for pure advisors). */
  phases: PipelinePhase[];
  /** Input schema identifier (documents the contract). */
  inputSchema: string;
  /** Output schema identifier. */
  outputSchema: string;
  /** Which model tier this agent should run on. */
  modelTier: ModelTier;
  /** Approximate tokens per invocation (for budget planning). */
  estimatedTokens: number;
  /** IDs of agents this one composes well with. */
  chainsWith: string[];
  /** IDs of agents this one escalates to when out of depth. */
  escalatesTo: string[];
  /** Semver version of this agent's prompt. Bump on material prompt changes. */
  promptVersion: string;
}
