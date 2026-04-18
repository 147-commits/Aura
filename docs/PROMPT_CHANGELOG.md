# Prompt Changelog

Track all changes to AURA_CORE and skill prompts. Never change prompts without re-running the eval suite.

## Format
```
## [Date] — [Change Description]
**File:** server/truth-engine.ts (or server/skills/xxx.ts)
**What changed:** Brief description
**Why:** What eval failure or user feedback prompted this
**Eval results before:** X% overall
**Eval results after:** Y% overall
**Verdict:** Keep / Revert
```

---

## 2026-04-04 — Initial System

**Files:** All server/skills/*.ts, server/truth-engine.ts
**What:** Full skill system with 18 domain skills, AURA_CORE v3, confidence calibration
**Eval results:** Baseline — 100 eval cases defined, structural validation passing
**Verdict:** Ship as baseline

## 2026-04-04 — Craft Detection Added

**File:** server/truth-engine.ts
**What:** Added CRAFT_DETECTION section to AURA_CORE for auto-generating documents/presentations
**Why:** Users need artifacts without explicitly requesting "export"
**Verdict:** Keep — no regression in confidence tests

## 2026-04-04 — RAG Context Injection

**File:** server/research-engine.ts
**What:** RAG results injected into research queries before web search
**Why:** Grounding responses in local knowledge base
**Verdict:** Keep — improves citation quality

---

## How to Use This Log

1. Before changing any prompt: run `npm test` and `npx tsx scripts/run-eval.ts`
2. Record the "before" scores above
3. Make the change
4. Re-run both test suites
5. Record the "after" scores
6. If regression > 2%: revert and investigate
7. If improvement or neutral: keep and document
