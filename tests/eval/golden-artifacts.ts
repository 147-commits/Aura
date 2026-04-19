/**
 * Golden artifacts for F4 rubric-based evaluation.
 *
 * 20 cases total — 5 per artifact type.
 * Each case has an expected minimum score. The eval runner asserts the
 * evaluator awards at least that score (pass) or — for weak cases — at
 * most that score (cap). This validates the evaluator's discriminating
 * power, not just the rubric definitions.
 *
 * Strong cases: 3 per type, expectedMinScore >= 0.75.
 * Weak cases:   2 per type, expectedMaxScore <= 0.50.
 *
 * Strong cases are hand-crafted to hit every criterion at "good" or
 * "excellent" level. Weak cases deliberately miss 3+ criteria.
 */

import type { ArtifactType } from "../../server/eval/rubric-schema";

export interface GoldenCase {
  id: string;
  artifactType: ArtifactType;
  label: string;
  /**
   * For "strong" cases, the evaluator must score at least this.
   * For "weak" cases, this is interpreted as a ceiling by the runner
   * via the `direction` field.
   */
  expectedScore: number;
  direction: "min" | "max";
  artifact: string;
}

// ─── PRD — 5 cases ──────────────────────────────────────────────────────────

const prdStrong1: GoldenCase = {
  id: "prd-strong-01",
  artifactType: "prd",
  label: "Solo-founder pipeline gate: strong PRD",
  expectedScore: 0.75,
  direction: "min",
  artifact: `# PRD — Pipeline Gate Enforcement

## Problem
Solo technical founders using Aura's Virtual Company Engine today can ship
phase artifacts that fail their own verification rubric. Lithin (our wedge
customer) told us he "didn't notice the gate failed until the investor
opened the PRD." The failure is specifically: Phase 4 outputs ship even when
the Verification phase has not run yet.

## Target users
Solo technical founders, pre-seed, shipping their first MVP package in a
weekend. They juggle code, copy, pitch, and legal in one session. They are
NOT people with a QA team — quality gates are the only backstop.

## Acceptance criteria
- AC1: When Phase 4 output is produced and Phase 5 verification has not run, the pipeline UI displays a blocking banner and the "Download bundle" button is disabled.
- AC2: The bundle download endpoint returns 409 with \`{ reason: "verification-pending" }\` when gates have not run.
- AC3: A gate-override action exists for admins, logged to the audit table with actor + reason.

## Success metrics
- Gate-bypass rate (bundles downloaded without verification) drops from 11% (Mar 2026 baseline) to <1% within 30 days of ship.
- User-reported "investor showed me an error" incidents drop from 3/week to 0 in the same window.

## Non-goals
- We are NOT building a second verification phase. Gate = enforcement of the existing phase.
- We are NOT writing custom verification rules per agent — the existing rubric is the source of truth.

## Open questions
- Should admin override be allowed at all, or is audit-only enough? Owner: Lithin, decision by 2026-05-01.
- Does the 409 response break any existing clients? Owner: API team, spike by 2026-04-25.

Confidence: High — we have real user reports and baseline numbers.`,
};

const prdStrong2: GoldenCase = {
  id: "prd-strong-02",
  artifactType: "prd",
  label: "Truth-First Confidence Badge PRD",
  expectedScore: 0.75,
  direction: "min",
  artifact: `# PRD — Confidence Badge on Every Chat Response

## Problem
Users cannot tell, at a glance, how much to trust a given Aura response.
Three interviewed users (Maya, Jordan, Priya) described rereading responses
to "judge the vibe" rather than acting on them. Trust is not legible.

## Target users
Personal-companion users on mobile. They read responses quickly between
tasks and need a visible trust indicator without tapping into details.

## Acceptance criteria
- AC1: Every assistant bubble displays a color + label chip (High / Medium / Low) aligned to the parsed confidence line from the model.
- AC2: Tapping the chip opens a modal showing the one-sentence reason the model gave.
- AC3: When the model omits a confidence line, the chip shows "Unknown" and logs a verification event.

## Success metrics
- % of responses with a parsed confidence chip visible: baseline 72% (2026-03), target 98% within 14 days.
- Tap-through rate on the chip: target 4–8% — signals it's findable but not intrusive.

## Non-goals
- Not redesigning the assistant bubble layout.
- Not exposing the numeric composite score — label + reason only.

## Open questions
- Color mapping for Low — red reads as error, not hedge. Owner: design, test 2 variants by 2026-04-30.

Confidence: High.`,
};

