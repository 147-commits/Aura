/**
 * Pipeline-agent prompt builder.
 *
 * Every agent's runtime prompt is composed here:
 *   1. Truth-First preamble (from server/truth-first/principles.ts)
 *   2. Role intro ("You are the [Name]...")
 *   3. Agent-specific systemPrompt (the registry's authored content)
 *
 * Putting this in one place means a Truth-First principle change ripples
 * through every agent automatically — no per-agent edit needed.
 *
 * The chat-side surface (server/truth-engine.ts:buildTruthSystemPrompt)
 * keeps its own composition for chat: AURA_CORE + mode templates + memory
 * + the agent prompt as a domain layer. This module is for the PIPELINE
 * surface — when an agent runs as a step in the Virtual Company Engine,
 * not as a chat-time domain expert.
 */

import type { AgentDefinition } from "../../shared/agent-schema";
import { buildTruthFirstPreamble } from "../truth-first/principles";

const ROLE_INTRO_HINT =
  "Output the artifact required by your output schema. " +
  "Stamp every artifact with a confidence object: " +
  '{ level: "High"|"Medium"|"Low", reason: "<5–15 words>" }.';

/**
 * Compose the full system prompt an agent receives at pipeline runtime.
 *
 * Layout:
 *   <Truth-First preamble for "agent" surface>
 *
 *   ── Role ──
 *   You are the <Name>. <one-line purpose hint>
 *
 *   ── Authored prompt ──
 *   <agent.systemPrompt verbatim>
 */
export function buildAgentSystemPrompt(agent: AgentDefinition): string {
  const preamble = buildTruthFirstPreamble("agent");
  const roleIntro = `You are the ${agent.name} (${agent.domain} domain, layer: ${agent.layer}). ${ROLE_INTRO_HINT}`;

  return [
    preamble,
    "",
    "── Role ──",
    roleIntro,
    "",
    "── Authored prompt ──",
    agent.systemPrompt,
  ].join("\n");
}

/** Returns true when the composed prompt actually starts with the preamble. */
export function hasTruthFirstPreamble(composedPrompt: string): boolean {
  return composedPrompt.includes("Aura's Truth-First Engine");
}
