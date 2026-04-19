# Aura — Product Identity

> Canonical product spec. If this document conflicts with any other doc, this one wins.

---

## 1. What Aura Is

**Aura is the AI companion that knows you, tells you the truth, and can spin up a virtual company to ship what you're dreaming about.**

Three things, one product: a daily companion that remembers you, a truth-first engine that refuses to make things up, and a virtual company engine that turns an idea into an investable MVP package.

---

## 2. The Three Pillars

Aura is built on three pillars. Each pillar is load-bearing — removing any one breaks the product.

### Pillar 1 — Truth-First Engine (the operating principle)

Not a feature. The DNA.

The Truth-First Engine governs every surface in the product: chat responses, agent artifacts, pipeline gate results, daily plans, memory extraction. Everything.

Core guarantees:
- **Confidence ratings** (High / Medium / Low + reasoning) on every output
- **Intent matching** — Aura answers the question you asked, not an adjacent one
- **Anti-hallucination** — Aura says "I don't know" or "I need to look this up" rather than invent
- **Anti-sycophancy** — no filler, no flattery, no "great question"
- **Privacy-first** — user data encrypted at rest, user owns the memory

This is why Aura can be trusted with a founder's real company plan, not just a toy prompt.

### Pillar 2 — Personal Companion (the daily habit)

The always-free layer. The reason users come back every day.

- Chat with memory that compounds over time
- Encrypted, user-controlled memory (per-memory delete, private messages, forget-everything)
- Tasks, projects, daily plans extracted from natural conversation
- One input, many outcomes — users type naturally; Aura detects tasks, projects, decisions

The companion is the relationship. Every conversation makes the next one better. This is the compound-interest layer — after 30 days of use, Aura knows the user well enough that the Virtual Company Engine is dramatically more useful than it would be for a stranger.

**Always free.** No paywall on the habit layer. Ever.

### Pillar 3 — Virtual Company Engine (the activation moment)

The paid layer. The reason someone opens their wallet.

A multi-agent pipeline — **12 agents across 5 phases** (Discovery → Design → Planning → Implementation → Verification) — that produces:

- A working app preview
- A governance bundle: PRD, ADRs, test plan, threat model, deployment runbook, GTM brief

The pipeline runs on top of the user's accumulated companion memory. The agents know the founder's constraints, preferences, past decisions, and tone — because the companion pillar fed them.

This is where the paywall lives.

### Why all three must coexist

- **Truth-First without the Companion** = a better ChatGPT. No relationship, no compounding value.
- **Companion without Truth-First** = another chatbot that lies prettily. No trust → no stakes high enough to pay.
- **Companion + Truth-First without the Virtual Company Engine** = a thoughtful journal. No activation moment, no willingness to pay.
- **Virtual Company Engine without the Companion** = v0 / Bolt / Lovable. Cold-start every run, no memory, no relationship — a commodity.
- **Virtual Company Engine without Truth-First** = vibes-code. Looks great in a demo, falls apart when an investor asks a question.

All three. Together. That's Aura.

---

## 3. Non-Negotiables

These are the six rules that govern what ships and what doesn't. A feature that violates any of them does not ship — regardless of how clever or commercially attractive it is.

1. **Every output carries a confidence rating.** Chat responses, agent artifacts, gate results — all of them. High / Medium / Low, with a stated reason. No silent assertions.
2. **User data is encrypted at rest (AES-256-GCM). The user owns their memory.** Per-memory delete, private messages that never touch the DB, a forget-everything control. The user is the administrator of their own data.
3. **Aura refuses to hallucinate.** When Aura doesn't know something, it says so — "I don't know" or "I need to look this up." When it grounds a claim, it cites. Making things up is a bug, not a style.
4. **No sycophancy. No filler.** No "Great question!" No "Certainly!" No "I'd be happy to help!" No emoji garnish. Aura answers the question and stops talking.
5. **The Personal Companion layer is always free.** The habit is not paywalled. Chat, memory, tasks, daily plans — all free, forever, for everyone.
6. **The Virtual Company Engine requires a paid plan** — with one exception: one small run per month on the free tier, limited to Discovery + Design phases and capped at 3 artifacts. Enough to taste the product, not enough to extract it.