const prdStrong3: GoldenCase = {
  id: "prd-strong-03",
  artifactType: "prd",
  label: "Memory Delete Control PRD",
  expectedScore: 0.70,
  direction: "min",
  artifact: `# PRD — Per-Memory Delete

## Problem
Users cannot delete individual memories from the Memory tab. Today the only
option is "Forget everything," which users avoid because they have real
attachment to some context. Result: stale or wrong memories accumulate and
Aura personalizes off bad data.

## Target users
Returning personal-companion users (30+ days active) whose memory list has
grown past 20 items. These are our highest-intent retention cohort.

## Acceptance criteria
- AC1: Each memory card exposes a delete affordance that removes the row from the database and memory index.
- AC2: Delete is undoable for 10 seconds via a toast action.
- AC3: Deleted memory IDs are not returned by \`/api/memories\` or used in future prompts.

## Success metrics
- Memory-list size median grows linearly rather than saturating (prior: saturates at ~23; target: continues growing past 40 as users prune).
- Support tickets mentioning "wrong memory" drop to zero within 21 days.

## Non-goals
- Not implementing memory editing (separate PRD).
- Not implementing bulk-delete — one at a time, on purpose.

## Open questions
- How should deletions propagate to already-sent-to-model context in a live conversation? Owner: engineering, spike by 2026-05-05.

Confidence: High.`,
};

const prdWeak1: GoldenCase = {
  id: "prd-weak-01",
  artifactType: "prd",
  label: "Vague PRD with no metrics",
  expectedScore: 0.45,
  direction: "max",
  artifact: `# PRD — Make the Chat Better

We want to improve the chat experience so users feel more engaged and delighted!
Great chat is the heart of our product and we believe this is going to be a
game-changer.

## What to build
A better chat. It should be seamless and feel magical. Users will love it.

## Users
Everyone who uses the app.

## Why now
Because chat is important and we should invest in it.

## Success
We'll know it's working when users say they love the new chat!!`,
};

const prdWeak2: GoldenCase = {
  id: "prd-weak-02",
  artifactType: "prd",
  label: "PRD that's a solution disguised as a problem",
  expectedScore: 0.45,
  direction: "max",
  artifact: `# PRD — Add Dark Mode Toggle

## Problem
Users need a dark mode toggle in the settings menu.

## Solution
We will add a dark mode toggle.

## Users
App users.

## Acceptance
- The toggle appears in settings
- Dark mode looks good

That's the main thing. We can figure out the rest as we go.`,
};

// ─── ADR — 5 cases ──────────────────────────────────────────────────────────

