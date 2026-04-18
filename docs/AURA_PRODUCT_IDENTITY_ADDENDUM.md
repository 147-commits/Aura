AURA — Product Identity and Three-Pillar Integration
Addendum to AURA_SAAS_PROMPTS_V2.md
Purpose: Ensure the Personal Companion, Virtual Company Engine, and Truth-First Engine are built as ONE coherent product, not three bolted-together pieces.

1. The Correction
In the SaaS prompts document, I under-weighted two things you care about deeply:

The Personal Companion layer (Stage 1–3 of your codebase — the truth-first chat, memory, tasks, daily plans) as an equal citizen to the Virtual Company Engine.
The Truth-First Engine as the shared DNA that governs BOTH layers — not just the chat layer.

The SaaS plan correctly told you to pick a wedge (solo technical founders), but it framed the product as "AI that builds apps with governance docs." That's the value proposition. It's not the product identity.
The product identity is: Aura is the AI companion that knows you, tells you the truth, and can spin up a virtual company to ship what you're dreaming about.
Every prompt from here forward should be evaluated against that sentence.

2. The Three Pillars — What Each One Really Is
Pillar 1: The Truth-First Engine (the DNA)
This is not a feature. It's the operating principle that governs everything.
What lives in the Truth-First Engine:

Intent matching (answer the actual question, not the adjacent one)
Confidence ratings on every output (High/Medium/Low + reason)
Answer shape matching (A–H formats)
Anti-blabbing rules (concise by default, expand on request)
Anti-hallucination (refuse when uncertain, cite when grounded)
Privacy controls (per-message is_private, remember_flag, AES-256-GCM at rest)
Stress detection → calm triage (simplify when user is overwhelmed)

In your codebase today, this lives in server/truth-engine.ts as AURA_CORE. It governs the chat layer.
What must change: The Truth-First Engine must govern the Virtual Company Engine too.

Every agent output gets a confidence rating (High/Medium/Low)
The orchestrator records confidence in routing decisions ("I activated CTO and Architect with High confidence because the request mentions system design; CISO with Medium because the auth/PII signal was weak")
Gate evaluations include confidence ("G1 passed — High confidence: all 4 rules validated cleanly" vs "G1 passed — Medium confidence: acceptance criterion #3 is borderline")
Artifacts carry over the answer-shape discipline (concise executive summaries, not 12-page walls of text)

This is the single biggest differentiation from every multi-agent framework on the market. MetaGPT, ChatDev, CrewAI — none of them surface confidence. Aura does, at every level.
Pillar 2: The Personal Companion (the daily habit)
This is Stage 1–3 of your codebase — and it's genuinely shippable on its own.
What the Personal Companion does:

Chat that matches the user's intent (not generic LLM blabber)
Remembers preferences, goals, projects, constraints (with per-memory trust controls)
Extracts actions from conversation automatically (tasks, projects, decisions)
Daily plan generation from context
File attachments with understanding (PDFs, DOCX, images, CSV)
Calm triage when the user is stressed
Wrap-up cards after extended conversations

Why it matters for the product:

Retention. Users open Aura daily because it's their thinking partner, not weekly because they have a project to build.
Memory compound interest. The longer a user talks to Aura, the more context Aura has. Month 3 Aura is radically more useful than Day 1 Aura. This is a structural moat.
Natural escalation path. Casual chat → "actually, can you build this for me?" → Virtual Company activation. No context switch. No new app. Same companion, higher intensity.

What must change:

The memory system must flow INTO the Virtual Company (your past memories inform agent prompts)
The Virtual Company must flow BACK into memory (what you built becomes part of what Aura knows about you)
The onboarding must lead with companion, not pipeline

Pillar 3: The Virtual Company Engine (the activation moment)
This is what users pay for. But it's not the whole product — it's the intensity spike.
What the Virtual Company does:

Multi-agent pipeline (12 agents across 5 phases)
Structured artifacts (PRD, ADRs, threat model, test plan, etc.)
Quality gates with evaluation
Build loop with preview deployment
Governance bundle (Markdown + DOCX + JSON)

Why it matters for the business:

The paywall lives here. Free tier: companion + 1 small pipeline/mo. Paid tier: unlimited.
This is the "I need to ship something real" moment. High value, high willingness to pay.
This is what competitors don't have (Claude Code doesn't produce PRDs; v0 doesn't produce architecture docs; Notion AI doesn't produce apps).

What must change from the SaaS plan:

The Virtual Company must feel like an escalation of the Personal Companion, not a separate app
The user's existing memories must seed the pipeline ("CEO agent, use the user's past memory that they're a B2B SaaS founder targeting SMBs")
Artifacts produced by pipelines become searchable, re-usable across future runs


3. How the Pillars Reinforce Each Other
                     TRUTH-FIRST ENGINE
                     ─────────────────
            governs HOW both layers behave
                          │
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
       PERSONAL COMPANION      VIRTUAL COMPANY
              │                       │
              │  memory feeds context │
              ├──────────────────────►│
              │                       │
              │  runs create memories │
              │◄──────────────────────┤
              │                       │
              ▼                       ▼
            TRUST                   VALUE
       (retention, daily         (activation,
        habit, moat)              paywall)
The compounding effect:

Week 1 user: chats with Aura, builds 10 memories.
Week 4 user: 50 memories, has run 1 small pipeline. The pipeline used those memories as context, so the output felt personalized.
Week 12 user: 200 memories, 5 pipeline runs, has a bundle of personal artifacts. Aura "knows" their voice, their product, their constraints. Output quality is dramatically higher than a cold user starting on Cursor.

This is what "compounding companion" means as a moat. You cannot replicate this by firing up Claude Code fresh.

4. New Prompts to Integrate the Three Pillars
These are additions to AURA_SAAS_PROMPTS_V2.md, slotted into the sequence as follows:
P0 (before F1): Product Identity Spec
F1-F5: Foundation (as before)
F6 (new, after F5): Truth-First Engine Extension to Pipeline
C1-C5: Core VCE (as before)
C6 (new, after C5): Memory-Aware Pipeline + Bidirectional Sync
B1-B2: Build (as before)
S1-S2: Multi-tenancy + Billing (as before)
S3 (revised): Relationship Arc Onboarding
S4: Landing (as before, with companion-first narrative)
Three new prompts, one revision.

PROMPT P0 — Product Identity Specification (do this BEFORE F1)
CONTEXT: Before any code changes, we lock down the product identity so every subsequent decision traces back to it. This prompt produces ONE artifact: a docs/PRODUCT_IDENTITY.md file that serves as the north star.

WHAT TO BUILD:

Create docs/PRODUCT_IDENTITY.md with these sections:

1. "What Aura Is" — single sentence product definition.
   Current draft: "Aura is the AI companion that knows you, tells you the truth, and can spin up a virtual company to ship what you're dreaming about."
   
2. "The Three Pillars"
   - Truth-First Engine: operating principle, not feature
   - Personal Companion: daily habit, retention engine
   - Virtual Company Engine: activation moment, paywall
   (Use the definitions from this document — copy them in.)

3. "Non-Negotiables"
   - Every output has a confidence rating
   - User data is encrypted at rest; user controls memory
   - Aura refuses to hallucinate — it says "I don't know" or "I need to look this up"
   - No sycophancy, no filler, no "Great question!"
   - The Personal Companion layer is always free
   - The Virtual Company requires a paid plan (except 1 small run/month)

4. "Anti-Identity" — what Aura is NOT
   - Not Cursor (not IDE-based, not code-first)
   - Not v0/Bolt (not vibes-first, we show the reasoning)
   - Not ChatGPT (we remember, we confidence-rate, we deliver)
   - Not a chatbot (we have opinions and produce artifacts)
   - Not a productivity tracker (we are a thinking partner who can also execute)

5. "Wedge Customer"
   - Primary: Solo technical founders (from SaaS plan Wedge 1)
   - Pain: "I have 17 ideas and zero validated packages I can show investors"
   - Job: "From idea → investable MVP package in a weekend"
   - Willingness to pay: $49/mo for unlimited pipelines; $199 for a weekend MVP sprint

6. "Design Principles"
   - Calm over flashy
   - Confidence over assertion
   - Memory over context windows
   - Governance over vibes
   - Mobile for companion, web for pipeline