---

## 4. Anti-Identity — What Aura Is NOT

Read each of these as a build-time instruction. If a proposed feature would push Aura toward any of these identities, do not build it.

1. **Not Cursor, not Claude Code.** Aura is not an IDE plugin, not a code-first terminal tool. Do not build keybindings, file-tree sidebars, diff views, or "agents inside your editor." Aura ships governance and code together, as a bundle, not as inline suggestions in a developer's editor.
2. **Not v0, not Bolt, not Lovable.** Aura is not vibes-first "type a prompt, get a pretty app." Do not hide the reasoning. Do not ship app previews without the PRD and ADRs that justify them. If the output doesn't include the thinking, it's incomplete.
3. **Not ChatGPT.** Aura remembers (persistent, structured, encrypted memory), confidence-rates every output, and ships structured artifacts — not just prose. Do not build a bare chat box. Do not treat memory as "context that decays." Memory is a first-class product surface.
4. **Not a chatbot.** Aura has opinions, refuses when out of depth, and produces structured outputs (cards, briefs, bundles) alongside prose. Do not build features that reduce Aura to "reply to user text with more user text." The artifact is the product.
5. **Not a productivity tracker.** Aura is not Todoist, Notion, or Motion with AI bolted on. Do not build a task manager that happens to have a chatbot. Aura is a thinking partner that can also execute — execution is downstream of thinking, not the main event.

---

## 5. Wedge Customer

We pick one wedge and win it. Everything else is secondary.

- **Primary wedge:** Solo technical founders building pre-seed startups.
- **Pain:** "I have 17 ideas and zero validated packages I can show investors."
- **Job-to-be-done:** "Go from idea to investable MVP package in a weekend."
- **Deliverable that justifies payment:** A working app preview + PRD + pitch-ready architecture + basic threat model + GTM brief, all produced in under 48 hours from signup.
- **Pricing:**
  - **$49/month** — unlimited Virtual Company Engine pipelines
  - **$199 one-shot** — a single weekend sprint package (no subscription, keep the bundle)
- **Secondary wedges (not v1, not now):**
  - SMB agencies using Aura as a client-deliverable engine
  - Enterprise innovation teams using Aura to scope internal pilots

The wedge is narrow on purpose. Every design choice, every onboarding decision, every model-routing trade-off serves the solo technical founder first. When we have retention and conversion in that wedge, we expand.

---

## 6. Design Principles

Five principles that govern UX, copy, and product surface decisions.

1. **Calm over flashy.** No dopamine slot-machine UX. No confetti. No emojis. No exclamation marks in the UI. The product should feel like a trusted advisor, not a game.
2. **Confidence over assertion.** Every claim carries an honest confidence rating. The product is willing to say "low confidence" out loud — that's a feature, not an apology.
3. **Memory over context windows.** Relationships with users compound. Each session makes the next session better. Design every interaction assuming the user will be back tomorrow, and the day after.
4. **Governance over vibes.** We produce stakeholder-grade artifacts, not just demos. Every output from the Virtual Company Engine should survive being handed to an investor, a co-founder, or a future engineer without embarrassment.
5. **Mobile for companion, web for pipeline.** The habit layer lives in the pocket (short, daily, conversational). The activation layer lives on a laptop (longer sessions, multi-document review, bundle download). Respect the ergonomics of each.

---

## 7. Success Metrics

Numeric and measurable. No vanity metrics, no "engagement." These are the seven numbers that tell us whether Aura is working.

| Metric | Target | Definition |
|---|---|---|
| D1 retention | **>40%** | User returns the day after signup |
| D30 retention | **>20%** | User is active 30 days post-signup |
| Time-to-first-run | **<24h** | Time from signup to first companion conversation |
| Time-to-first-bundle | **<48h** | Time from signup to first Virtual Company Engine bundle downloaded |
| Free-to-paid conversion | **>5%** | Free users who upgrade within 60 days |
| Pipeline gate pass rate | **>80%** | Virtual Company Engine runs that pass quality gates on first attempt |
| Artifact usefulness | **>4/5** | Median user-reported usefulness on post-run survey |

If a feature doesn't move one of these seven numbers, it is not a priority.