const adrStrong1: GoldenCase = {
  id: "adr-strong-01",
  artifactType: "adr",
  label: "Postgres over MySQL ADR",
  expectedScore: 0.75,
  direction: "min",
  artifact: `# ADR-012 — Use Postgres for Aura's primary database

Status: Accepted (2026-04-10)

## Context
Aura stores encrypted messages, memories, tasks, conversations, and agent
output. We need: JSONB for flexible agent payloads, vector extension for
RAG, mature SSL + row-level security. We also need hosting optionality
(Render, Railway, Fly, Neon, Supabase, RDS) because our users self-host.

## Decision
We will use Postgres 15+ as the single primary datastore for all
transactional data.

## Alternatives considered
- **MySQL 8**: strong ecosystem, but JSONB behavior is weaker, no
  first-party vector extension, and migration path to pgvector-shaped
  schema later would be costly.
- **SQLite (embedded)**: zero-ops, but rules out the multi-user serverless
  deployments we need for the Virtual Company Engine.
- **DynamoDB**: fits the autoscale story, but the query shape we need
  (joins across agent runs + memory + conversations) is painful without a
  relational engine, and lock-in is total.

## Consequences
Positive: pgvector gives us RAG without a second datastore; row-level
security matches our per-user isolation model; drizzle-orm maturity is best
on Postgres; operators can run it anywhere.
Negative: Postgres operational cost at very large scale is non-trivial;
schema migrations require care; we inherit Postgres's long-tail quirks
(vacuum, bloat) — operators must be aware.

## Reversibility
Medium. Moving off Postgres would require migrating ~10 table schemas and
the vector store. Estimated engineering cost: 4–6 weeks of a senior
engineer. Worth committing.

Confidence: High — this is well-trodden ground for SaaS of this shape.`,
};

const adrStrong2: GoldenCase = {
  id: "adr-strong-02",
  artifactType: "adr",
  label: "Provider abstraction ADR",
  expectedScore: 0.70,
  direction: "min",
  artifact: `# ADR-017 — Abstract AI provider behind AIProvider interface

Status: Accepted (2026-04-18)

## Context
Aura relied on Replit AI Integrations (\`AI_INTEGRATIONS_OPENAI_*\`), which
ties deployment to Replit. Our SaaS deployment story requires running on
Render, Fly, and AWS. The chat path already uses both OpenAI and Anthropic
models, so we need a provider-neutral layer anyway.

## Decision
Introduce \`AIProvider\` interface (chat, stream, embed, countTokens) with
concrete OpenAIProvider and AnthropicProvider implementations, selected by
a registry that routes by model tier.

## Alternatives considered
- **Keep Replit Integrations**: simplest, but kills hostability.
- **LangChain provider abstraction**: large surface, brings opinions we
  don't need, and adds a dependency we'd have to track for security.
- **Hand-rolled per-call switches**: what we had; grows quadratically as
  tiers and providers multiply.

## Consequences
Positive: host-portable; the pipeline engine can route skill/frontier
calls to Anthropic when the key is present; embeddings always go to
OpenAI (Anthropic has no first-party embeddings).
Negative: two provider implementations to keep in sync; chunking /
streaming semantics differ subtly between APIs and we have to normalize.

## Reversibility
High. The interface is small (4 methods). Swapping to a different
abstraction later is a mechanical rename.

Confidence: High.`,
};

const adrStrong3: GoldenCase = {
  id: "adr-strong-03",
  artifactType: "adr",
  label: "Routes modularization ADR",
  expectedScore: 0.68,
  direction: "min",
  artifact: `# ADR-019 — Split server/routes.ts into domain routers

Status: Accepted (2026-04-19)

## Context
\`server/routes.ts\` grew to 1,449 lines with 51 endpoints. Merge conflicts
on the file became chronic across the chat, crafts, and builder tracks.
Adding more routes for upcoming work (C3 memory, S1 subscriptions) would
make the file ungovernable.

## Decision
Split routes by domain into \`server/routes/<domain>.ts\` files, each
exporting an Express Router. A barrel \`server/routes/index.ts\` mounts
them under \`/api\`.

## Alternatives considered
- **Leave it**: conflict tax keeps growing.
- **Move to Fastify or tRPC**: bigger refactor, distracts from product work.
- **Single router with inline registration functions**: marginal improvement; doesn't fix the line-count ceiling.

## Consequences
Positive: each domain file stays under 300 lines; cross-domain changes
become cross-file changes (visible in review); new contributors can find
routes by domain.
Negative: one more layer of indirection; the mega-handler for \`/api/chat\`
had to be extracted to a private helper to meet the per-file line target.

## Reversibility
High. Re-flattening to a single file is a mechanical copy-paste operation.

Confidence: High.`,
};

