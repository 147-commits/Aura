AURA — FINAL BUILD PROMPTS (v3, consolidated)
This is the canonical prompt document. It supersedes:

AURA_COMPLETION_PLAN.md (outdated — 5-prompt plan without SaaS or three-pillar framing)
AURA_SAAS_PROMPTS_V2.md (partial — missing three-pillar integration)
AURA_PRODUCT_IDENTITY_ADDENDUM.md (correct intent, but scattered across two docs)

Use only this document going forward. All 20 prompts live here in execution order.

0. The Product in One Sentence
Aura is the AI companion that knows you, tells you the truth, and can spin up a virtual company to ship what you're dreaming about.
Every prompt below must serve that sentence. If a decision doesn't serve the three pillars (Truth-First Engine / Personal Companion / Virtual Company Engine), cut it.

1. The Three Pillars (re-read before every session)
                    TRUTH-FIRST ENGINE
           (DNA — confidence, intent matching,
            anti-hallucination, privacy)
                         │
         ┌───────────────┴───────────────┐
         │                               │
 PERSONAL COMPANION            VIRTUAL COMPANY ENGINE
 (daily habit, always free)   (activation, paywall)
         │                               │
         └───────────────┬───────────────┘
                         │
                   SHARED STATE
        (memories, conversations, org context)

Truth-First Engine governs EVERYTHING. Chat responses, agent outputs, gate evaluations, router decisions — all carry confidence ratings and reasoning.
Personal Companion is the retention engine. Always free. Memory compounds over time.
Virtual Company Engine is the activation moment. Paywall lives here. Consumes companion memory as context.

Drop any pillar and the product weakens:

No companion → transactional tool (like Cursor, v0)
No pipeline → another chat app (like ChatGPT, Claude)
No truth-first → generic AI (no differentiation)


2. The Wedge Customer (locked)

Primary: Solo technical founders building pre-seed startups
Pain: "I have 17 ideas and zero validated packages I can show investors"
Job-to-be-done: Idea → investable MVP package in a weekend
Deliverable: Working app preview + PRD + architecture + threat model + GTM brief
Pricing: $49/mo unlimited pipelines, or $199 one-shot weekend sprint
Secondary wedges (not v1): SMB agencies, enterprise innovation teams


3. Execution Overview (20 prompts, 4 phases)
PHASE 0: Product Identity (1 prompt, ~1 hour docs-only)
└── P0: Product Identity Spec

PHASE 1: Foundation (6 prompts, ~14 hours)
├── F1: Kill Replit lock-in (provider abstraction)
├── F2: Modularize routes.ts
├── F3: Unify skills → agents
├── F4: Eval framework (rubric-based)
├── F5: Budget + concurrency + prompt versioning
└── F6: Truth-First Engine extends to pipeline ⭐

PHASE 2: Core Virtual Company (6 prompts, ~18 hours)
├── C1: 12 agents with truth-first preambles
├── C2: DB + run tracer + artifact retrieval (pgvector)
├── C3: Orchestrator (confidence + budget enforced)
├── C4: Markdown-first artifacts + DOCX + JSON bundle
├── C5: Web Pipeline UI (desktop, not mobile)
└── C6: Memory-aware pipeline (bidirectional sync) ⭐

PHASE 3: Build Loop (2 prompts, ~7 hours)
├── B1: Plan-Patch-Test-Preview cycle
└── B2: Preview deployment (Snack / Vercel)

PHASE 4: SaaS Productization (4 prompts, ~12 hours)
├── S1: Multi-tenancy + auth (Clerk or Auth.js)
├── S2: Stripe billing + usage caps
├── S3: Relationship arc onboarding ⭐
└── S4: Landing page + docs + public gallery
⭐ = pillar-critical prompts (the ones that make Aura different from competitors)
Total estimate: 50-60 hours of Claude Code execution + 15-20 hours of your review/debugging.
Cost: $100-180 in Claude Code credits + $50-100 in API credits for testing.
Timeline for solo builder: 8-12 weeks, 1-2 prompts per session, 3-5 sessions per week.

4. Execution Rules (non-negotiable)

One prompt per session. Don't batch. Don't split a single prompt across sessions unless the prompt explicitly says to.
Commit after each prompt. Format: git commit -m "[prompt-id]: [short description]". This is your rollback safety net.
Run npm test after every prompt. If tests fail, fix before moving on. Never stack broken commits.
Update NOTES.md and PROMPTS_LOG.md at the end of every session. You will forget what you did. Your notes are the handoff to your future self.
Model routing: Opus 4.7 for architecture-heavy (P0, F1, F3, F4, F6, C1, C3, C6, B1, S1, S3). Sonnet 4.6 for mechanical (F2, F5, C2, C4, C5, B2, S2, S4).
After each phase, STOP and evaluate. Phase-end decision points:

After Foundation: base should be clean. Don't proceed until all 6 prompts done and tests green.
After Core: Demo to 3 target-wedge users. If 0/3 say "I'd pay for this" → pivot before Build.
After Build: Demo to 10 target users. Need 3+ "I'd pay tomorrow" before SaaS phase.
After SaaS: Private beta → public beta → paid launch.




PROMPT P0 — Product Identity Specification
Purpose: Lock down the product's north star before writing any code.
Model: Opus 4.7 · Time: ~1 hour · Output: docs/PRODUCT_IDENTITY.md + replit.md update + README.md · Dependencies: None (docs only)
Paste this prompt into Claude Code:
Execute Prompt P0 — Product Identity Specification.

This is DOCS-ONLY. Do NOT modify code files in /app /server /shared /components /lib /constants /tests /scripts.

CONTEXT: Aura has three pillars:
1. Truth-First Engine (operating principle: confidence ratings, anti-hallucination, intent matching, anti-sycophancy)
2. Personal Companion (daily chat, memory, tasks, daily plans — always free)
3. Virtual Company Engine (12-agent pipeline producing working apps + governance bundle — paywall)

Wedge: solo technical founders building pre-seed startups.

TASK: Create docs/PRODUCT_IDENTITY.md with these 7 sections:

## 1. What Aura Is
Single-sentence definition. Refine this draft for clarity:
"Aura is the AI companion that knows you, tells you the truth, and can spin up a virtual company to ship what you're dreaming about."

## 2. The Three Pillars
- Truth-First Engine: operating principle (not feature). Governs chat AND pipeline.
- Personal Companion: daily habit layer. Chat, memory (encrypted, user-controlled), tasks, daily plans. Compounds with use. Always free.
- Virtual Company Engine: activation moment. 12 agents, 5 phases, app preview + governance bundle. Paywall. Consumes companion memory.
Explain why all three must coexist.

## 3. Non-Negotiables (6)
1. Every output has confidence rating (High/Medium/Low + reason)
2. User data encrypted at rest (AES-256-GCM); user controls memory fully
3. Aura refuses to hallucinate — says "I don't know" or cites sources
4. No sycophancy ("Great question!"), no filler ("Certainly!")
5. Personal Companion always free
6. Virtual Company requires paid plan (except 1 small free run/month)