7. "Success Metrics"
   - D1 retention >40% (companion habit forms)
   - D30 retention >20% (weekly user)
   - Time-to-first-run < 24h post-signup
   - First bundle downloaded < 48h post-signup
   - Free→paid conversion >5% within 60 days

ALSO UPDATE:
- replit.md — replace the old Stage 3 header with a new "Three-Pillar Architecture" section pointing to docs/PRODUCT_IDENTITY.md as the canonical reference
- README.md — create if missing, anchored on the "What Aura Is" sentence

VERIFICATION:
- docs/PRODUCT_IDENTITY.md exists with all sections
- Every anti-identity item is genuinely actionable (a developer reading the doc would know what NOT to build)
- Success metrics have numeric targets
- File is committed to git

This document will be referenced in every future prompt. When Claude Code asks "should I add X feature?", you check if X serves the identity or violates the anti-identity.

PROMPT F6 — Truth-First Engine Extension to Pipeline (after F5)
CONTEXT: The Truth-First Engine currently governs only the chat layer via AURA_CORE in server/truth-engine.ts. It must govern the Virtual Company Engine too — every agent output, every orchestrator decision, every gate evaluation carries confidence and reasoning.

EXISTING FILES TO READ:
- server/truth-engine.ts (all of it — understand AURA_CORE, parseConfidence, answer shapes)
- shared/agent-schema.ts (from F3)
- server/eval/rubric-schema.ts (from F4)

WHAT TO BUILD:

1. Extract truth-first principles into a reusable module.
Create server/truth-first/principles.ts:

export const TRUTH_FIRST_PRINCIPLES = {
  confidence: `Every response ends with "Confidence: High|Medium|Low (reason)".
    High: established consensus in well-documented domains, or direct observation.
    Medium: reasoning from partial information or frameworks.
    Low: prediction, speculation, or information likely to be stale.`,
  
  intentMatching: `Before responding, identify what the user/system is actually asking for.
    Do not answer adjacent questions. Do not lecture when asked to summarize.`,
  
  antiHallucination: `When uncertain, say so. Cite sources when grounded.
    Refuse to invent citations, statistics, or capabilities.
    If information is likely stale, note the cutoff.`,
  
  antiBlabbing: `Answer first, context second, caveats third.
    Match response length to question complexity. Simple question = 2-5 sentences.
    Never open with filler ("Great question", "Certainly").`,
  
  escalationHonesty: `When out of depth, escalate rather than guess.
    Agents escalate to leads. Leads escalate to executives. Executives escalate to human.`,
};

export function buildTruthFirstPreamble(context: "chat" | "agent" | "orchestrator" | "evaluator" | "gate"): string;
export function extractConfidence(content: string): { confidence: "High"|"Medium"|"Low"; reason: string; cleanContent: string };

2. Update every pipeline agent's systemPrompt (from C1) to embed truth-first principles:
Every agent prompt must now start with:

"You are the [Role]. You operate under Aura's Truth-First Engine:
- Every artifact you produce includes a confidence rating.
- If any required input is missing or ambiguous, produce a 'clarification-needed' artifact instead of guessing.
- When citing frameworks or best practices, name them specifically.
- Never invent statistics, benchmarks, or case studies.
- If your output would be padded to meet a length target, produce a shorter output instead.

[Role-specific prompt follows]"

Add a helper in server/agents/prompt-builder.ts that prepends this preamble automatically. Modify every agent registration to use the builder.

3. Update artifact schemas (from C3) — every artifact now includes a confidence field:

// Addition to every artifact Zod schema:
confidence: z.object({
  level: z.enum(["High", "Medium", "Low"]),
  reason: z.string().min(10),
  uncertainties: z.array(z.string()).optional(),  // list of things the agent is unsure about
})

4. Update orchestrator (from C3) — log confidence at every decision:

In pipeline-engine.ts, after each agent invocation, log to agent_decisions:
{
  question: "Which agents to activate for phase [X]?",
  decision: "Activated [agent list]",
  reasoning: "...",
  confidence: "High|Medium|Low",
  reversible: true
}

5. Update gate-engine.ts (from C2) — gates now return confidence:

GateResult now includes:
{
  passed: boolean,
  confidence: "High" | "Medium" | "Low",
  confidenceReason: string,
  checks: [...],
}