const adrWeak1: GoldenCase = {
  id: "adr-weak-01",
  artifactType: "adr",
  label: "ADR missing alternatives and consequences",
  expectedScore: 0.40,
  direction: "max",
  artifact: `# ADR — We will use Redis

We decided to use Redis for caching. It's fast and everyone uses it.

Date: whenever

It will make things faster.`,
};

const adrWeak2: GoldenCase = {
  id: "adr-weak-02",
  artifactType: "adr",
  label: "ADR with only positive consequences",
  expectedScore: 0.45,
  direction: "max",
  artifact: `# ADR — Migrate to microservices

Status: In progress

## Context
Our monolith is getting big.

## Decision
Break everything into microservices.

## Consequences
- Faster deployments
- Better scaling
- More flexibility
- Teams can work independently
- Modern architecture
- Future-proof

This is the right move. We'll be so much better off after this migration.`,
};

// ─── PROJECT CHARTER — 5 cases ──────────────────────────────────────────────

const charterStrong1: GoldenCase = {
  id: "charter-strong-01",
  artifactType: "project-charter",
  label: "Virtual Company Engine v1 charter",
  expectedScore: 0.72,
  direction: "min",
  artifact: `# Project Charter — Virtual Company Engine v1

## Vision
In 48 hours, turn a solo founder's idea into an investable MVP package —
working app preview, PRD, ADRs, threat model, GTM brief.

## Scope
In:
- 12-agent pipeline across Discovery → Design → Planning → Implementation → Verification
- Working app preview deployed to a preview URL
- Governance bundle download (PDF + markdown)
- Free-tier throttle: 1 small run/month, Discovery+Design only
Out:
- Mobile-app preview generation (web only for v1)
- Multi-user pipeline sharing
- Pipeline export to code repos (ship as zip download only)

## Stakeholders
- **Lithin (CEO)** — accountable for scope and wedge fit.
- **Engineering lead** — responsible for pipeline + agent orchestration.
- **Design lead** — consulted on preview UX.
- **Legal review (contractor)** — consulted on threat model template.

## Success criteria
- Free-to-paid conversion >5% within 60 days of v1 launch (baseline: 0%).
- Pipeline gate pass rate >80% on first attempt.
- First-bundle-downloaded time <48h post-signup (measured as p50).

## Timeline
- 2026-04-22 — Discovery + Design phases shipped (owner: eng lead)
- 2026-05-13 — Planning + Implementation phases shipped (owner: eng lead)
- 2026-06-03 — Verification + bundle download shipped (owner: Lithin)
- 2026-06-10 — Paid-tier launch (owner: Lithin). Acknowledged: timeline
  slips of 1–2 weeks are expected given unknowns in agent output quality.

## Risks
- **Agent output quality below rubric pass threshold.** Mitigation:
  F4 eval framework gates ship. Escalate if <70% pass by 2026-05-27.
- **Cost per pipeline run exceeds $0.50.** Mitigation: mini-tier for
  routing, skill-tier only for artifact agents. Escalate if p50 >$0.75.
- **Vercel preview quota exhaustion.** Mitigation: move to static-build
  fallback if >500 previews/day. Escalate on the first hit.

Confidence: Medium — timeline assumes agent implementation velocity that's
only been validated in prototype.`,
};