## 4. Anti-Identity (what Aura is NOT) — 5 actionable items
1. Not Cursor/Claude Code (not IDE plugin, not code-only)
2. Not v0/Bolt/Lovable (not vibes-first, always shows reasoning)
3. Not ChatGPT (remembers persistently, confidence-rates, delivers artifacts)
4. Not a chatbot (has opinions, produces structured output)
5. Not a productivity tracker (thinking partner that also executes)

## 5. Wedge Customer
- Primary: Solo technical founders, pre-seed
- Pain: "17 ideas, zero packages to show investors"
- Job: Idea → investable MVP package in a weekend
- Deliverable: App preview + PRD + architecture + threat model + GTM brief in <48h
- Pricing: $49/mo unlimited, OR $199 one-shot weekend
- Secondary (future): SMB agencies, enterprise innovation teams

## 6. Design Principles (5)
1. Calm over flashy (no emojis, no exclamation points in UI)
2. Confidence over assertion
3. Memory over context windows
4. Governance over vibes
5. Mobile for companion, web for pipeline

## 7. Success Metrics (numeric)
- D1 retention >40%
- D30 retention >20%
- Time-to-first-run <24h post-signup
- First bundle downloaded <48h post-signup
- Free-to-paid conversion >5% within 60 days
- Pipeline gate pass rate >80% on first attempt
- User artifact usefulness score >4/5

ALSO:
- Update replit.md: add "## Three-Pillar Architecture" H2 section at TOP (after H1). Include 3-sentence summary + link to docs/PRODUCT_IDENTITY.md. Preserve all existing content below.
- Create README.md at repo root. Anchor on: (1) "What Aura Is" sentence, (2) 2-paragraph three-pillar overview, (3) "Start here" link to docs/PRODUCT_IDENTITY.md, (4) "Development" link to replit.md.

HARD CONSTRAINTS: Touch ONLY docs/PRODUCT_IDENTITY.md, replit.md, README.md. Do NOT run npm or modify any code/config folders.

OUTPUT when done: full content of all 3 files. Then STOP and wait for my approval.
Commit: git add docs/PRODUCT_IDENTITY.md replit.md README.md && git commit -m "P0: product identity spec"

PROMPT F1 — Provider Abstraction
Purpose: Remove Replit lock-in. Run on any host.
Model: Opus 4.7 · Time: ~2-3 hours · Dependencies: Real .env
Paste into Claude Code:
Execute Prompt F1 — Provider Abstraction (kill Replit lock-in).

CONTEXT: Codebase has hard dependencies on Replit:
- server/replit_integrations/ folder
- AI_INTEGRATIONS_* env vars
- REPLIT_DEV_DOMAIN in scripts
- Assumes Replit Postgres

Abstract so Aura runs on Render/Railway/Fly/AWS/Vercel. Prerequisite for SaaS deployment.

READ FIRST: server/ai-provider.ts, server/replit_integrations/, server/index.ts, server/db.ts, package.json, app.json, docs/PRODUCT_IDENTITY.md.

WHAT TO BUILD:

1. server/providers/ai-provider-interface.ts:
   export interface AIProvider {
     id: string;
     name: string;
     chat(params: ChatParams): Promise<ChatResponse>;
     stream(params: ChatParams): AsyncIterable<ChatChunk>;
     embed(text: string): Promise<number[]>;
     countTokens(text: string): number;
   }
   Define ChatParams/ChatResponse/ChatChunk. No provider-specific code here.

2. server/providers/openai-provider.ts: direct OpenAI SDK. Reads OPENAI_API_KEY and optional OPENAI_BASE_URL. Implements full interface.

3. server/providers/anthropic-provider.ts: direct Anthropic SDK. Reads ANTHROPIC_API_KEY. Implements full interface.

4. server/providers/provider-registry.ts:
   - selectProvider(tier: ModelTier): AIProvider — routes by tier
   - Env-driven: ANTHROPIC_API_KEY present → Anthropic for 'frontier'/'skill' tiers; fallback to OpenAI
   - Cache provider instances

5. Refactor server/ai-provider.ts: replace all Replit Integrations calls with provider-registry. Keep public API stable.

6. Update server/db.ts: read DATABASE_URL from env. Standard Postgres URL. Remove Replit-specific code. Use pg.Pool with max/idle settings for serverless.

7. Delete server/replit_integrations/ entirely.

8. Update package.json scripts:
   - "expo:dev": "npx expo start" (remove REPLIT_DEV_DOMAIN)
   - Add "dev": "concurrently \"npm run server:dev\" \"npm run expo:dev\""
   - Install concurrently as devDependency

9. Update .env.example:
   DATABASE_URL=
   SESSION_SECRET=
   OPENAI_API_KEY=
   ANTHROPIC_API_KEY=
   PORT=5000
   NODE_ENV=development

VERIFICATION:
- npm test → all pass
- npm run server:dev → "Connected to Postgres", "Provider: openai (default)"
- POST /api/chat streams
- grep -r "replit" server/ → ZERO
- grep -r "AI_INTEGRATIONS_" . → ZERO
- grep -r "REPLIT_DEV_DOMAIN" . → ZERO

ROLLBACK IF BROKEN: git reset --hard HEAD~1, report what failed.
Commit: git commit -m "F1: provider abstraction, kill Replit lock-in"

PROMPT F2 — Modularize routes.ts
Purpose: Split the 1,449-line god file.
Model: Sonnet 4.6 · Time: ~2 hours
Paste into Claude Code:
Execute Prompt F2 — Modularize routes.ts.

CONTEXT: server/routes.ts is 1,449 lines. Split before C3 and S1 add more routes.

READ FIRST: server/routes.ts, server/middleware.ts, server/index.ts.

WHAT TO BUILD:

1. Create server/routes/ directory.