A gate can PASS with Low confidence (edge case, borderline artifact) — orchestrator surfaces this to the user rather than silently proceeding.

6. Update evaluator (from F4) — evaluator outputs now include confidence:

EvalResult now includes:
{
  overallScore: 0-1,
  confidence: "High" | "Medium" | "Low",  // how confident the evaluator is in its own scoring
  criterionScores: [...],
}

If evaluator confidence is Low, the orchestrator escalates to human review rather than auto-gating.

7. Update the Pipeline UI (from C5) — visible confidence badges:

Every artifact card shows a confidence badge (green/amber/red).
Every gate result shows a confidence indicator.
Clicking a badge reveals the reason and any listed uncertainties.

8. Tests:
- tests/truth-first-pipeline.test.ts
  - Every agent output parses with valid confidence
  - Artifacts without confidence fail schema validation
  - Gate results include confidence
  - Low-confidence gates trigger human-review state

VERIFICATION:
- npm test passes
- Run a full pipeline → every artifact has a confidence rating visible in the UI
- Start a minimal pipeline with a vague request ("build something cool") → expect Medium/Low confidence throughout
- Start a well-defined pipeline ("build a markdown-to-HTML converter CLI") → expect High confidence for most artifacts

ROLLBACK: git reset --hard HEAD~1.

WHY THIS MATTERS: This prompt is what lets Aura honestly tell users "I'm less confident about the GTM brief than the PRD because your request didn't specify the target market." That honesty is the product. Every multi-agent tool produces artifacts; only Aura admits when it's guessing.

PROMPT C6 — Memory-Aware Pipeline + Bidirectional Sync (after C5)
CONTEXT: The Personal Companion has a rich memory system (preferences, goals, projects, constraints — encrypted, user-controlled). The Virtual Company Engine currently ignores it. This is a massive missed opportunity. Memories should seed pipelines, and pipeline runs should generate memories.

EXISTING FILES TO READ:
- server/memory-engine.ts
- server/memory-consolidator.ts
- All pipeline files created in C1-C5

WHAT TO BUILD:

1. Memory → Pipeline (user context flows into agent prompts):

Create server/orchestrator/context-builder.ts:

export async function buildRunContext(userId: string, orgId: string, userRequest: string): Promise<RunContext>

RunContext includes:
- Relevant memories (filtered by embedding similarity to userRequest, top 5-10)
- User's recent conversation history (last 20 messages from this conversation)
- Past pipeline runs from this org (summary-level)
- User's preferences relevant to the build (e.g., "prefers TypeScript", "building B2B SaaS")

Pass RunContext into every agent invocation. Agents get a "User Context" section in their system prompt:

## User Context
- Recent preferences: {joined list}
- Active projects: {names and status}
- Constraints: {budget, timeline, tech stack}
- Past builds: {titles + outcomes from past pipeline runs}

Agents now produce personalized output. CEO's Project Charter mentions the user's actual background. Architect picks TypeScript because they prefer it. CMO tailors positioning to their target market from memory.

2. Pipeline → Memory (runs generate memories):

After a pipeline completes, extract memory-worthy facts:
- Decisions made ("User chose PostgreSQL over MongoDB for their auth system")
- New constraints discovered ("User has 3-month runway — affects delivery option defaults")
- Patterns in requests ("3rd budget tracker this month → user is in fintech space")

Create server/orchestrator/memory-extractor.ts that runs post-pipeline and adds memories via memory-engine's existing APIs. Every auto-generated memory is tagged with source='pipeline' so users can see where it came from.

3. Memory UI integration:

In the existing Memory tab (/(tabs)/memory), add:
- Filter: "From chat" | "From builds" | "All"
- Memory detail now shows source context (link to conversation or pipeline run)
- Users can still delete any memory; pipeline memories are not special

4. Pipeline UI memory surface (on web):

On /pipeline/new (from C5), show a "What Aura knows about you" card:
- Relevant memories that will seed this pipeline
- User can deselect any memory (opt out of it influencing this specific run)
- Transparent about what context is being used

This is a trust feature — users see exactly what informs their build.

5. Cross-run learning:

Past pipeline artifacts become retrievable context for new pipelines.
If user ran a "SaaS landing page" pipeline 2 weeks ago, the GTM brief from that run is available as reference context for a new "SaaS landing page v2" pipeline.
Uses pgvector similarity search (already set up in C2).

6. Tests:
- tests/context-builder.test.ts: user with N memories gets relevant subset based on request
- tests/memory-extractor.test.ts: pipeline run produces K memories, all tagged correctly
- tests/cross-run-retrieval.test.ts: second run uses artifacts from first run as context

VERIFICATION:
- User creates 10 memories via chat → starts a pipeline → /pipeline/new shows "Aura knows you prefer X, Y, Z" card
- Complete the pipeline → Memory tab shows 3-5 new auto-generated memories tagged "From builds"
- Start a second similar pipeline → context-builder retrieves artifacts from the first run
- Delete a memory → it stops appearing in subsequent pipelines

ROLLBACK: git reset --hard HEAD~1.

WHY THIS MATTERS: This is the compound-interest moat. Week 12 Aura is dramatically more personalized than Day 1 Aura. Competitors cannot replicate this because they start cold on every session. This is the reason users stay.

PROMPT S3 (REVISED) — Relationship Arc Onboarding (replaces earlier S3)
CONTEXT: The original S3 focused on "5-minute path to first bundle." That's too transactional. The real onboarding arc should introduce users to the Personal Companion FIRST (which is free and builds habit), and let them discover the Virtual Company naturally once Aura has enough context to make it shine.

WHAT TO BUILD:

1. Onboarding flow (web, first signup):

Screen 1: "Meet Aura — your truth-first AI companion"
- Short video (30 sec): Aura responding to a vague question with confidence rating, then remembering it.
- CTA: "Start talking to Aura"

Screen 2: First conversation (guided)
- Pre-populated prompt: "What are you working on these days?"
- Aura responds, extracts memory, shows "I've remembered this" confirmation
- User sees the trust controls (remember/forget, private/shared)

Screen 3: "Aura can do more than chat"
- Show 3 things unlocked as memories grow: daily plans, action extraction, pipeline mode
- Explain pipeline mode in 1 paragraph with a "See an example" link to a public gallery run
- DON'T push user to run a pipeline yet

Screen 4: Setup
- Create org, pick plan (default Free)
- Optional: connect GitHub (for B1 preview deployments later)
- Set notifications preference

2. Day-by-day guided journey (first 14 days):

Day 0: Sign up, first conversation
Day 1 email: "Aura remembered 3 things about you. See them."
Day 3 email: "Ready to turn conversations into action? Aura can extract tasks from your chats."
Day 7 email: "You've built up context. Now try the pipeline — your first run is free."
Day 14 email: If they ran a pipeline, "How did it go?" survey. If not, gentle nudge with example.
Day 30 email: If active, upsell to Starter. If inactive, "What's missing?" survey.

Use Resend or Postmark for email. Templates in /email/templates/.

3. Activation metrics (tracked in PostHog or Plausible or custom):

- signup_complete
- first_message_sent
- first_memory_created
- first_action_extracted
- first_pipeline_started
- first_bundle_downloaded
- paid_plan_activated
- d7_retained, d30_retained

Dashboard at /admin/metrics shows funnel conversion rates.

4. Unlock mechanics:

Instead of features being available upfront, unlock as memory grows:
- 5 memories: Daily Plan generation unlocks
- 10 memories: Action extraction from conversation unlocks
- 20 memories: Pipeline Mode unlocks (first run free)
- 50 memories: Cross-run learning unlocks (pipelines reference past runs)

Each unlock is a moment: in-app celebration, email notification, reason to come back.

This is the relationship arc: the product gets better as the relationship deepens. Users notice this. It's the retention machine.

5. Free tier limits (aligned with pillars):

Free tier includes:
- Unlimited Personal Companion (chat, memory, tasks, daily plans)
- 1 Virtual Company pipeline run per month (small — Phases A-C only, max 3 artifacts)
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
- Priority model routing (frontier tier)
- Audit logs + compliance exports

Enterprise:
- Custom pricing
- SSO, RLS, SOC2 path
- Private deployments