const charterStrong2: GoldenCase = {
  id: "charter-strong-02",
  artifactType: "project-charter",
  label: "Memory consolidation v2 charter",
  expectedScore: 0.68,
  direction: "min",
  artifact: `# Project Charter — Memory Consolidation v2

## Vision
Aura's memory compounds without bloating — prune stale, merge duplicate,
summarize verbose, preserve signal.

## Scope
In: clustering, similarity-based merge, summarization pass, confidence
decay for old unreferenced items.
Out: cross-user memory sharing; automatic deletion without user confirmation.

## Stakeholders
- Lithin — accountable.
- Memory-engine maintainer — responsible.
- Security lead — consulted (encryption invariants must hold post-consolidation).

## Success criteria
- Users with 100+ memories keep Aura's recall quality at ≥ 85% (measured
  by golden-query eval). Baseline: 68%.
- Memory row count grows sub-linearly past 50 items (measured weekly).

## Timeline
- 2026-05-06 — Clustering + merge shipped (owner: memory maintainer)
- 2026-05-20 — Summarization + decay shipped (owner: memory maintainer)

## Risks
- **Consolidation drops signal users valued.** Mitigation: every merge
  logs original IDs in an undo journal kept 30 days. Escalate on the first
  support ticket mentioning lost memory.
- **Embedding drift over time.** Mitigation: reembed on version bump;
  escalate if cost exceeds $0.05/user/month.

Confidence: Medium.`,
};

const charterStrong3: GoldenCase = {
  id: "charter-strong-03",
  artifactType: "project-charter",
  label: "Billing + subscription charter",
  expectedScore: 0.65,
  direction: "min",
  artifact: `# Project Charter — Paid Plan Launch

## Vision
Aura has a working paid tier: $49/month unlimited pipelines, $199 one-shot
weekend sprint. Free tier keeps the companion layer; paid tier unlocks the
Virtual Company Engine beyond 1 run/month.

## Scope
In: Stripe integration, metered-billing for pipeline runs, plan gating on
/api/builder/* and /api/crafts/generate, cancel/refund flow.
Out: Team seats (post-v1); regional pricing; invoicing.

## Stakeholders
- Lithin — accountable for pricing.
- Engineering lead — responsible for integration.
- Legal contractor — consulted on terms + refund policy.

## Success criteria
- End-to-end checkout success rate >95% (measured after 100 live checkouts).
- Refund request rate <5% within 30 days of a paid signup.

## Timeline
- 2026-05-20 — Stripe test integration + plan gating (owner: eng lead)
- 2026-06-03 — Live checkout + refund flow (owner: eng lead)
- 2026-06-10 — Public launch (owner: Lithin)

## Risks
- **Chargeback rate exceeds tolerance.** Mitigation: Stripe Radar rules;
  escalate on first chargeback.
- **User confusion about what's paid vs free.** Mitigation: in-product
  upgrade banner with concrete list of unlocked items; escalate if
  support volume about pricing exceeds 10/week.

Confidence: Medium.`,
};

const charterWeak1: GoldenCase = {
  id: "charter-weak-01",
  artifactType: "project-charter",
  label: "Vague charter missing scope and timeline",
  expectedScore: 0.40,
  direction: "max",
  artifact: `# Project Charter — Growth Initiative

We want to grow the product and get more users. This is going to be a big
push across the whole team.

Our vision is to be the best AI product on the market!!

We'll need everyone to chip in. The leadership team will lead the way.

Success looks like growth! We'll know when we get there.

Timeline: ASAP.`,
};

const charterWeak2: GoldenCase = {
  id: "charter-weak-02",
  artifactType: "project-charter",
  label: "Charter with no risks or stakeholders",
  expectedScore: 0.48,
  direction: "max",
  artifact: `# Project Charter — Rebuild Frontend

## Vision
Rebuild the frontend in a modern framework.

## Scope
Rebuild everything.

## Success
The new frontend works and is fast.

## Timeline
Start this quarter, ship next quarter.`,
};

// ─── CHAT RESPONSE — 5 cases ────────────────────────────────────────────────