2. Split into domain routers:
   - server/routes/index.ts — barrel
   - server/routes/chat.ts — /api/chat, /api/research, /api/extract-memory, /api/extract-actions
   - server/routes/memory.ts — /api/memories/*
   - server/routes/tasks.ts — /api/tasks/*, /api/projects/*, /api/today/*
   - server/routes/messages.ts — /api/messages, /api/conversations/*
   - server/routes/crafts.ts — /api/crafts/*, /api/export
   - server/routes/builder.ts — /api/builder/*
   - server/routes/health.ts — /api/health
   - server/routes/uploads.ts — file uploads

Each exports an Express Router:
   // server/routes/tasks.ts
   import { Router } from "express";
   import { requireAuth } from "../middleware";
   export const tasksRouter = Router();
   tasksRouter.get("/tasks", requireAuth, async (req, res) => { ... });

3. server/routes/index.ts:
   export function buildRouter(): Router {
     const r = Router();
     r.use("/api", healthRouter);
     r.use("/api", chatRouter);
     // ...all routers
     return r;
   }

4. Update server/index.ts: replace `registerRoutes(app)` with `app.use(buildRouter())`.

5. Delete old server/routes.ts ONLY after new structure verified.

6. CRITICAL: every route from original MUST exist in new structure. grep -E "app\.(get|post|patch|delete)" before/after — same count.

VERIFICATION:
- npm test passes (especially supertest tests)
- All endpoints from replit.md API table respond correctly
- Each router file under 300 lines
- grep -rE "app\.(get|post|patch|delete)" server/routes/ → each route appears exactly once
Commit: git commit -m "F2: modularize routes into domain routers"

PROMPT F3 — Unify Skills and Agents
Purpose: One registry, not two.
Model: Opus 4.7 · Time: ~3-4 hours
Paste into Claude Code:
Execute Prompt F3 — Unify Skills and Agents.

CONTEXT: Skills registry (26) + future Agents registry (40+) = conceptual mess. Unify to Agent-first.

READ FIRST: server/skill-engine.ts, server/skill-router.ts, server/skills/*.ts, server/truth-engine.ts (buildTruthSystemPrompt), all tests referencing SKILL_REGISTRY/matchSkills, docs/PRODUCT_IDENTITY.md.

WHAT TO BUILD:

1. shared/agent-schema.ts (ONE canonical definition):

export type AgentLayer = "executive" | "lead" | "specialist" | "advisor";
export type AgentDomain = "engineering" | "product" | "design" | "security" | "operations" | "marketing" | "finance" | "legal" | "data" | "support" | "research" | "education" | "health" | "leadership";
export type PipelinePhase = "discovery" | "design" | "planning" | "implementation" | "verification" | "release" | "gtm";
export type ModelTier = "mini" | "standard" | "skill" | "frontier";

export interface AgentDefinition {
  id: string;
  name: string;
  layer: AgentLayer;
  domain: AgentDomain;
  systemPrompt: string;
  triggerKeywords: string[];
  confidenceRules: { high: string; medium: string; low: string };
  phases: PipelinePhase[];
  inputSchema: string;
  outputSchema: string;
  modelTier: ModelTier;
  estimatedTokens: number;
  chainsWith: string[];
  escalatesTo: string[];
  promptVersion: string;
}

2. server/agents/agent-registry.ts (replaces SKILL_REGISTRY):
AGENT_REGISTRY, registerAgent, getAgent, getAgentsByLayer, getAgentsByDomain, getAgentsForPhase, matchAgentsByKeywords.

3. Migrate server/skills/*.ts → server/agents/advisors/ as AgentDefinition.
Preserve: id, domain, triggerKeywords, systemPrompt, confidenceRules, chainsWith.
New field defaults: layer: "advisor", phases: [], inputSchema: "ChatInput", outputSchema: "ChatOutput", modelTier: "skill", estimatedTokens: 2000, escalatesTo: [], promptVersion: "1.0.0".

4. Rename server/skill-router.ts → server/agents/agent-router.ts. Update imports.

5. Update server/truth-engine.ts: SkillDefinition → AgentDefinition, SkillContext → AgentContext.

6. Delete server/skill-engine.ts and server/skills/ after migration complete.

7. Update ALL tests.

8. tests/agent-registry.test.ts:
- registry.size === 26
- Every agent has non-empty systemPrompt
- Every chainsWith resolves
- getAgentsForPhase("discovery").length === 0 (pipeline agents not yet registered)
- matchAgentsByKeywords works identically to old matchSkills

EXECUTION ORDER:
a) Create agent-schema + agent-registry
b) Migrate ONE skill (cto-advisor) as template
c) Run tests to verify pattern
d) Migrate remaining 25
e) Update skill-router and truth-engine
f) Update tests
g) Delete old files only after all green

VERIFICATION:
- npm test passes
- grep -r "SKILL_REGISTRY\|SkillDefinition\|SkillContext\|matchSkills" . → ZERO in source
- Server starts, "help me with tech strategy" activates cto agent
Commit: git commit -m "F3: unify skills into agent registry"

PROMPT F4 — Evaluation Framework
Purpose: Rubric-based quality measurement beyond schema validation.
Model: Opus 4.7 · Time: ~2-3 hours
Paste into Claude Code:
Execute Prompt F4 — Evaluation Framework.

CONTEXT: Zod schemas catch JSON shape, not quality. A PRD can be perfectly shaped and vague. Need rubric-based eval before more agents.

READ FIRST: scripts/run-eval.ts, scripts/quality-report.ts, tests/eval/, server/verification-engine.ts, docs/PRODUCT_IDENTITY.md.

WHAT TO BUILD:

1. server/eval/rubric-schema.ts:

export interface EvalRubric {
  id: string;
  name: string;
  artifactType: string;
  criteria: EvalCriterion[];
}

export interface EvalCriterion {
  id: string;
  description: string;
  weight: number;  // 0-1, weights sum to 1
  scoringGuide: { excellent: string; good: string; acceptable: string; poor: string };
}

export interface EvalResult {
  rubricId: string;
  artifactId: string;
  overallScore: number;  // 0-1
  criterionScores: { criterionId: string; score: number; rationale: string }[];
  evaluatedBy: string;
  evaluatedAt: string;
  confidence: "High" | "Medium" | "Low";
}

2. Rubrics in server/eval/rubrics/:
- prd-rubric.ts
- adr-rubric.ts
- project-charter-rubric.ts
- chat-response-rubric.ts

Example PRD criteria:
- "Problem statement describes user pain (not solution)"
- "Target users named with persona detail"
- "Acceptance criteria are testable predicates"
- "Success metrics have numeric targets"
- "At least one non-goal stated"
- "Open questions listed explicitly"

3. server/eval/evaluator.ts:

export async function evaluateArtifact(artifact, rubric, provider): Promise<EvalResult>

CRITICAL: Must use DIFFERENT provider/model than generator (GAN separation).

4. tests/eval/:
- 20 golden prompts (5 per artifact type)
- Expected minimum scores per rubric
- Rewrite scripts/run-eval.ts to run all 20, report pass/fail

5. npm scripts:
"eval": "tsx scripts/run-eval.ts"
"eval:watch": "tsx scripts/run-eval.ts --watch"

6. docs/EVAL_LOG.md — changelog of scores over time.

VERIFICATION:
- npm run eval → runs 20 cases, reports scores
- Every rubric weights sum to 1.0
- Evaluator uses different provider than generators
Commit: git commit -m "F4: rubric-based eval framework"

PROMPT F5 — Budget, Concurrency, Prompt Versioning
Purpose: Safety systems before orchestrator ships.
Model: Sonnet 4.6 · Time: ~2 hours
Paste into Claude Code:
Execute Prompt F5 — Budget, concurrency, prompt versioning.

CONTEXT: Before orchestrator: cost caps, concurrency limits, versioning.

READ FIRST: server/model-router.ts, server/middleware.ts, server/migration.ts, shared/agent-schema.ts.

WHAT TO BUILD:

1. server/orchestrator/budget-guard.ts:

export interface RunBudget {
  maxCostUSD: number;      // default 5.00
  maxTokens: number;       // default 500000
  maxDurationSec: number;  // default 900
  maxAgentCalls: number;   // default 50
}

export class BudgetGuard {
  constructor(runId: string, budget: RunBudget);
  canAfford(estimatedTokens: number, modelTier: ModelTier): boolean;
  record(actualTokens: number, actualCost: number): void;
  check(): { withinBudget: boolean; reason?: string };
  remaining(): { costUSD: number; tokens: number; sec: number; calls: number };
}

On breach: orchestrator pauses run with status='paused-budget'.

2. server/orchestrator/concurrency-guard.ts:

export async function acquireRunSlot(userId, orgId): Promise<{ acquired: boolean; currentRuns: number; maxRuns: number }>;
export async function releaseRunSlot(userId, runId): Promise<void>;

Defaults: Free=1, Paid=3, Enterprise=10. Use Postgres advisory lock OR active_runs table.

3. Prompt versioning:
- AgentDefinition.promptVersion already exists (F3)
- ALTER TABLE run_steps ADD COLUMN prompt_version TEXT
- When replaying runs, use same promptVersion

4. Add to migration.ts:

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

5. scripts/snapshot-prompts.ts — walks agent registry, writes to prompt_versions. Add "prompts:snapshot": "tsx scripts/snapshot-prompts.ts".

6. tests/budget-guard.test.ts, tests/concurrency-guard.test.ts.

VERIFICATION:
- npm test passes
- Two concurrent runs as free-tier user → second refused
- npm run prompts:snapshot → prompt_versions populated
Commit: git commit -m "F5: budget guard, concurrency, prompt versioning"

PROMPT F6 — Truth-First Engine Extends to Pipeline ⭐
Purpose: Pillar-critical. AURA_CORE principles govern every agent output, gate, decision.
Model: Opus 4.7 · Time: ~2-3 hours
Paste into Claude Code:
Execute Prompt F6 — Truth-First Engine extends to pipeline.

CONTEXT: AURA_CORE currently governs chat only. Per docs/PRODUCT_IDENTITY.md, Truth-First Engine must govern EVERYTHING. This is what no competitor has.

READ FIRST: server/truth-engine.ts (AURA_CORE, parseConfidence, answer shapes), shared/agent-schema.ts, server/eval/rubric-schema.ts, docs/PRODUCT_IDENTITY.md.

WHAT TO BUILD:

1. server/truth-first/principles.ts:

export const TRUTH_FIRST_PRINCIPLES = {
  confidence: `Every response ends with "Confidence: High|Medium|Low (reason)".
    High: established consensus or direct observation.
    Medium: reasoning from partial information or frameworks.
    Low: prediction, speculation, or information likely stale.`,
  intentMatching: `Identify what's actually asked. Don't answer adjacent questions.`,
  antiHallucination: `When uncertain, say so. Cite sources when grounded. Never invent citations, statistics, or capabilities.`,
  antiBlabbing: `Answer first, context second, caveats third. Match length to complexity. No filler openings.`,
  escalationHonesty: `Out of depth? Escalate. Specialists → leads → executives → human.`,
};

export function buildTruthFirstPreamble(context: "chat"|"agent"|"orchestrator"|"evaluator"|"gate"): string;
export function extractConfidence(content: string): { confidence: "High"|"Medium"|"Low"; reason: string; cleanContent: string };

2. server/agents/prompt-builder.ts — every agent prompt prepended with:

"You are the [Role]. You operate under Aura's Truth-First Engine:
- Every artifact includes a confidence rating
- If required input missing/ambiguous, produce 'clarification-needed' artifact instead of guessing
- When citing frameworks, name them specifically
- Never invent statistics, benchmarks, or case studies
- If output would be padded to meet length target, produce shorter output instead

[Role-specific prompt follows]"

3. Artifact schemas include confidence:

// Added to every Zod schema:
confidence: z.object({
  level: z.enum(["High", "Medium", "Low"]),
  reason: z.string().min(10),
  uncertainties: z.array(z.string()).optional(),
})

4. Orchestrator logs confidence at every decision (full integration in C3):

In agent_decisions:
{
  question: "Which agents to activate for phase X?",
  decision: "Activated [list]",
  reasoning: "...",
  confidence: "High|Medium|Low",
  reversible: true
}

5. GateResult includes confidence (full integration in C2):
{ passed, confidence, confidenceReason, checks }
Low-confidence gates → surface to user, don't auto-pass.

6. Evaluator (F4) already has confidence. Wire up: Low evaluator confidence → human review.

7. tests/truth-first.test.ts:
- Every agent output parses with valid confidence
- Artifacts missing confidence fail schema
- Low-confidence gates trigger human-review state

VERIFICATION:
- npm test passes
- buildTruthFirstPreamble("agent") returns proper preamble
- extractConfidence parses correctly
- Artifact schemas reject missing confidence field
Commit: git commit -m "F6: Truth-First Engine governs pipeline layer"
FOUNDATION CHECKPOINT: After F6, take 24 hours off. Foundation is cognitively heavy. Let it settle before Core.

PROMPT C1 — Twelve Pipeline Agents
Purpose: Register the 12 core pipeline agents.
Model: Opus 4.7 · Time: ~3-4 hours
Paste into Claude Code:
Execute Prompt C1 — Twelve Pipeline Agents.

CONTEXT: 12 agents, not 40. Quality over quantity.

READ FIRST: shared/agent-schema.ts (F3), server/agents/agent-registry.ts, server/agents/advisors/, server/agents/prompt-builder.ts (F6), server/eval/rubrics/, docs/PRODUCT_IDENTITY.md.

WHAT TO BUILD — 12 AgentDefinition files in server/agents/pipeline/:

EXECUTIVES (5):
- ceo.ts       — phases: [discovery, planning, gtm]   → Project Charter, delivery recommendation
- cto.ts       — phases: [design, verification]       → Architecture, ADRs
- cpo.ts       — phases: [discovery, design, gtm]     → PRD, user stories, acceptance criteria
- coo.ts       — phases: [planning, release]          → Delivery plan, RAID log
- ciso.ts      — phases: [design, verification]       → Threat model, security review (conditional: auth/PII/payments)

LEADS (4):
- eng-lead.ts      — phases: [planning, implementation, verification]  → Sprint plan, code review
- qa-lead.ts       — phases: [verification]                            → Test strategy, QA report
- design-lead.ts   — phases: [design, implementation]                  → Design spec, component library
- devops-lead.ts   — phases: [release]                                 → Deployment runbook, rollback plan

SPECIALISTS (3):
- architect.ts       — phases: [design]                    → System design doc
- fullstack-eng.ts   — phases: [implementation]            → Code implementation
- tech-writer.ts     — phases: [implementation, release]   → Documentation

Each file:
1. systemPrompt 300-600 words. Encode FRAMEWORKS (not "50 years of expertise"). CTO: C4 model, 12-factor, ADR format, STRIDE, OWASP. Frameworks are what models can actually apply.
2. confidenceRules for the domain
3. chainsWith populated
4. escalatesTo populated (specialist → lead → executive; CEO → [])
5. inputSchema, outputSchema names
6. estimatedTokens (calibrate; typical 2000-6000)
7. promptVersion: "1.0.0"

CRITICAL: Every systemPrompt wrapped with buildTruthFirstPreamble("agent") from F6.

Every systemPrompt starts with: "You are the [Role]. You operate as part of a multi-agent product delivery pipeline. Your output will be validated against a schema and evaluated by a separate evaluator agent. Produce valid structured output — no preamble, no apologies, no meta-commentary."

Update/create matching rubric in server/eval/rubrics/ for each agent.

Register all 12 in server/agents/pipeline/index.ts.

Run npm run prompts:snapshot after.

VERIFICATION:
- npm test passes
- AGENT_REGISTRY.size === 26 + 12 = 38
- getAgentsForPhase("discovery").length >= 2
- getAgentsForPhase("implementation").length >= 2
- Every agent systemPrompt.length >= 1500
- No agent contains "50 years" or similar
- prompt_versions table has 12 new rows
Commit: git commit -m "C1: 12 pipeline agents registered"

PROMPT C2 — DB + Run Tracer + Artifact Retrieval
Purpose: Observability tables + pgvector retrieval.
Model: Sonnet 4.6 · Time: ~2-3 hours
Paste into Claude Code:
Execute Prompt C2 — Database, run tracer, artifact retrieval.

CONTEXT: Orchestrator needs observability tables + retrieval for memory-aware pipelines.

READ FIRST: server/migration.ts, server/db.ts, server/memory-engine.ts, server/embedding-engine.ts, server/retrieval-engine.ts, server/encryption.ts.

WHAT TO BUILD:

1. Add to server/migration.ts (idempotent):
- CREATE EXTENSION IF NOT EXISTS vector; (top of initDatabase)
- pipeline_runs (with org_id UUID, budget_json JSONB)
- run_steps (with prompt_version from F5)
- run_artifacts (with embedding VECTOR(1536), quality_score REAL, rubric_id TEXT)
- gate_results
- tool_calls
- agent_decisions

Use exact schema from spec; all text fields encrypted.

2. server/orchestrator/run-tracer.ts:
Functions: createRun, logStep, completeStep, logArtifact, logGateResult, logToolCall, logDecision, updateRunStatus, completeRun, getRun, listRuns, getRunArtifacts, getRunSteps, getRunCost, retrieveSimilarArtifacts(orgId, queryEmbedding, artifactType, limit).

retrieveSimilarArtifacts: pgvector cosine similarity, filtered by org (multi-tenant isolation).

3. server/orchestrator/artifact-embedder.ts:
- Computes embeddings for new artifacts
- Uses embedding-engine.ts
- Async — doesn't block pipeline

4. server/orchestrator/gate-engine.ts:
- Gate definitions G1-G5
- evaluateGate calls F4 evaluator on artifacts
- Gate passes only if schema valid AND eval score >= 0.65
- Returns GateResult with confidence (F6)
- getRequiredGates(phase, deliveryOption)
- isGateRequired — G3 conditional on auth/PII/payments keywords

5. tests/run-tracer.test.ts, tests/artifact-retrieval.test.ts, tests/gate-engine.test.ts.

VERIFICATION:
- npm test passes
- psql: SELECT extname FROM pg_extension WHERE extname='vector' → returns 'vector'
- Sample artifact logged → embedding within 5s
- Similarity search returns cosine-sorted results
Commit: git commit -m "C2: pipeline tables, run tracer, pgvector retrieval"

PROMPT C3 — The Orchestrator (SPLIT INTO TWO SESSIONS)
Purpose: Main engine. Budget-enforced, confidence-rated, truth-first.
Model: Opus 4.7 · Time: ~4-5 hours across two sessions
Session C3a — Part 1
Paste into Claude Code:
Execute Prompt C3, PART 1 ONLY — Intent classifier, artifact schemas, agent invoker.

Do NOT build pipeline-engine or routes in this session.

READ FIRST: All F1-F6, C1, C2 files. server/routes/chat.ts (F2). server/truth-engine.ts.

WHAT TO BUILD (PART 1 ONLY):

1. server/orchestrator/intent-classifier.ts:
- Rule-based first (<1ms), LLM fallback (<200ms, mini tier)
- Returns: { intent: "chat"|"build"|"ambiguous"|"build-extend", confidence, reason }
- Strong build: "build me", "create a", "ship", "deploy"
- Strong chat: questions "what/how/why"
- Short messages (<15 words) without build keywords → chat

2. server/orchestrator/artifact-schemas.ts:
All Zod schemas referenced in AgentDefinition.outputSchema from C1.
Every schema includes confidence field (F6).
Schemas use .describe() for fields.

3. server/orchestrator/agent-invoker.ts:

export async function invokeAgent(agent, input, outputSchema, provider, budget): Promise<AgentOutput>

Logic:
- budget.canAfford() BEFORE invocation
- Retrieve 2-3 similar past artifacts (retrieveSimilarArtifacts)
- Assemble: buildTruthFirstPreamble + agent.systemPrompt + schema description + past artifacts
- Call provider (select by agent.modelTier)
- Parse + validate Zod
- One retry with error feedback
- Evaluate via F4 evaluator
- logStep + logArtifact + embedding async

VERIFICATION:
- npm test passes
- intent-classifier: "build me a todo app" → build, "what is TypeScript" → chat
- artifact-schemas: every schema has confidence field
- agent-invoker: budget breach aborts

STOP HERE. Do NOT build pipeline-engine or routes.
Commit Part 1: git commit -m "C3a: intent classifier, artifact schemas, agent invoker"
Session C3b — Part 2
Paste into Claude Code:
Execute Prompt C3, PART 2 — Pipeline engine, routes, chat integration.

Part 1 complete. Now the main orchestrator.

WHAT TO BUILD:

1. server/orchestrator/pipeline-engine.ts:

export async function runPipeline(input: PipelineInput): Promise<PipelineResult>

async function runPipeline(input) {
  await concurrencyGuard.acquire(userId, orgId);
  const runId = await createRun(...);
  const budget = new BudgetGuard(runId, input.budget ?? DEFAULT_BUDGET);
  
  try {
    for (phase of ["discovery", "design", "planning", "implementation", "verification"]) {
      emitSSE({ type: "phase_start", phase });
      const agents = getAgentsForPhase(phase).filter(shouldActivate);
      
      // Parallel fan-out, isolated failures
      const results = await Promise.allSettled(
        agents.map(agent => invokeAgent(agent, buildInput(runId, phase), ...))
      );
      
      const artifacts = results.filter(fulfilled).flatMap(r => r.value.artifacts);
      if (artifacts.length === 0) throw new Error(`Phase ${phase}: all agents failed`);
      
      const gate = await evaluateGate(phase, runId, artifacts);
      if (!gate.passed) {
        await updateRunStatus(runId, "paused-gate");
        emitSSE({ type: "gate_failed", phase, reason, confidence: gate.confidence });
        return { runId, status: "paused-gate" };
      }
      
      if (!budget.check().withinBudget) {
        await updateRunStatus(runId, "paused-budget");
        return { runId, status: "paused-budget" };
      }
    }
    
    await completeRun(runId);
    emitSSE({ type: "pipeline_complete", runId });
    return { runId, status: "completed" };
  } finally {
    await concurrencyGuard.release(userId, runId);
  }
}

Phases A-E only. F (Release), G (GTM) deferred to v2.

SSE events: pipeline_start, phase_start, agent_working, artifact_produced, gate_check, gate_failed, phase_complete, pipeline_complete, pipeline_error, budget_exceeded.

2. server/routes/pipeline.ts:
- POST /api/pipeline/start (SSE)
- GET /api/pipeline/runs
- GET /api/pipeline/runs/:id
- GET /api/pipeline/runs/:id/artifacts
- POST /api/pipeline/runs/:id/resume
- POST /api/pipeline/runs/:id/cancel

3. Integrate intent classifier into server/routes/chat.ts:
- After mode detection, classifyIntent
- "build" → emit build_detected SSE, stop chat flow
- "ambiguous" → clarification message
- "chat" → existing path unchanged

4. tests/orchestrator-e2e.test.ts — end-to-end minimal pipeline.

VERIFICATION:
- npm test passes
- POST /api/chat "build me a todo tracker" → build_detected event
- POST /api/pipeline/start → SSE events flow through phases → pipeline_complete
- pipeline_runs: status='completed', sensible cost/duration
- Second concurrent run same free user → 429
Commit Part 2: git commit -m "C3b: pipeline engine, routes, chat integration"

PROMPT C4 — Multi-Format Artifacts
Purpose: Markdown primary, DOCX and JSON secondary.
Model: Sonnet 4.6 · Time: ~2-3 hours
Paste into Claude Code:
Execute Prompt C4 — Multi-format artifact generation.

CONTEXT: DOCX alone is outdated. Target users live in Notion, Linear, GitHub. Markdown canonical; DOCX/JSON exports.

READ FIRST: server/craft-engine.ts, server/document-engine.ts, server/export-engine.ts.

WHAT TO BUILD:

1. server/orchestrator/artifact-formatter.ts:

export async function formatArtifact(artifact, format: "markdown"|"docx"|"json"): Promise<FormattedArtifact>

Markdown templates per artifact type. Example PRD:

# Product Requirements: {title}

> Generated by Aura on {date} · Run ID: {runId} · Confidence: {confidence}

## Problem
{problemStatement}

## Target Users
{personas}

## User Stories
{stories}

## Acceptance Criteria
| Criterion | Testable Predicate | Priority |
|---|---|---|

## Success Metrics
- {metric}: target {target}

## Out of Scope
- {non-goal}

## Open Questions
- {question}

Similar for: project-charter, architecture-doc, adr, threat-model, test-strategy, deployment-runbook, gtm-brief.

2. server/orchestrator/bundle-generator.ts:
Produces bundle.zip:
  README.md (index, run stats, gate results, confidence summary)
  docs-markdown/
  docs-docx/
  artifacts-json/
  metadata.json

3. Update pipeline-engine.ts (C3):
- After each phase: format as markdown first, DOCX conversion async
- After pipeline complete: generate bundle

4. Routes in server/routes/pipeline.ts:
- GET /api/pipeline/runs/:id/bundle → bundle.zip
- GET /api/pipeline/runs/:id/artifacts/:artifactId?format=markdown|docx|json

5. tests/artifact-formatter.test.ts, tests/bundle-generator.test.ts.

VERIFICATION:
- npm test passes
- Run pipeline → download bundle.zip → markdown renders cleanly, DOCX opens in Word, JSON validates
Commit: git commit -m "C4: markdown-first artifacts, DOCX/JSON exports, bundle"

PROMPT C5 — Web Pipeline UI
Purpose: Pipeline on desktop. Mobile keeps chat.
Model: Sonnet 4.6 · Time: ~3-4 hours
Paste into Claude Code:
Execute Prompt C5 — Web Pipeline UI.

CONTEXT: No one reviews a 10-page PRD on a phone. Pipeline is web-only. Mobile keeps companion layer.

READ FIRST: app/(tabs)/_layout.tsx (sidebar pattern), components/WebContainer.tsx, components/chat/ (SSE), constants/colors.ts, docs/PRODUCT_IDENTITY.md.

WHAT TO BUILD:

1. Web-only routes via Expo Router:
- app/pipeline/_layout.tsx — redirects to /(tabs)/aura on native
- app/pipeline/index.tsx — dashboard
- app/pipeline/new.tsx — build wizard
- app/pipeline/[runId].tsx — live run
- app/pipeline/runs.tsx — run history

2. components/pipeline/ (web-only):
- PipelineDashboard.tsx — recent runs, cost trends
- NewBuildWizard.tsx — 3-step: describe → delivery option → budget
- LiveRunView.tsx — 5 phase columns, agent activity, artifact cards with confidence badges
- ArtifactViewer.tsx — markdown render + edit/download
- RunDetails.tsx — gates, decisions log, cost breakdown

3. Design:
- Reuse constants/colors.ts (dark theme)
- Desktop: sidebar (220px) + main (flex) + right rail (320px for preview)
- Confidence badges throughout (green/amber/red)
- New ACCENT_PIPELINE color

4. SSE handling: extend client from components/chat/ to handle all C3 events.

5. Mobile handoff:
- Mobile chat: "build me X" → build_detected SSE → "Continue in browser" card with deep link
- Deep link → /pipeline/new with request prefilled
- No pipeline UI on mobile (only launch)

VERIFICATION:
- npx expo start --web → /pipeline loads
- Build wizard works, pipeline starts
- Live view: SSE events render with confidence badges
- Bundle downloads from completed run
- Mobile: "build me X" → deep link card (does NOT run on device)
- Lighthouse: performance >70, accessibility >90
Commit: git commit -m "C5: web pipeline UI, confidence-first"

PROMPT C6 — Memory-Aware Pipeline ⭐
Purpose: Pillar-critical. Memories seed pipelines; pipelines generate memories. The moat.
Model: Opus 4.7 · Time: ~3-4 hours
Paste into Claude Code:
Execute Prompt C6 — Memory-Aware Pipeline, bidirectional sync.

CONTEXT: Personal Companion has rich memory. Virtual Company currently ignores it. This is the compounding moat — Week 12 Aura radically more personalized than Day 1.

READ FIRST: server/memory-engine.ts, server/memory-consolidator.ts, all pipeline files (C1-C5), docs/PRODUCT_IDENTITY.md.

WHAT TO BUILD:

1. Memory → Pipeline:

server/orchestrator/context-builder.ts:

export async function buildRunContext(userId, orgId, userRequest): Promise<RunContext>

RunContext:
- Top 5-10 memories filtered by embedding similarity to userRequest
- Last 20 messages from current conversation
- Past pipeline run summaries from this org
- Preferences relevant to build

Agents get "User Context" section in prompt:
## User Context
- Recent preferences: {list}
- Active projects: {names, status}
- Constraints: {budget, timeline, stack}
- Past builds: {titles, outcomes}

CEO Charter mentions user's background. Architect picks their preferred stack. CMO targets their market.

2. Pipeline → Memory:

server/orchestrator/memory-extractor.ts runs post-pipeline:
- Extract decisions made
- Extract constraints discovered
- Extract request patterns
- Tag source='pipeline'

3. Memory UI:
- Memory tab filter: "From chat" | "From builds" | "All"
- Memory detail shows source context (link to conversation or run)

4. Pipeline UI memory surface (/pipeline/new):
- "What Aura knows about you" card
- Relevant memories for this run
- Users can deselect per-run
- Transparent about what context is used

5. Cross-run learning:
- Past artifacts retrievable as context for new pipelines
- pgvector similarity (from C2)

6. tests/context-builder.test.ts, tests/memory-extractor.test.ts, tests/cross-run-retrieval.test.ts.

VERIFICATION:
- User creates 10 memories via chat → /pipeline/new shows "Aura knows you prefer X, Y, Z"
- Complete pipeline → Memory tab has 3-5 new "From builds" memories
- Second similar pipeline → retrieves first run's artifacts
- Delete memory → stops appearing in subsequent pipelines
Commit: git commit -m "C6: memory-aware pipeline, bidirectional sync"
CORE CHECKPOINT: After C6:

Run 3 pipelines yourself
Demo to 3 target-wedge users (solo founders)
Ask: "Would you pay $49/month for this?"
If 0/3 yes → iterate on Core before Build
If 2+/3 yes → proceed to B1


PROMPT B1 — Build Loop
Purpose: Working apps, not just docs. The v0/Bolt-beating differentiator.
Model: Opus 4.7 · Time: ~4-5 hours
Paste into Claude Code:
Execute Prompt B1 — Build Loop (Plan-Patch-Test-Preview).

CONTEXT: builder-engine.ts is 96 lines of CRUD. Pipeline produces docs but NO RUNNING APP. v0/Bolt/Lovable produce apps. We need BOTH apps and governance docs.

READ FIRST: server/builder-engine.ts, server/snack-engine.ts, server/craft-engine.ts, fullstack-eng agent from C1.

WHAT TO BUILD:

1. server/orchestrator/build-loop.ts — Plan-Patch-Test-Preview:

async function runBuildLoop(input): Promise<BuildResult>

Cycle:
  Plan:    fullstack-eng produces file tree + acceptance criteria (from PRD)
  Patch:   fullstack-eng produces code per file (parallel invocations)
  Test:    qa-lead produces tests + runs in sandbox
  Preview: deploys to Snack (RN) or Vercel/StackBlitz (web)
  
  Tests fail → feed failures back → retry up to 2x
  Tests pass → final build artifact with preview URL

2. server/orchestrator/sandbox-runner.ts:
- esbuild + vitest for unit tests (start here)
- Node vm.runInNewContext for integration (later)
- Docker dockerode for accuracy (future)

3. Update fullstack-eng (C1) to produce structured code output:
{
  "files": [{ "path": "src/App.tsx", "content": "...", "reason": "..." }],
  "dependencies": { "react": "^19" },
  "testPlan": [{ "file": "src/App.test.tsx", "description": "..." }]
}

4. Integrate with pipeline-engine:
After "implementation" phase → runBuildLoop → result becomes "app-bundle" artifact with preview URL.

5. Update artifact-schemas + rubrics for app-bundle.

6. tests/build-loop.test.ts (minimal "counter app" build, preview URL returns HTTP 200).

VERIFICATION:
- npm test passes
- Run pipeline for "simple counter app" → pipeline completes, preview URL accessible, counter increments
- Bundle includes /app/ with generated code
- Test failures trigger retry (logs show "retry 1")

REALISTIC EXPECTATION: First-version code quality B-. Differentiator is NOT "better code than Cursor" — it's "code comes with PRD + tests + threat model."
Commit: git commit -m "B1: Plan-Patch-Test-Preview build loop"

PROMPT B2 — Preview Deployment
Purpose: Live URLs.
Model: Sonnet 4.6 · Time: ~2-3 hours
Paste into Claude Code:
Execute Prompt B2 — Preview Deployment.

CONTEXT: Users need clickable preview URLs.

READ FIRST: server/snack-engine.ts, package.json (snack-sdk already installed).

WHAT TO BUILD:

1. Enhance server/snack-engine.ts:
- Given app file tree, create Snack project
- Return snack.expo.dev URL
- Auth via SNACK_SESSION_TOKEN

2. server/orchestrator/preview-deployer.ts:

export async function deployPreview(appBundle, target: "snack"|"vercel"|"stackblitz"): Promise<{ url, provider }>

Routing:
- React Native → Snack
- Next.js/React web → Vercel API (StackBlitz fallback)
- Static HTML/JS → StackBlitz

3. Add to .env.example: VERCEL_TOKEN, STACKBLITZ_API_KEY, SNACK_SESSION_TOKEN.

4. tests/preview-deployer.test.ts (mock HTTP, routing tests).

VERIFICATION:
- npm test passes
- With real tokens, trigger build → preview URL opens working app
- Snack: counter increments on tap
- Vercel: page loads, TTFB <2s
Commit: git commit -m "B2: Snack/Vercel/StackBlitz preview deployment"
BUILD CHECKPOINT: After B2:

Demo to 10 target-wedge users
Need 3+ saying "I'd pay for this tomorrow"
If yes → SaaS phase
If no → DO NOT productize weak offering. Iterate on build quality.


PROMPT S1 — Multi-Tenancy + Auth
Purpose: Orgs, members, roles, proper auth for SaaS.
Model: Opus 4.7 · Time: ~3-4 hours
Paste into Claude Code:
Execute Prompt S1 — Multi-tenancy and auth.

CONTEXT: Current `users` keyed by device_id. SaaS needs orgs, members, roles, email/OAuth.

WHAT TO BUILD:

1. Integrate Clerk (recommended for speed) OR Auth.js. Pick Clerk unless you have strong reason otherwise.

2. DB schema:
- orgs (id, name, plan, stripe_customer_id, created_at)
- org_members (user_id, org_id, role: owner/admin/member)
- org_invites (token, email, org_id, role, expires_at)

3. All existing tables get org_id; all queries scoped to org:
- messages, tasks, memories, pipeline_runs, run_steps, run_artifacts

4. Row-level security via Postgres RLS.

5. Middleware: req.user and req.org populated from auth token.

6. Migration for existing device-id users:
- On first login, create personal org
- Migrate data (org_id = personal org id)

7. UI:
- Org switcher in sidebar (web)
- Invite flow
- Member management page

VERIFICATION:
- Create two orgs, verify data isolation (user A can't see org B's runs)
- Invite member, joins with correct role
- Existing device-id data migrates correctly
Commit: git commit -m "S1: multi-tenancy, orgs, Clerk auth"

PROMPT S2 — Stripe Billing + Usage Caps
Purpose: Charge money.
Model: Sonnet 4.6 · Time: ~2-3 hours
Paste into Claude Code:
Execute Prompt S2 — Stripe billing and usage caps.

CONTEXT: Per docs/PRODUCT_IDENTITY.md:
- Free: 1 build/mo (discovery+design, max 3 artifacts), 1 concurrent, unlimited companion
- Starter $49/mo: 10 builds, all phases, 3 concurrent, build loop, 3 teammates
- Pro $149/mo: unlimited builds, 5 concurrent, frontier priority, 10 teammates
- Enterprise: custom

WHAT TO BUILD:

1. Stripe integration: checkout, customer portal, webhooks (subscription.created/updated, invoice.payment_failed).

2. Usage tracking:
- Builds per org per month
- Token spend per org per month
- Current concurrent runs

3. Overage handling:
- Soft cap (80% warning email)
- Hard cap (block new runs, upgrade CTA)

4. UI:
- /settings/billing page
- Usage meter in sidebar
- Upgrade CTA near limits

5. Webhook handlers persist plan changes.

VERIFICATION:
- Stripe test mode: checkout completes, org plan updates, usage increments
- Soft cap triggers email
- Hard cap blocks new run with clear upgrade message
Commit: git commit -m "S2: Stripe billing, usage caps, overages"

PROMPT S3 — Relationship Arc Onboarding ⭐
Purpose: Pillar-critical. Companion first, Virtual Company unlocks as memory grows.
Model: Opus 4.7 · Time: ~3-4 hours
Paste into Claude Code:
Execute Prompt S3 — Relationship Arc Onboarding.

CONTEXT: Per docs/PRODUCT_IDENTITY.md, onboard via companion FIRST. Virtual Company unlocks as memory grows. This is the retention loop.

WHAT TO BUILD:

1. Onboarding flow (web, first signup):

Screen 1: "Meet Aura — your truth-first AI companion"
- 30-sec video: Aura responding with confidence rating, then remembering.
- CTA: "Start talking to Aura"

Screen 2: First conversation (guided)
- Pre-populated prompt: "What are you working on these days?"
- Aura responds, extracts memory, shows "I've remembered this" confirmation
- Show trust controls (remember/forget, private/shared)

Screen 3: "Aura can do more than chat"
- 3 things unlock as memory grows: daily plans, action extraction, pipeline mode
- Explain pipeline in 1 paragraph + "See an example" link to gallery
- DON'T push pipeline yet

Screen 4: Setup
- Create org, pick plan (default Free)
- Optional: connect GitHub (for B1 previews later)
- Notifications preference

2. Day-by-day journey (first 14 days):

Day 0: Sign up, first conversation
Day 1 email: "Aura remembered 3 things about you. See them."
Day 3 email: "Turn conversations into action? Aura can extract tasks."
Day 7 email: "You've built context. Try pipeline — first run free."
Day 14: If ran pipeline, "How did it go?" survey. Else gentle nudge.
Day 30: If active, upsell to Starter. Else "What's missing?" survey.

Use Resend or Postmark. Templates in /email/templates/.

3. Activation metrics (PostHog or Plausible):
- signup_complete
- first_message_sent
- first_memory_created
- first_action_extracted
- first_pipeline_started
- first_bundle_downloaded
- paid_plan_activated
- d7_retained, d30_retained

Dashboard at /admin/metrics shows funnel.

4. Unlock mechanics (features appear as memory grows):
- 5 memories: Daily Plan unlocks
- 10 memories: Action Extraction unlocks
- 20 memories: Pipeline Mode unlocks (first run free)
- 50 memories: Cross-run learning unlocks

Each unlock = in-app celebration + email. The product gets better as relationship deepens. This is the retention machine.

5. Free tier limits (matching pillars):
- Personal Companion unlimited
- 1 Virtual Company run/month (phases A-C only, max 3 artifacts)
- 100 memories total
- Single-user (no org)

Starter ($49/mo):
- Everything in Free
- 10 pipelines/month, all phases, unlimited artifacts
- Unlimited memories
- Build loop (live previews)
- 3 team members

Pro ($149/mo):
- Everything in Starter
- Unlimited pipelines
- 10 team members
- Frontier tier priority
- Audit logs + compliance exports

Enterprise: custom, SSO, RLS, SOC2 path.

VERIFICATION:
- New signup completes screens 1-4 in <5 min
- First message sent within 5 min of signup (measured)
- Unlock events fire at correct memory counts
- Email sequence triggers on cadence
- Activation dashboard shows funnel at each step
Commit: git commit -m "S3: relationship arc onboarding, unlock mechanics"

PROMPT S4 — Landing Page + Docs + Public Gallery
Purpose: Marketing surface. SEO, conversion, social proof.
Model: Sonnet 4.6 · Time: ~3-4 hours
Paste into Claude Code:
Execute Prompt S4 — Landing, docs, gallery.

CONTEXT: Marketing surface. Per docs/PRODUCT_IDENTITY.md: calm, confidence-first, stakeholder-grade.

WHAT TO BUILD:

1. /landing (or aura.app root):
- Hero: "What Aura Is" sentence + demo video
- Three wedge-specific sections (solo founders primary; agencies, enterprise teasers)
- The diagram showing three pillars
- Testimonials (start with "founding users" if no testimonials yet)
- Pricing (Free / Starter / Pro / Enterprise)
- Hero CTA: "Start talking to Aura" (goes to Personal Companion first, NOT pipeline)

2. /docs:
- "How Aura works" (three-pillar explainer)
- Each phase of pipeline explained
- Sample artifacts (actual PRDs, ADRs, threat models from real runs)
- API docs
- Brand: calm, no emojis, no hype

3. /gallery:
- Public pipeline runs (opt-in)
- Redact sensitive text
- Show artifacts + confidence ratings + cost/duration
- Social proof: "450 pipelines run, avg bundle size 11 docs, avg quality score 0.87"

4. /blog with launch posts:
- "Why we built Aura" (personal story)
- "Anatomy of a truth-first PRD" (product showcase)
- "Governance as a service" (category creation)

5. SEO:
- Proper meta tags
- OG images (one per page)
- Sitemap
- Schema.org markup

6. Design principles (per PRODUCT_IDENTITY):
- Calm over flashy
- Confidence-first (confidence ratings visible in demos)
- No emojis in UI
- Dark theme by default

VERIFICATION:
- Lighthouse >90 on all pages (performance, accessibility, SEO)
- 3 public gallery runs live
- Blog has 3 posts
- Landing page converts >2% visitor-to-signup (measure with analytics)
Commit: git commit -m "S4: landing page, docs, public gallery, launch blog"
SAAS CHECKPOINT: After S4:

Private beta: invite your 10 demo users
Run 2 weeks private beta, collect feedback, fix critical issues
Public beta: open signups, no marketing push yet
Run 2-4 weeks public beta, iterate
Paid launch: marketing push, Product Hunt, X threads, blog distribution


5. Post-Launch Immediate Priorities (not prompts, just awareness)
After S4 ships, in order:

First 100 users. Focus on quality of experience, not quantity. Hand-walk each through onboarding if needed.
Fix the 3 weakest agent prompts. Your evals (F4) tell you which. Typically CTO, QA Lead, and one other.
Observability dashboard (/admin/runs). You'll need this to debug user runs at scale.
Security posture. SOC2 Type I path if enterprise customers start asking. Audit log exports.
Retention crisis response. If D30 retention is <15%, pause growth and fix the activation loop. More users won't save a leaky bucket.


6. What's NOT in v1 (on purpose)

Mobile pipeline UI (web-first for pipeline)
40 agents (12 is enough)
Phases F (Release) and G (GTM) (A-E only for v1)
Three delivery options (single "balanced" option only)
Multi-language support (English only)
Self-hosted / on-prem (pure SaaS)
Agent marketplace (single source of truth)
Code in arbitrary languages (React/TS web + React Native only)

Every "NO" here protects a "YES" above. Hold the line.

7. The One Sentence Again
Aura is the AI companion that knows you, tells you the truth, and can spin up a virtual company to ship what you're dreaming about.
When a prompt is ambiguous, when a feature is tempting but scope-creeping, when you're tired and considering a shortcut — come back to this sentence. Every decision traces to it.

8. Your Next Action Right Now
If you haven't run P0 yet: paste the P0 prompt into Claude Code. That's your next 45 minutes.
If P0 is done: commit it, rest, and come back tomorrow for F1.
Good luck. You have the plan. Execute.