VERIFICATION:
- New signup completes Screen 1-4 in <3 minutes
- First message sent within 5 minutes of signup (measured)
- Unlock events fire at correct memory counts
- Email sequence triggers on expected cadences
- Activation dashboard shows funnel at each step

ROLLBACK: git reset --hard HEAD~1.

5. Updated Sequencing
PHASE 0 (before starting Claude Code)
└── P0: Product Identity Spec                                        [1 hour — docs only]

PHASE 1: Foundation (weeks 1-2)
├── F1: Kill Replit lock-in                                          [2-3h]
├── F2: Modularize routes.ts                                         [2h]
├── F3: Unify skills → agents                                        [3-4h]
├── F4: Eval framework (rubrics)                                     [2-3h]
├── F5: Budget + concurrency + versioning                            [2h]
└── F6: Truth-First Engine extension ⭐ NEW                            [2-3h]

PHASE 2: Core Virtual Company (weeks 3-5)
├── C1: 12 agents with truth-first preambles                         [3-4h]
├── C2: DB + run tracer + artifact retrieval                         [2-3h]
├── C3: Orchestrator with confidence + budget                         [4-5h, split into 2 sessions]
├── C4: Markdown-first artifacts + DOCX + JSON                       [2-3h]
├── C5: Web Pipeline UI                                              [3-4h]
└── C6: Memory-aware pipeline + bidirectional sync ⭐ NEW              [3-4h]

PHASE 3: Build Loop (weeks 6-7)
├── B1: Plan-Patch-Test-Preview cycle                                [4-5h]
└── B2: Preview deployments (Snack + Vercel)                         [2-3h]

PHASE 4: SaaS (weeks 8-10)
├── S1: Multi-tenancy + auth                                         [3-4h]
├── S2: Stripe billing + usage caps                                  [2-3h]
├── S3: Relationship arc onboarding ⭐ REVISED                         [3-4h]
└── S4: Landing + docs + public gallery                              [3-4h]
Total: 20 prompts (was 17, now +P0, +F6, +C6).
Estimated time: ~50-60 hours of Claude Code execution + ~15-20 hours of your debugging time.
Estimated cost: $100-180 in Claude Code credits + $50-100 in API usage for testing pipelines.

6. The One Diagram That Explains Everything
When you write the landing page (S4), this is the hero image:
      ┌─────────────────────────────────────────────────┐
      │                                                 │
      │              Aura knows you.                    │
      │                                                 │
      │   ────────────────────────────────────          │
      │   You: "I'm thinking about a budget tracker     │
      │         for SaaS founders."                     │
      │                                                 │
      │   Aura: "Interesting. Based on what you've      │
      │   told me — you're pre-seed, targeting B2B      │
      │   operators, prefer TypeScript, 6-week runway   │
      │   — here's what I'd build:                      │
      │                                                 │
      │   [PRD]  [Architecture]  [Working Preview]      │
      │   [Test Plan]  [Threat Model]  [GTM Brief]      │
      │                                                 │
      │   Confidence: High on product, Medium on GTM    │
      │   (you didn't specify acquisition channels)."   │
      │                                                 │
      └─────────────────────────────────────────────────┘

          Truth-first. Memory-aware. Ships real products.
That's the product. Not a chat app. Not a pipeline engine. A single AI companion that demonstrates all three pillars in one interaction.

7. The Final Sanity Check
Before you start P0, answer these three questions out loud:

Why does the Personal Companion exist?
→ Because it's where users live daily. Without it, Aura is a $49-once tool, not a $49/month habit.
Why does the Truth-First Engine exist?
→ Because trust is the only durable moat vs Claude Code, Cursor, v0, ChatGPT. Trust is built by never lying.
Why does the Virtual Company Engine exist?
→ Because it's the activation moment that justifies payment. It's also the payoff of the memory compounding — better context makes better artifacts.

If all three answers feel solid, start P0. If any feels shaky, stop and re-scope before you type a line of code.

8. Closing
I shouldn't have pushed the SaaS plan without anchoring these three pillars first. The SaaS plan was a correct business structure around the wrong product framing. This document corrects the framing.
The technical work is the same. The orientation is different.
Build the companion. Build the engine. Run everything through the truth-first layer.
That's the product. That's what's worth building.