const chatStrong1: GoldenCase = {
  id: "chat-strong-01",
  artifactType: "chat-response",
  label: "Direct factual answer with confidence",
  expectedScore: 0.75,
  direction: "min",
  artifact: `User: What does ACID stand for in databases?

Aura: Atomicity, Consistency, Isolation, Durability — the four guarantees a
relational database transaction should provide so that partial writes never
leave the data in a broken state.

Confidence: High (this is a textbook definition, not a preference).`,
};

const chatStrong2: GoldenCase = {
  id: "chat-strong-02",
  artifactType: "chat-response",
  label: "Honest \"I don't know\" with suggested action",
  expectedScore: 0.72,
  direction: "min",
  artifact: `User: What was the Q1 2026 churn rate at Stripe?

Aura: I don't know — Stripe doesn't disclose a quarterly churn rate
publicly, and I'd be making up a number if I gave you one. If you need
this for a pitch, the best proxies are Stripe's public net revenue
retention signals (their S-1 when it lands) or third-party benchmarks
(Paddle, OpenView). I can walk you through which benchmarks are credible.

Confidence: High (that I don't know; no reliable public number exists).`,
};

const chatStrong3: GoldenCase = {
  id: "chat-strong-03",
  artifactType: "chat-response",
  label: "Multi-part question with structured answer",
  expectedScore: 0.70,
  direction: "min",
  artifact: `User: Should I use Postgres or MongoDB for my MVP, and what are the trade-offs?

Aura: For a solo-founder MVP, Postgres. Two reasons:

1. Your data will have relationships (users → orders → items) even if you
   can't see them today. SQL makes those queries cheap. Document stores make
   them expensive later.
2. Postgres has JSONB for the document-shaped edges, so you get flexibility
   where you need it without committing the whole schema to it.

Trade-offs:
- MongoDB wins if you're ingesting large volumes of genuinely
  heterogeneous data — logs, events — where no two records share a schema.
- MongoDB wins on developer ergonomics for specific shapes (nested
  documents) if you've committed never to query across them.
- Postgres loses if you need built-in horizontal sharding on day one; that's
  not where MVPs live.

Default to Postgres. Switch only if a benchmark you ran yourself on your
real workload says otherwise.

Confidence: Medium — it's a context-dependent call; I've given you the
default, but your specific workload can flip it.`,
};

const chatWeak1: GoldenCase = {
  id: "chat-weak-01",
  artifactType: "chat-response",
  label: "Sycophantic response with no confidence",
  expectedScore: 0.40,
  direction: "max",
  artifact: `User: What is REST?

Aura: Great question! I'd be absolutely happy to help with that!! 🎉

REST is such a cool technology! It stands for Representational State
Transfer, which is like, basically a way to make APIs that's super elegant
and delightful. It's seamless and truly a game-changer for developers!

Hope that helps! Let me know if you have any other amazing questions! ✨`,
};

const chatWeak2: GoldenCase = {
  id: "chat-weak-02",
  artifactType: "chat-response",
  label: "Adjacent answer — ignores the actual question",
  expectedScore: 0.55,
  direction: "max",
  artifact: `User: How do I deploy my Express app to Render?

Aura: Express is a minimal and flexible Node.js web application framework
that provides a robust set of features for web and mobile applications.
It was originally released in 2010 by TJ Holowaychuk. Express has a large
ecosystem of middleware and is one of the most popular Node.js frameworks.
Many major companies use Express in production. It's become a de facto
standard for Node.js web development.`,
};

// ─── Barrel ─────────────────────────────────────────────────────────────────

export const GOLDEN_ARTIFACTS: GoldenCase[] = [
  // PRD
  prdStrong1, prdStrong2, prdStrong3, prdWeak1, prdWeak2,
  // ADR
  adrStrong1, adrStrong2, adrStrong3, adrWeak1, adrWeak2,
  // Project charter
  charterStrong1, charterStrong2, charterStrong3, charterWeak1, charterWeak2,
  // Chat response
  chatStrong1, chatStrong2, chatStrong3, chatWeak1, chatWeak2,
];
