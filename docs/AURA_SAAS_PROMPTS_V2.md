AURA — Production SaaS Build Prompts (v2)
Goal: Ship Aura as a paid SaaS product — AI that builds working apps AND produces the complete governance package (PRD, ADRs, test plan, threat model, deployment runbook) a real team needs to ship.
Execution environment: Claude Code in VS Code
Baseline: Aura-v3-Complete-20260405.zip (Stage 3 chat app complete)
Prompts to replace: 7–11 from the original plan (those don't address Replit lock-in, the skill/agent muddle, routes.ts size, missing eval framework, missing cost caps, missing web UI, or SaaS concerns)

0. Read This Before Touching Claude Code
A promise I can't make: "No errors, works exactly as given." That's not how LLM code generation works, even with perfect prompts. What I CAN do is give you prompts that (a) catch their own errors with explicit verification, (b) fail loudly instead of silently, and (c) are small enough to debug quickly when they go sideways. Every prompt below ends with explicit test criteria. If those fail, you know immediately what broke.
Hard rule: One prompt per Claude Code session. Commit after each. git reset --hard HEAD~1 is your rollback.
Model selection:

Opus 4.7 for architecture prompts (F1, F3, C1, C3, B1, S1)
Sonnet 4.6 for mechanical prompts (F2, F5, C2, C4, B2, S2, S3, S4)
Sonnet 4.6 for UI work (C5)

Budget estimate: $60–120 in Claude Code credits across all 17 prompts. ~25–35 hours of execution time across 10–15 sessions over 4–6 weeks.

1. The SaaS Wedge Decision (do this FIRST, before Prompt F1)
Pick ONE of these three wedges before you start. Do not try to serve all three.
Wedge 1: Solo Technical Founders (recommended)
Who: Technical founders building a seed-stage startup, need to ship MVP + raise money simultaneously.
Job-to-be-done: "Go from idea to investable MVP package in a weekend."
Deliverable: Working app preview + PRD + pitch deck + financial model + basic threat model.
Price: $49/month, $199 for one-shot "weekend package."
Market signal: Very hot in 2024–2026. Competitors: none exactly this shape. v0/Bolt don't produce pitch/PRD; AI pitch tools don't produce apps.
Wedge 2: SMB Agencies
Who: 2–10 person agencies building websites/apps for SMB clients.
Job-to-be-done: "Produce client-ready deliverables 10× faster."
Deliverable: Client-branded app + client-branded docs (PRD, test plan, deployment guide, handoff doc).
Price: $149/month per seat.
Market signal: Proven willingness to pay. Competitors: project management tools (not builders), builders (no client-ready docs).
Wedge 3: Enterprise Innovation Teams
Who: Innovation/R&D teams at mid-to-large companies piloting internal tools.
Job-to-be-done: "Ship internal prototypes with the governance our security team will approve."
Deliverable: Working prototype + threat model + compliance checklist + architecture decision log + audit trail.
Price: $500–2000/month per team.
Market signal: Highest value, hardest to land. Long sales cycles. Requires SOC2 path.
My recommendation: Wedge 1. Best ratio of market size to sales difficulty for a solo builder. Biggest "prompt → thing they wanted" delta. Easiest to demo. Works with your existing mobile-chat layer (founders use phones for ideation) and new web pipeline (they use laptops for review).
Commit to a wedge before Prompt F1. Every decision below should be traced back to "does this serve [wedge]?"

2. The 17-Prompt Roadmap
FOUNDATION (fix the base)            CORE (rebuild VCE right)           BUILD (actual apps)       SAAS (productize)
────────────────────────             ─────────────────────────          ──────────────────        ─────────────────
F1: Provider abstraction             C1: Agent framework (12 agents)    B1: Real build loop       S1: Multi-tenancy + auth
F2: Modularize routes.ts             C2: DB + run tracer + retrieval   B2: Preview deploys       S2: Billing + usage caps
F3: Unify skills→agents              C3: Orchestrator + budget caps                               S3: Onboarding + activation
F4: Eval framework (rubrics)         C4: Multi-format artifacts                                    S4: Landing + docs
F5: Concurrency + versioning         C5: Web pipeline UI

   5 prompts · ~10h                     5 prompts · ~14h                   2 prompts · ~6h         4 prompts · ~8h
Go/no-go checkpoints:

After Foundation: You have a refactored, non-Replit-locked, cleanly-architected codebase. STOP. Ship nothing yet.
After Core: You have the Virtual Company Engine running end-to-end with docs output. Demo to 3 friends. If they don't get it, stop and iterate.
After Build: You have a real product that produces working apps + docs. Demo to 10 target-wedge users.
After SaaS: You have a billable, multi-tenant product. Now marketing starts.


3. Foundation Prompts (fix what's weak before building on top)
PROMPT F1 — Provider Abstraction (kill Replit lock-in)
CONTEXT: The codebase currently has hard dependencies on Replit-specific infrastructure:
- server/replit_integrations/ folder with Replit AI Integrations client
- Environment variables prefixed AI_INTEGRATIONS_*
- Scripts referencing REPLIT_DEV_DOMAIN
- Assumption of Replit Postgres

This must be abstracted to a provider pattern so Aura can run on Render/Railway/Fly/AWS/Vercel. This is a prerequisite for SaaS deployment.

EXISTING FILES TO READ FIRST:
- server/ai-provider.ts
- server/replit_integrations/ (entire folder)
- server/index.ts
- server/db.ts
- package.json scripts
- app.json

WHAT TO BUILD:

1. Create server/providers/ai-provider-interface.ts:
Define a clean AIProvider interface:
  export interface AIProvider {
    id: string;
    name: string;
    chat(params: ChatParams): Promise<ChatResponse>;
    stream(params: ChatParams): AsyncIterable<ChatChunk>;
    embed(text: string): Promise<number[]>;
    countTokens(text: string): number;
  }
Define ChatParams, ChatResponse, ChatChunk types. No provider-specific code here.

2. Create server/providers/openai-provider.ts:
Direct OpenAI SDK usage (not Replit Integrations). Reads OPENAI_API_KEY and optional OPENAI_BASE_URL from env. Implements the full AIProvider interface.

3. Create server/providers/anthropic-provider.ts:
Direct Anthropic SDK usage. Reads ANTHROPIC_API_KEY. Implements the interface.

4. Create server/providers/provider-registry.ts:
  - selectProvider(tier: ModelTier): AIProvider — routes based on tier
  - Env-driven: if ANTHROPIC_API_KEY is present, use Anthropic for 'frontier'/'skill' tiers; else fallback to OpenAI
  - Cache provider instances

5. Refactor server/ai-provider.ts:
Replace all Replit Integrations calls with calls through the new provider-registry. Keep the public API of ai-provider.ts stable so nothing else breaks.

6. Update server/db.ts:
Read DATABASE_URL from env. Support standard Postgres URL format. Remove any Replit-specific assumptions. Ensure connection pooling works for serverless environments (use pg.Pool with appropriate max/idle settings).

7. Delete server/replit_integrations/ entirely.

8. Update package.json scripts:
- "expo:dev": "npx expo start" (remove REPLIT_DEV_DOMAIN references)
- Add "dev": "concurrently \"npm run server:dev\" \"npm run expo:dev\""
- Install concurrently as a devDependency

9. Update .env.example with the new required vars:
  DATABASE_URL=
  SESSION_SECRET=
  OPENAI_API_KEY=
  ANTHROPIC_API_KEY=
  PORT=5000

VERIFICATION (run after changes):
- npm test → all existing tests pass
- npm run server:dev → server starts, logs "Connected to Postgres", "Provider: openai (default)"
- Hit POST /api/chat with a test message → response streams successfully
- grep -r "replit" server/ → ZERO matches
- grep -r "AI_INTEGRATIONS_" . → ZERO matches
- grep -r "REPLIT_DEV_DOMAIN" . → ZERO matches

ROLLBACK IF ANYTHING BREAKS:
git reset --hard HEAD~1 and tell me what failed. Do not patch over symptoms.

PROMPT F2 — Modularize routes.ts (1,449-line god file)
CONTEXT: server/routes.ts is 1,449 lines and contains every route definition. This is a maintenance disaster waiting to happen. Before we add more routes in Prompts C3 and S1, we must split it.

EXISTING FILE TO READ:
- server/routes.ts (all of it)
- server/middleware.ts
- server/index.ts

WHAT TO BUILD:

1. Create server/routes/ directory.

2. Split server/routes.ts into domain-specific routers:
  server/routes/index.ts        — barrel that mounts all routers
  server/routes/chat.ts         — /api/chat, /api/research, /api/extract-memory, /api/extract-actions
  server/routes/memory.ts       — /api/memories/*
  server/routes/tasks.ts        — /api/tasks/*, /api/projects/*, /api/today/*
  server/routes/messages.ts     — /api/messages, /api/conversations/*
  server/routes/crafts.ts       — /api/crafts/*, /api/export
  server/routes/builder.ts      — /api/builder/*
  server/routes/health.ts       — /api/health
  server/routes/uploads.ts      — file upload routes

Each file exports an Express Router. Example pattern:
  // server/routes/tasks.ts
  import { Router } from "express";
  import { requireAuth } from "../middleware";
  import * as productivity from "../productivity-engine";
  
  export const tasksRouter = Router();
  
  tasksRouter.get("/tasks", requireAuth, async (req, res) => { ... });
  tasksRouter.post("/tasks", requireAuth, async (req, res) => { ... });
  // etc.

3. server/routes/index.ts mounts them all:
  import { Router } from "express";
  import { chatRouter } from "./chat";
  import { tasksRouter } from "./tasks";
  // ... etc
  
  export function buildRouter(): Router {
    const r = Router();
    r.use("/api", healthRouter);
    r.use("/api", chatRouter);
    r.use("/api", memoryRouter);
    r.use("/api", tasksRouter);
    r.use("/api", messagesRouter);
    r.use("/api", craftsRouter);
    r.use("/api", builderRouter);
    r.use("/api", uploadsRouter);
    return r;
  }

4. Update server/index.ts:
Replace the existing `registerRoutes(app)` pattern with `app.use(buildRouter())`.

5. Delete the old server/routes.ts AFTER confirming the new structure works.

6. Ensure no route logic is lost. Every route that exists in the old routes.ts must exist in the new structure. Run: grep -E "app\\.(get|post|patch|delete)" before and after, verify same count.

VERIFICATION:
- npm test → all existing tests pass (especially any that hit endpoints via supertest)
- All endpoints from replit.md's API table respond correctly
- Line count of each new router file: under 300 lines
- grep -rE "app\\.(get|post|patch|delete)" server/routes/ → each route appears exactly once
- Old server/routes.ts is deleted (or renamed to .bak)

ROLLBACK: git reset --hard HEAD~1.

PROMPT F3 — Unify Skills and Agents into ONE System
CONTEXT: The codebase has a Skills registry (26 skills) and is about to add an Agents registry (40+ agents). This is a conceptual mess — a skill is a prompt overlay, an agent is an actor with typed I/O, and we're about to maintain both. We need to unify them into one Agent-first system.

EXISTING FILES TO READ:
- server/skill-engine.ts
- server/skill-router.ts
- server/skills/*.ts (all 26 files)
- server/truth-engine.ts (the buildTruthSystemPrompt function and where it consumes skills)
- All tests that reference SKILL_REGISTRY or matchSkills

WHAT TO BUILD:

1. Create shared/agent-schema.ts (the ONE canonical definition):

export type AgentLayer = "executive" | "lead" | "specialist" | "advisor";
export type AgentDomain = "engineering" | "product" | "design" | "security" | "operations" | "marketing" | "finance" | "legal" | "data" | "support" | "research" | "education" | "health" | "leadership";
export type PipelinePhase = "discovery" | "design" | "planning" | "implementation" | "verification" | "release" | "gtm";
export type ModelTier = "mini" | "standard" | "skill" | "frontier";

export interface AgentDefinition {
  id: string;                          // matches filename, e.g. "cto"
  name: string;                        // "Chief Technology Officer"
  layer: AgentLayer;
  domain: AgentDomain;
  
  // Prompting
  systemPrompt: string;
  triggerKeywords: string[];           // for chat-mode activation (subsumes old Skill concept)
  confidenceRules: { high: string; medium: string; low: string; };
  
  // Pipeline participation (empty array = chat-only, never invoked in pipelines)
  phases: PipelinePhase[];
  inputSchema: string;                 // Zod schema NAME (looked up from artifact-schemas)
  outputSchema: string;
  
  // Cost and routing
  modelTier: ModelTier;
  estimatedTokens: number;             // per invocation
  
  // Coordination
  chainsWith: string[];                // agent IDs
  escalatesTo: string[];               // agent IDs; empty = escalates to human
  
  // Versioning
  promptVersion: string;               // semver; bump when systemPrompt changes materially
}

2. Create server/agents/agent-registry.ts:
Single registry, replaces SKILL_REGISTRY:
  export const AGENT_REGISTRY = new Map<string, AgentDefinition>();
  export function registerAgent(def: AgentDefinition): void;
  export function getAgent(id: string): AgentDefinition | undefined;
  export function getAgentsByLayer(layer: AgentLayer): AgentDefinition[];
  export function getAgentsByDomain(domain: AgentDomain): AgentDefinition[];
  export function getAgentsForPhase(phase: PipelinePhase): AgentDefinition[];
  export function matchAgentsByKeywords(message: string): AgentDefinition[];  // replaces matchSkills

3. Migrate every file in server/skills/*.ts to server/agents/:
Keep folder structure but convert each skill to an AgentDefinition. A former skill that doesn't participate in pipelines (e.g. wellness-coach) gets `phases: []` and `layer: "advisor"`.

Map: skill.id → agent.id unchanged.
Map: skill.domain → agent.domain unchanged.
Map: skill.triggerKeywords → agent.triggerKeywords unchanged.
Map: skill.systemPrompt → agent.systemPrompt unchanged.
Map: skill.confidenceRules → agent.confidenceRules unchanged.
Map: skill.chainsWith → agent.chainsWith unchanged.

New fields defaults:
- layer: "advisor" (for ex-skills without pipeline role)
- phases: []
- inputSchema: "ChatInput"
- outputSchema: "ChatOutput"
- modelTier: "skill"
- estimatedTokens: 2000
- escalatesTo: []
- promptVersion: "1.0.0"

4. Update server/skill-router.ts → rename to server/agents/agent-router.ts:
Same routing logic, but now operating on agents. Update all imports.

5. Update server/truth-engine.ts:
Replace SkillDefinition references with AgentDefinition. Replace SkillContext with AgentContext.

6. Delete server/skill-engine.ts. Delete server/skills/ (after migration complete).

7. Update ALL tests that reference SKILL_REGISTRY → AGENT_REGISTRY. Update type imports throughout.

8. Add tests/agent-registry.test.ts:
- Test registry.size === 26 (ex-skills) after migration
- Test every agent has non-empty systemPrompt
- Test every chainsWith reference resolves
- Test getAgentsForPhase("discovery").length === 0 (no pipeline agents yet — that's Prompt C1)
- Test matchAgentsByKeywords still works identically to old matchSkills

VERIFICATION:
- npm test → ALL tests pass, including the ones that used to test skills
- grep -r "SKILL_REGISTRY\|SkillDefinition\|SkillContext\|matchSkills" . → ZERO matches in source (only in git history)
- Server starts, chat still routes to the right agents by keyword
- Send "help me with a tech strategy" to /api/chat → activates the cto agent (formerly cto-advisor skill)

ROLLBACK: git reset --hard HEAD~1.

IMPORTANT NOTE TO CLAUDE CODE: This is a large refactor touching many files. Do it systematically:
a) First, create agent-schema.ts and agent-registry.ts
b) Then migrate ONE skill file (cto.ts) as a template
c) Run tests after (a) and (b) to verify the pattern works
d) Then migrate remaining 25 skills in one pass
e) Then update skill-router and truth-engine
f) Then update tests
g) Only delete old files after all tests pass

PROMPT F4 — Evaluation Framework (rubrics, not just schema validation)
CONTEXT: Currently we only validate that agent outputs match Zod schemas. That catches "is this JSON shaped right?" — it does NOT catch "is this output actually good?" A PRD can be perfectly shaped and utterly vague. We need rubric-based eval before building more agents.

EXISTING FILES TO READ:
- scripts/run-eval.ts
- scripts/quality-report.ts
- tests/eval/ (see what's there)
- server/verification-engine.ts

WHAT TO BUILD:

1. Create server/eval/rubric-schema.ts:

export interface EvalRubric {
  id: string;
  name: string;
  artifactType: string;                // "prd" | "adr" | "chat-response" | etc.
  criteria: EvalCriterion[];
}

export interface EvalCriterion {
  id: string;
  description: string;                 // "Are acceptance criteria testable predicates?"
  weight: number;                      // 0-1, criteria weights must sum to 1
  scoringGuide: {
    excellent: string;                 // "Every criterion includes measurable condition + expected outcome"
    good: string;
    acceptable: string;
    poor: string;
  };
}

export interface EvalResult {
  rubricId: string;
  artifactId: string;
  overallScore: number;                // 0-1
  criterionScores: { criterionId: string; score: number; rationale: string }[];
  evaluatedBy: string;                 // agent role or "human"
  evaluatedAt: string;
}

2. Create server/eval/rubrics/prd-rubric.ts, adr-rubric.ts, chat-response-rubric.ts, project-charter-rubric.ts:
Hand-written rubrics for each major artifact type. Example PRD rubric criteria:
- "Problem statement is specific and describes user pain (not solution)"
- "Target users are named with at least one persona detail"
- "Acceptance criteria are testable predicates (contain observable outcomes)"
- "Success metrics have numeric targets"
- "At least one non-goal is stated"
- "Open questions are listed explicitly"

3. Create server/eval/evaluator.ts:

export async function evaluateArtifact(
  artifact: { type: string; content: string },
  rubric: EvalRubric,
  provider: AIProvider
): Promise<EvalResult>

Uses a 'standard' tier model (NOT the model that generated the artifact — GAN separation). Returns structured score per criterion.

4. Create tests/eval/ with:
- 20 golden test prompts (5 per artifact type: PRD, ADR, chat response, project charter)
- Expected minimum scores per rubric
- scripts/run-eval.ts (rewrite) that runs all 20, reports pass/fail

5. Add npm script:
  "eval": "tsx scripts/run-eval.ts"
  "eval:watch": "tsx scripts/run-eval.ts --watch"   // reruns on file change

6. Create docs/EVAL_LOG.md — a changelog of rubric scores over time. Every time you change an agent's systemPrompt or a rubric, run evals and append:
  ## 2026-04-20 — CTO agent prompt v1.0.0 → v1.1.0
  Added STRIDE threat modeling emphasis.
  - PRD rubric: 0.82 → 0.84 (+0.02)
  - ADR rubric: 0.71 → 0.78 (+0.07)
  Verdict: KEEP

VERIFICATION:
- npm run eval → runs 20 cases, reports scores
- Every artifact type has a rubric with weights summing to 1.0
- The evaluator uses a different provider/model than any generator it's evaluating

ROLLBACK: git reset --hard HEAD~1.

IMPORTANT: This framework is what keeps agents from degrading silently. Every future prompt change goes through this.

PROMPT F5 — Concurrency, Cost Caps, and Prompt Versioning
CONTEXT: Before the orchestrator ships, we need three safety systems:
1. Cost caps per run (a runaway agent loop can burn $30+ on a single user request)
2. Concurrency limits (one user can't start 10 pipelines at once)
3. Prompt versioning (when you tune an agent prompt, existing runs must be replayable)

EXISTING FILES TO READ:
- server/model-router.ts
- server/middleware.ts

WHAT TO BUILD:

1. Create server/orchestrator/budget-guard.ts:

export interface RunBudget {
  maxCostUSD: number;                 // default 5.00
  maxTokens: number;                  // default 500_000
  maxDurationSec: number;             // default 900 (15 min)
  maxAgentCalls: number;              // default 50
}

export class BudgetGuard {
  constructor(runId: string, budget: RunBudget);
  canAfford(estimatedTokens: number, modelTier: ModelTier): boolean;
  record(actualTokens: number, actualCost: number): void;
  check(): { withinBudget: boolean; reason?: string };
  remaining(): { costUSD: number; tokens: number; sec: number; calls: number };
}

If any limit is breached during a run, orchestrator pauses the run with status='paused-budget'.

2. Create server/orchestrator/concurrency-guard.ts:

export async function acquireRunSlot(userId: string, orgId: string): Promise<{ acquired: boolean; currentRuns: number; maxRuns: number }>;
export async function releaseRunSlot(userId: string, runId: string): Promise<void>;

Defaults:
- Free tier: max 1 concurrent run per user
- Paid tier: max 3 concurrent runs per user
- Enterprise: max 10

Uses a Postgres advisory lock or a dedicated active_runs table.

3. Add prompt versioning to the agent registry:
Every AgentDefinition already has promptVersion (added in F3). Now enforce:
- run_steps table stores the promptVersion used for each invocation
- Adding a new column: server/migration.ts ALTER TABLE run_steps ADD COLUMN prompt_version TEXT
- When re-running or replaying a historical run, use the same promptVersion

4. Add server/migration.ts changes:

CREATE TABLE IF NOT EXISTS active_runs (
  run_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  org_id UUID,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'running'
);
CREATE INDEX IF NOT EXISTS idx_active_runs_user ON active_runs(user_id);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, version)
);

5. Create scripts/snapshot-prompts.ts:
Walks the agent registry, writes current (agent_id, version, system_prompt) tuples to prompt_versions table. Run this whenever you change an agent's systemPrompt.

Add npm script: "prompts:snapshot": "tsx scripts/snapshot-prompts.ts"

6. Add tests/budget-guard.test.ts, tests/concurrency-guard.test.ts.

VERIFICATION:
- npm test → all pass
- Simulate a run that exceeds budget → orchestrator (when built in C3) will pause it
- Start two concurrent runs as the same free-tier user → second one refused
- Snapshot prompts → prompt_versions table populated

ROLLBACK: git reset --hard HEAD~1.

4. Core Prompts (rebuild the Virtual Company Engine properly)
PROMPT C1 — Agent Framework (12 agents, each with a crisp prompt)
CONTEXT: Now that we have a unified agent registry (F3) and eval framework (F4), we add the 12 pipeline agents. These agents have phases[] populated and real output schemas. Quality over quantity — we're starting with 12, not 40.

EXISTING FILES TO READ:
- shared/agent-schema.ts
- server/agents/agent-registry.ts
- server/agents/ (all existing advisor agents from F3)
- server/eval/rubrics/*.ts

WHAT TO BUILD:

Create 12 new AgentDefinition files in server/agents/pipeline/:

EXECUTIVES (5):
- ceo.ts       — Project Charter, delivery recommendation; phases: [discovery, planning, gtm]
- cto.ts       — Architecture, ADRs; phases: [design, verification]
- cpo.ts       — PRD, user stories, acceptance criteria; phases: [discovery, design, gtm]
- coo.ts       — Delivery plan, RAID log; phases: [planning, release]
- ciso.ts      — Threat model, security review; phases: [design, verification]  (conditional activation: auth/PII/payments)

LEADS (4):
- eng-lead.ts       — Sprint plan, code commit review; phases: [planning, implementation, verification]
- qa-lead.ts        — Test strategy, QA report; phases: [verification]
- design-lead.ts    — Design spec, component library; phases: [design, implementation]
- devops-lead.ts    — Deployment runbook, rollback plan; phases: [release]

SPECIALISTS (3):
- architect.ts       — System design doc; phases: [design]
- fullstack-eng.ts   — Code implementation; phases: [implementation]
- tech-writer.ts     — Documentation, user guides; phases: [implementation, release]

Each file must contain:
1. systemPrompt of 300-600 words encoding domain expertise — but do NOT claim "50 years of expertise." Focus on the FRAMEWORKS the agent uses (e.g., for CTO: C4 model, 12-factor, ADR template, STRIDE, OWASP). Frameworks are what the model can actually apply. "Expertise" is not.
2. confidenceRules specific to the agent's domain.
3. chainsWith populated with agent IDs this one collaborates with in phases.
4. escalatesTo populated (specialists → leads → executives; CEO → []).
5. inputSchema and outputSchema names (defined in C2).
6. estimatedTokens calibrated (run the agent once manually and measure — typical range 2000-6000).
7. promptVersion: "1.0.0".

For each agent, also update the relevant rubric in server/eval/rubrics/ to include criteria that match what this agent produces.

Register all 12 agents in server/agents/pipeline/index.ts.

VERIFICATION:
- npm test → all pass
- AGENT_REGISTRY.size === 26 (advisor agents from F3) + 12 (new pipeline agents) = 38
- getAgentsForPhase("discovery").length >= 2 (CEO + CPO minimum)
- getAgentsForPhase("implementation").length >= 2 (eng-lead + fullstack-eng)
- For each agent, systemPrompt.length >= 1500 (roughly 300 words)
- No agent has "50 years" or similar phrase in its systemPrompt

ROLLBACK: git reset --hard HEAD~1.

CRITICAL: Each agent prompt should start with: "You are the [role]. You operate as part of a multi-agent product delivery pipeline. Your output will be validated against a schema and evaluated by a separate evaluator agent. You must produce valid structured output — no preamble, no apologies, no meta-commentary."

PROMPT C2 — Database Schema, Run Tracer, Artifact Retrieval
CONTEXT: The orchestrator needs database tables for pipeline observability AND a retrieval layer so agents in future runs can learn from past artifacts. This combines the old Prompt 8 with a retrieval system.

EXISTING FILES TO READ:
- server/migration.ts
- server/db.ts
- server/memory-engine.ts
- server/embedding-engine.ts
- server/retrieval-engine.ts
- server/encryption.ts

WHAT TO BUILD:

1. Add these tables to server/migration.ts (idempotent CREATE IF NOT EXISTS):
- pipeline_runs
- run_steps (includes prompt_version column from F5)
- run_artifacts (with embedding column VECTOR(1536))
- gate_results
- tool_calls
- agent_decisions

[Use the exact schemas from the original Prompt 8, but ADD:]
- pipeline_runs.org_id UUID (for multi-tenancy, F1 ready)
- pipeline_runs.budget_json JSONB (budget limits for this run)
- run_artifacts.embedding VECTOR(1536) (requires pgvector extension — add CREATE EXTENSION IF NOT EXISTS vector; at top of initDatabase)
- run_artifacts.quality_score REAL (populated by evaluator)
- run_artifacts.rubric_id TEXT

2. Create server/orchestrator/run-tracer.ts:
[All functions from original Prompt 8: createRun, logStep, completeStep, logArtifact, logGateResult, logToolCall, logDecision, updateRunStatus, completeRun, getRun, listRuns, getRunArtifacts, getRunSteps, getRunCost]

Additional functions:
- retrieveSimilarArtifacts(orgId: string, queryEmbedding: number[], artifactType: string, limit: number): Promise<PipelineArtifact[]>
  Uses pgvector cosine similarity on run_artifacts.embedding, filtered to this org's past runs (multi-tenant isolation).

3. Create server/orchestrator/artifact-embedder.ts:
- Computes embeddings for each new artifact as it's stored
- Uses the existing embedding-engine.ts
- Runs async so it doesn't block the pipeline

4. Create server/orchestrator/gate-engine.ts:
[As specified in original Prompt 8, plus integration with the F4 eval framework:]
- evaluateGate now also calls evaluateArtifact (from F4) on each artifact
- Gate passes only if schema valid AND eval score >= 0.65

5. Tests:
- tests/run-tracer.test.ts (create, log, retrieve lifecycle)
- tests/artifact-retrieval.test.ts (embedding → similarity search)
- tests/gate-engine.test.ts (schema + rubric pass/fail paths)

VERIFICATION:
- npm test passes
- psql: SELECT extname FROM pg_extension WHERE extname='vector' → returns 'vector'
- After a sample artifact is logged, its embedding is computed within 5 seconds
- Similarity search returns artifacts in descending cosine similarity order

ROLLBACK: git reset --hard HEAD~1.

PROMPT C3 — Orchestrator (with budget caps, concurrency, failure modes)
CONTEXT: The main engine. Takes a build request, runs phases A-E (release and GTM are separate flows), invokes agents with budget enforcement, validates artifacts, evaluates via rubrics, enforces gates, produces artifacts. This version replaces the old Prompt 9 with major upgrades.

KEY CHANGES FROM ORIGINAL PROMPT 9:
- Integrates BudgetGuard from F5 (can abort runs)
- Integrates ConcurrencyGuard from F5 (refuses over-limit starts)
- Integrates Evaluator from F4 (quality scoring, not just schema validation)
- Uses promptVersion from F5 (recorded per step)
- Supports "retrieval-augmented" agent calls (past artifacts from same org)
- Phases A-E only; F (release) and G (GTM) become separate opt-in pipelines
- Hub-and-spoke with explicit error isolation (one agent failure doesn't kill run)

EXISTING FILES TO READ:
- All files created in F1-F5, C1, C2
- server/routes/chat.ts (from F2)
- server/truth-engine.ts

WHAT TO BUILD:

1. Create server/orchestrator/intent-classifier.ts:
[Rules + LLM fallback as original Prompt 9. Use the cheap 'mini' tier.]
Additional: support "build-extend" intent — user wants to continue/modify an existing run.

2. Create server/orchestrator/artifact-schemas.ts:
All Zod schemas named in the AgentDefinition.outputSchema fields.
Each schema has a matching rubric in server/eval/rubrics/.

3. Create server/orchestrator/agent-invoker.ts:
Wraps a single agent call with:
- Budget check BEFORE invocation (abort if can't afford estimated)
- Provider selection via provider-registry (F1)
- Retrieval of 2-3 similar past artifacts from same org (via retrieveSimilarArtifacts)
- System prompt assembly (agent prompt + delivery option + schema description + past artifacts as reference)
- Output parsing and Zod validation
- One retry with error feedback on validation failure
- Evaluation via F4 evaluator
- logStep + logArtifact + embedding async

4. Create server/orchestrator/pipeline-engine.ts (renamed from e2e-pdl.ts for clarity):
Main orchestrator. Pseudo-code:

  async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
    await concurrencyGuard.acquire(userId, orgId);
    const runId = await createRun(...);
    const budget = new BudgetGuard(runId, input.budget ?? DEFAULT_BUDGET);
    
    try {
      for (const phase of ["discovery", "design", "planning", "implementation", "verification"]) {
        emitSSE({ type: "phase_start", phase });
        const agents = getAgentsForPhase(phase).filter(shouldActivate);
        
        // Parallel fan-out, isolated failures
        const results = await Promise.allSettled(
          agents.map(agent => invokeAgent(agent, buildInput(runId, phase), provider, budget))
        );
        
        const artifacts = results.filter(r => r.status === "fulfilled").flatMap(r => r.value.artifacts);
        const failures = results.filter(r => r.status === "rejected");
        
        if (artifacts.length === 0) throw new Error(`Phase ${phase}: all agents failed`);
        if (failures.length > 0) emitSSE({ type: "phase_warning", phase, failures: failures.length });
        
        // Gate check
        const gate = await evaluateGate(phase, runId, artifacts);
        emitSSE({ type: "gate_check", phase, passed: gate.passed });
        if (!gate.passed) {
          await updateRunStatus(runId, "paused-gate", phase);
          emitSSE({ type: "gate_failed", phase, reason: gate.reason });
          return { runId, status: "paused-gate" };
        }
        
        if (!budget.check().withinBudget) {
          await updateRunStatus(runId, "paused-budget");
          emitSSE({ type: "budget_exceeded", remaining: budget.remaining() });
          return { runId, status: "paused-budget" };
        }
      }
      
      await completeRun(runId);
      emitSSE({ type: "pipeline_complete", runId, ... });
      return { runId, status: "completed" };
    } finally {
      await concurrencyGuard.release(userId, runId);
    }
  }

5. Add routes in server/routes/pipeline.ts:
- POST /api/pipeline/start (SSE)
- GET /api/pipeline/runs
- GET /api/pipeline/runs/:id
- GET /api/pipeline/runs/:id/artifacts
- POST /api/pipeline/runs/:id/resume
- POST /api/pipeline/runs/:id/cancel

6. Integrate intent classifier into chat route (server/routes/chat.ts from F2):
- Rule-based classification first (<1ms)
- LLM fallback only for ambiguous (<200ms)
- "build" intent → emit SSE build_detected event, do NOT run chat
- "ambiguous" → clarification message
- "chat" → existing path (no change)

7. Tests:
tests/orchestrator-e2e.test.ts — integration test running a minimal pipeline end-to-end, asserting every phase produces artifacts, budget honored, etc.

VERIFICATION:
- npm test passes
- Send "build me a simple todo tracker" → receives build_detected event
- POST /api/pipeline/start → watches SSE events flow: phase_start → agent_working → artifact_produced → gate_check → phase_start (next) → ... → pipeline_complete
- Check pipeline_runs table: row with status='completed', sensible cost and duration
- Try to start a second run as same user with 1-run limit → second call refused with 429

ROLLBACK: git reset --hard HEAD~1.

NOTE: This is the single biggest prompt. Consider running it in two sub-sessions (intent classifier + schemas + invoker first; pipeline engine + routes + tests second).

PROMPT C4 — Multi-Format Artifact Generation (Markdown + DOCX + JSON export)
CONTEXT: Old plan had DOCX as the only output. That's 2010. We need Markdown (primary — fits Notion, GitHub, Linear workflows), DOCX (for formal deliverables and older buyers), and JSON (for API consumers). A GitHub PR export is a future option, left stubbed.

EXISTING FILES TO READ:
- server/craft-engine.ts
- server/document-engine.ts
- server/export-engine.ts

WHAT TO BUILD:

1. Create server/orchestrator/artifact-formatter.ts:
export async function formatArtifact(artifact: PipelineArtifact, format: "markdown" | "docx" | "json"): Promise<FormattedArtifact>

For each artifact type, implement three formatters. Markdown is the canonical form. DOCX is converted from markdown via existing docx library.

Markdown templates for each type. Example PRD markdown:

# Product Requirements: {title}

> Generated by Aura on {date} · Run ID: {runId}

## Problem
{problemStatement}

## Target Users
{personas}

## User Stories
{stories}

## Acceptance Criteria
| Criterion | Testable Predicate | Priority |
|---|---|---|
| ... | ... | ... |

## Success Metrics
- {metric 1}: target {target}
- ...

## Out of Scope
- {non-goal 1}
- ...

## Open Questions
- {question 1}
- ...

2. Create server/orchestrator/bundle-generator.ts:
Produces a single .zip file containing every artifact in all three formats + a README.md index.
Bundle structure:
  bundle.zip
  ├── README.md                       (index, TOC, run stats, gate results)
  ├── docs-markdown/
  │   ├── 01-project-charter.md
  │   ├── 02-prd.md
  │   ├── 03-architecture.md
  │   └── ...
  ├── docs-docx/
  │   └── (same docs in DOCX format)
  ├── artifacts-json/
  │   └── (raw validated JSON artifacts)
  └── metadata.json                   (run metadata, costs, durations, agent versions)

3. Update server/orchestrator/pipeline-engine.ts to call formatter + bundle generator:
After each phase, format artifact in markdown (fast, saved first), schedule DOCX conversion async.
After pipeline completes, generate bundle.

4. Add routes in server/routes/pipeline.ts:
- GET /api/pipeline/runs/:id/bundle → downloads bundle.zip
- GET /api/pipeline/runs/:id/artifacts/:artifactId?format=markdown|docx|json

5. Tests:
- tests/artifact-formatter.test.ts (each artifact type × each format produces valid output)
- tests/bundle-generator.test.ts (bundle.zip is valid, contains all expected files)

VERIFICATION:
- npm test passes
- Run a pipeline → bundle.zip downloadable
- Open bundle.zip → markdown files render cleanly in a markdown viewer
- Open DOCX files in Word → formatting preserved, tables render
- JSON artifacts validate against the schemas from C3

ROLLBACK: git reset --hard HEAD~1.

WHY MARKDOWN IS PRIMARY: Your target SaaS users (solo founders, agencies, innovation teams) live in Notion, Linear, GitHub. Markdown imports into all of these natively. DOCX is for the board/investor deliverable. JSON is for API users. Writing markdown first makes everything else fall out cleanly.

PROMPT C5 — Web UI for Pipeline Mode (separate from mobile chat)
CONTEXT: The pipeline UX does not belong on mobile. Reading 10-page PRDs and reviewing architecture diagrams on a 6-inch screen is broken UX. We create a separate web client at app/web-pipeline/ that shares state with the mobile app via the same backend.

EXISTING FILES TO READ:
- app/(tabs)/_layout.tsx  (for the sidebar pattern on web)
- components/WebContainer.tsx
- components/chat/ (for SSE handling patterns)
- constants/colors.ts

WHAT TO BUILD:

1. Create a new Next.js sub-app OR use Expo's web output with dedicated web routes.

Option A (recommended, simpler): Use Expo Router's existing web support but create /pipeline route that is explicitly web-only (hidden on mobile):
  app/pipeline/_layout.tsx       — redirects to /(tabs)/aura on native
  app/pipeline/index.tsx         — pipeline dashboard
  app/pipeline/new.tsx           — new build setup
  app/pipeline/[runId].tsx       — live run view
  app/pipeline/runs.tsx          — list of past runs

Option B (advanced, cleaner long-term): Spin up a separate Next.js app in /web/ that consumes the same backend. More work now, much cleaner later. Skip for now.

2. Components to build in components/pipeline/ (web-only):
- PipelineDashboard.tsx    — recent runs, metrics, cost trends
- NewBuildWizard.tsx       — 3-step: describe → select wedge/delivery option → confirm budget
- LiveRunView.tsx          — real-time SSE display: 5 phase columns, agent activity, artifacts appearing as cards
- ArtifactViewer.tsx       — renders markdown artifact + edit/download
- RunDetails.tsx           — gate results, decisions log, cost breakdown, traces

3. Design system:
- Reuse constants/colors.ts (dark theme)
- Add desktop-specific layout: sidebar (220px) + main (flex) + right rail (320px for artifact preview)
- Use react-native-web for cross-platform components where possible
- Introduce a new color ACCENT_PIPELINE (distinct from chat accent) so the pipeline feels like its own space

4. SSE handling:
Extend existing SSE client from components/chat/ to handle pipeline events from C3.
Events: build_detected, pipeline_start, phase_start, agent_working, artifact_produced, gate_check, gate_failed, phase_complete, pipeline_complete, pipeline_error, budget_exceeded.

5. Interaction flows:
- User types "build me X" in mobile chat → server emits build_detected → mobile shows "Continue in browser" card with deep link
- User clicks deep link → opens /pipeline/new with the request prefilled
- User selects delivery option + confirms budget → POST /api/pipeline/start
- /pipeline/[runId] shows live progress
- On completion: download bundle, view individual artifacts, share link

6. Feature flag:
Mobile app gets a "Pipeline (Beta)" section with a single CTA: "Open pipeline in browser." No pipeline UI on mobile itself — only launch.

VERIFICATION:
- npx expo start --web → visit localhost:8081/pipeline → dashboard loads
- Start a new build → wizard works, pipeline starts
- Live view: SSE events render in real time
- Download bundle from completed run → .zip opens correctly
- Mobile: typing "build me X" shows a card that deep-links to the web pipeline (does NOT try to run pipeline on device)
- Lighthouse on /pipeline: performance >70, accessibility >90

ROLLBACK: git reset --hard HEAD~1.

5. Build Prompts (the actual "building apps" capability)
PROMPT B1 — Real Build Loop (plan → patch → test → preview)
CONTEXT: The current builder-engine.ts is 96 lines of CRUD. The pipeline produces docs but doesn't produce a RUNNING APP. Competitors like v0/Bolt produce running apps from prompts. We need a build loop that produces a working preview alongside the governance docs.

This is what will differentiate Aura in the market: "Get a working app AND the complete governance package."

EXISTING FILES TO READ:
- server/builder-engine.ts
- server/snack-engine.ts
- server/craft-engine.ts

WHAT TO BUILD:

1. Create server/orchestrator/build-loop.ts with the Plan-Patch-Test-Preview cycle:

async function runBuildLoop(input: BuildInput): Promise<BuildResult>

Cycle:
  Plan:    fullstack-eng agent produces a file tree + acceptance criteria (from PRD artifact)
  Patch:   fullstack-eng agent produces code for each file, one file per invocation (parallel)
  Test:    qa-lead agent produces tests + runs them in a sandbox (see step 3)
  Preview: deploy to Snack (for React Native) or Vercel/StackBlitz (for web)
  
  If tests fail → feed failures back into Patch with specific error context → retry up to 2 times
  If tests pass → produce final build artifact with preview URL

2. Create server/orchestrator/sandbox-runner.ts:
Runs generated code in a sandbox. Options in order of feasibility:
- Esbuild + vitest for unit tests (fastest, works for pure logic)
- Node vm.runInNewContext for integration tests
- Docker container via dockerode (heavy but most accurate) — future
Start with esbuild + vitest.

3. Update the fullstack-eng agent (from C1) to produce code in a structured format:
Output:
  {
    "files": [
      { "path": "src/App.tsx", "content": "...", "reason": "main component" },
      ...
    ],
    "dependencies": { "react": "^19.0.0", ... },
    "testPlan": [
      { "file": "src/App.test.tsx", "description": "renders title" },
      ...
    ]
  }

4. Integration with pipeline-engine.ts:
After the "implementation" phase, trigger runBuildLoop. The build result becomes a new artifact type: "app-bundle" with preview URL.

5. Update artifact-schemas.ts and rubrics for app-bundle type.

6. Tests:
- tests/build-loop.test.ts (runs a minimal build loop with a trivial app: "button that increments counter")
- Verify preview URL returns HTTP 200
- Verify test file runs without error

VERIFICATION:
- npm test passes
- Run a full pipeline for "simple counter app" → pipeline completes, preview URL accessible, counter works
- Bundle includes /app/ folder with the generated code
- Test failures during build loop trigger retry (check logs for "retry 1", "retry 2")

ROLLBACK: git reset --hard HEAD~1.

REALISTIC EXPECTATION: First-version code quality from this loop will be B-minus. That's fine. The differentiator is NOT "our code is better than Cursor's" — it's "our code comes with the PRD that justifies it and the tests that prove it." The governance IS the moat.

PROMPT B2 — Preview Deployment (Snack, Vercel, StackBlitz)
CONTEXT: Build loop produces code. Users need a LIVE URL to click. Integrate with Expo Snack (already in package.json as snack-sdk) for React Native previews, and Vercel or StackBlitz for web previews.

EXISTING FILES TO READ:
- server/snack-engine.ts
- package.json (snack-sdk is already a dependency)

WHAT TO BUILD:

1. Enhance server/snack-engine.ts:
- Given a generated app's file tree, create a Snack project
- Return the snack.expo.dev URL
- Handle auth via SNACK_SESSION_TOKEN env var

2. Create server/orchestrator/preview-deployer.ts:
export async function deployPreview(appBundle: AppBundle, target: "snack" | "vercel" | "stackblitz"): Promise<{ url: string; provider: string }>

Routing logic:
- React Native code → Snack
- Next.js/React web code → Vercel (via API) or StackBlitz fallback
- Static HTML/JS → StackBlitz

3. Add VERCEL_TOKEN, STACKBLITZ_API_KEY, SNACK_SESSION_TOKEN to .env.example.

4. Tests:
- tests/preview-deployer.test.ts (use mock HTTP responses, test routing + success/failure paths)

VERIFICATION:
- npm test passes
- With real tokens in .env, trigger a build → preview URL opens a working app
- Snack preview: counter increments on tap
- Vercel preview: page loads, TTFB < 2s

ROLLBACK: git reset --hard HEAD~1.

6. SaaS Prompts (make it billable)
PROMPT S1 — Multi-Tenancy + Auth
CONTEXT: Current schema has only `users` keyed by device_id. SaaS needs orgs, members, roles, and proper auth (email + OAuth).

WHAT TO BUILD:
1. Integrate Clerk OR Auth.js (pick one — Clerk for speed, Auth.js for control).
2. DB schema: orgs, org_members (user_id, org_id, role), org_invites.
3. All existing tables (messages, tasks, memories, pipeline_runs) get org_id columns; all queries scoped to org.
4. Row-level security via Postgres RLS policies.
5. Middleware: req.user, req.org populated from auth token.
6. Migration path for existing device-id users: on first login, create an org for them, migrate their data.
7. UI: org switcher in sidebar, invite flow, member management.

VERIFICATION: Create two orgs, confirm data isolation (user in org A can't see org B's runs).
PROMPT S2 — Billing + Usage Caps (Stripe)
CONTEXT: Charge money. Stripe is the right answer.

WHAT TO BUILD:
1. Plans: Free ($0, 1 build/mo, 1 concurrent), Starter ($49/mo, 10 builds, 3 concurrent), Pro ($149/mo, unlimited builds, 5 concurrent), Enterprise (custom).
2. Stripe integration: checkout, customer portal, webhooks.
3. Usage tracking: build counts per org per month, token spend per org.
4. Overage handling: soft cap (warning), hard cap (blocks new runs).
5. UI: /settings/billing page, usage meter in sidebar.
6. Webhook handlers: subscription.created, subscription.updated, invoice.payment_failed.

VERIFICATION: Stripe test mode, complete a checkout, verify the org plan updates, run a build, see usage increment.
PROMPT S3 — Onboarding Flow + Activation Metrics
CONTEXT: The single biggest leak in SaaS is the gap between signup and first "aha." Aura's aha = first bundle downloaded. We need a sub-5-minute path from signup to aha.

WHAT TO BUILD:
1. Post-signup onboarding:
   Step 1: "What are you building? (one sentence)"
   Step 2: Suggest wedge-specific templates (e.g., for solo founders: "MVP package", "Investor-ready idea", "Weekend build")
   Step 3: Auto-trigger a pipeline on Free tier with the chosen template
   Step 4: Show live progress, celebrate bundle download
2. Activation metrics: time_to_first_run, time_to_first_bundle, free_to_paid_conversion.
3. Email sequence (via Resend or Postmark):
   T+0: welcome + link to first run
   T+1d: if no run yet, nudge
   T+3d: if no run yet, case study
   T+7d: if first run done, upsell to Starter

VERIFICATION: New signup flow completes in <5 minutes, first bundle downloadable, activation event fires.
PROMPT S4 — Landing Page + Docs + Public Run Gallery
CONTEXT: Marketing surface. Needed for SEO, conversion, and social proof.

WHAT TO BUILD:
1. /landing (or aura.app root): hero, demo video, three wedge-specific sections, pricing, testimonials, CTA.
2. /docs: how it works, each phase explained, sample artifacts, API docs.
3. /gallery: public runs (opt-in) so visitors see real output. Redact sensitive text, show the artifacts produced.
4. Blog at /blog with 3-5 launch posts: "Why we built Aura", "Anatomy of a PRD", "Governance as a service."
5. SEO: proper meta tags, OG images, sitemap.

VERIFICATION: Lighthouse >90 on all pages. 3 public gallery runs live. Blog has 3 posts.

7. Sequencing and Decision Points
Weeks 1–2: Foundation (F1-F5). Do NOT skip. You will thank yourself every subsequent week.
Weeks 3–5: Core VCE (C1-C5). After C5, demo to 3 target-wedge users. Ask them: "Would you pay $49/mo for this?" If 0 of 3 say yes — stop and reconsider the wedge.
Weeks 6–7: Build loop (B1-B2). Now you have working apps + docs. Demo to 10 target-wedge users. You're looking for 3+ who say "I'd pay for this tomorrow."
Weeks 8–10: SaaS productization (S1-S4). If demos went well, push through. If demos were lukewarm, this is where you PIVOT the wedge instead of productizing a weak one.
Week 11+: Launch. Private beta first (your 10 demo users). Then public. Then paid.

8. Honest Pitfalls Specific to This Plan

Foundation prompts are boring but lethal to skip. The urge to go straight to C1 (fun agent work) will be enormous. Every week you don't do F1-F5, the codebase rots faster.
Agent prompts will drift. Even with the eval framework, you will make small tweaks that collectively degrade quality. Check eval scores WEEKLY. Treat drops as bugs.
The build loop is hard. B1 may take 2x the estimated time. Budget for it. If you're over budget on B1, ship without a working preview first — the docs alone are shippable value.
SaaS is 70% marketing, 30% product once you have something. S4 (landing + docs) is NOT optional. Many founders build great products that no one finds.
Claude Code will make mistakes. At 17 prompts × multiple subtasks each, you will have 20-40 bugs to fix. That's normal. Budget time for it. Use the verification section of each prompt aggressively.
Model costs on the orchestrator can surprise you. With 12 agents × 5 phases × test runs, a single full pipeline can cost $3-8 in API costs. Your billing (S2) must account for this — don't price Free tier to include unlimited runs.


9. What You're NOT Building (be strict about this)

A mobile pipeline UI (web-first)
40 agents (12 is enough)
Phases F (Release) and G (GTM) in v1 (save for v2)
Three delivery options (ship with one: balanced)
Multi-language support (English only for v1)
Self-hosted option (pure SaaS)
An agent marketplace (single source of truth only)
Code for arbitrary programming languages (pick two: React/TS web + React Native)

Every "NO" here protects a "YES" above. Hold the line.

10. The Single Most Important Sentence
Ship the Foundation (F1-F5) before anything else, even if it feels slow, because everything that comes after depends on it not being broken.
Good luck. You have the taste, the ambition, and the code quality to pull this off. The plan is just execution now.ls -la docs/
