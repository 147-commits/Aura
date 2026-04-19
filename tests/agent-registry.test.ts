/**
 * Agent Registry tests — F3 acceptance criteria.
 *
 * Validates the unified registry's invariants:
 *   - 26 agents registered (all advisors migrated)
 *   - every agent has a non-empty system prompt
 *   - every chainsWith reference resolves
 *   - getAgentsForPhase("discovery") is empty until pipeline agents land
 *   - matchAgentsByKeywords behaves identically to the legacy the old matcher
 *
 * Run: npx tsx tests/agent-registry.test.ts
 */

import {
  AGENT_REGISTRY,
  getAgent,
  getAgentsByDomain,
  getAgentsByLayer,
  getAgentsForPhase,
  matchAgentsByKeywords,
  getChainedAgents,
} from "../server/agents/agent-registry";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS: ${label}`);
    passed++;
  } else {
    console.error(`FAIL: ${label}`);
    failed++;
    process.exitCode = 1;
  }
}

console.log("\n=== Agent Registry — F3 acceptance ===\n");

// 1. Registry size — 26 advisors + 12 pipeline agents = 38 (post-C1)
assert(AGENT_REGISTRY.size === 38, `registry.size === 38 (got ${AGENT_REGISTRY.size})`);

// 2. Every agent has a non-empty systemPrompt
let allHavePrompts = true;
for (const [id, agent] of AGENT_REGISTRY) {
  if (!agent.systemPrompt || agent.systemPrompt.trim().length === 0) {
    console.error(`  empty prompt: ${id}`);
    allHavePrompts = false;
  }
}
assert(allHavePrompts, "every agent has a non-empty systemPrompt");

// 3. Every chainsWith reference resolves to a registered agent
const unresolved: string[] = [];
for (const [id, agent] of AGENT_REGISTRY) {
  for (const chain of agent.chainsWith) {
    if (!AGENT_REGISTRY.has(chain)) unresolved.push(`${id} → ${chain}`);
  }
}
assert(unresolved.length === 0, `every chainsWith resolves (unresolved: ${unresolved.join(", ") || "none"})`);

// 4. Pipeline phases populated after C1
assert(getAgentsForPhase("discovery").length >= 2, `≥2 agents for 'discovery' (got ${getAgentsForPhase("discovery").length})`);
assert(getAgentsForPhase("design").length >= 2, `≥2 agents for 'design' (got ${getAgentsForPhase("design").length})`);
assert(getAgentsForPhase("planning").length >= 2, `≥2 agents for 'planning' (got ${getAgentsForPhase("planning").length})`);
assert(getAgentsForPhase("implementation").length >= 2, `≥2 agents for 'implementation' (got ${getAgentsForPhase("implementation").length})`);
assert(getAgentsForPhase("verification").length >= 2, `≥2 agents for 'verification' (got ${getAgentsForPhase("verification").length})`);
assert(getAgentsForPhase("release").length >= 1, `≥1 agent for 'release' (got ${getAgentsForPhase("release").length})`);
assert(getAgentsForPhase("gtm").length >= 1, `≥1 agent for 'gtm' (got ${getAgentsForPhase("gtm").length})`);

// 5. Layer roster: 5 executives + 4 leads + 3 specialists + 26 advisors
const advisors = getAgentsByLayer("advisor");
assert(advisors.length === 26, `26 advisor-layer agents (got ${advisors.length})`);
assert(getAgentsByLayer("executive").length === 5, `5 executive-layer agents (got ${getAgentsByLayer("executive").length})`);
assert(getAgentsByLayer("lead").length === 4, `4 lead-layer agents (got ${getAgentsByLayer("lead").length})`);
assert(getAgentsByLayer("specialist").length === 3, `3 specialist-layer agents (got ${getAgentsByLayer("specialist").length})`);

// 5b. Pipeline-prompt content audit
const PIPELINE_IDS = ["ceo","cto","cpo","coo","ciso","eng-lead","qa-lead","design-lead","devops-lead","architect","fullstack-eng","tech-writer"];
for (const id of PIPELINE_IDS) {
  const a = getAgent(id);
  assert(a !== undefined, `pipeline agent registered: ${id}`);
  if (!a) continue;
  assert(a.systemPrompt.length >= 1500, `${id}: systemPrompt ≥1500 chars (got ${a.systemPrompt.length})`);
  assert(!/\b50\s*years\b/i.test(a.systemPrompt), `${id}: no "50 years" cliché`);
  assert(a.promptVersion === "1.0.0", `${id}: promptVersion = 1.0.0`);
}

// 6. Default-field defaults are correctly applied to every advisor
// Migration defaults apply to advisor-layer agents only.
let defaultsOk = true;
for (const [id, agent] of AGENT_REGISTRY) {
  if (agent.layer !== "advisor") continue;
  if (agent.modelTier !== "skill") { console.error(`  modelTier wrong: ${id} = ${agent.modelTier}`); defaultsOk = false; }
  if (agent.estimatedTokens !== 2000) { console.error(`  estimatedTokens wrong: ${id} = ${agent.estimatedTokens}`); defaultsOk = false; }
  if (agent.promptVersion !== "1.0.0") { console.error(`  promptVersion wrong: ${id} = ${agent.promptVersion}`); defaultsOk = false; }
  if (agent.inputSchema !== "ChatInput") { console.error(`  inputSchema wrong: ${id} = ${agent.inputSchema}`); defaultsOk = false; }
  if (agent.outputSchema !== "ChatOutput") { console.error(`  outputSchema wrong: ${id} = ${agent.outputSchema}`); defaultsOk = false; }
  if (!Array.isArray(agent.phases) || agent.phases.length !== 0) { console.error(`  phases not empty: ${id}`); defaultsOk = false; }
  if (!Array.isArray(agent.escalatesTo) || agent.escalatesTo.length !== 0) { console.error(`  escalatesTo not empty: ${id}`); defaultsOk = false; }
}
assert(defaultsOk, "every advisor has the migration default fields");

// 7. matchAgentsByKeywords behaves identically to legacy the old matcher semantics
//    Pick a known trigger keyword from the cto-advisor spec.
const ctoMatches = matchAgentsByKeywords("Help me with tech strategy and engineering culture");
assert(ctoMatches.some((a) => a.id === "cto-advisor"), "matchAgentsByKeywords finds cto-advisor for 'tech strategy'");

// 8. matchAgentsByKeywords is case-insensitive
const ctoUpper = matchAgentsByKeywords("HELP ME WITH TECH STRATEGY");
assert(ctoUpper.some((a) => a.id === "cto-advisor"), "matchAgentsByKeywords is case-insensitive");

// 9. matchAgentsByKeywords returns empty list for unrelated content
const noMatch = matchAgentsByKeywords("the weather is nice today");
assert(noMatch.length === 0, "matchAgentsByKeywords returns empty for unrelated content");

// 10. getAgent returns a known agent
const cto = getAgent("cto-advisor");
assert(cto !== undefined && cto.id === "cto-advisor", "getAgent('cto-advisor') resolves");

// 11. getAgent returns undefined for unknown ids
assert(getAgent("does-not-exist") === undefined, "getAgent returns undefined for unknown id");

// 12. getAgentsByDomain returns the leadership trio
const leadership = getAgentsByDomain("leadership").map((a) => a.id).sort();
assert(
  JSON.stringify(leadership) === JSON.stringify(["ceo", "cto-advisor", "okr-coach", "startup-ceo"]),
  `leadership domain has [ceo, cto-advisor, okr-coach, startup-ceo] (got ${JSON.stringify(leadership)})`
);

// 13. getChainedAgents resolves cto-advisor's chains
const ctoChains = getChainedAgents("cto-advisor").map((a) => a.id).sort();
assert(
  JSON.stringify(ctoChains) === JSON.stringify(["engineering-architect", "startup-ceo"]),
  `cto-advisor chains to [engineering-architect, startup-ceo] (got ${JSON.stringify(ctoChains)})`
);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
