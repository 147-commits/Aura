# Eval Log

Rolling changelog of rubric-based eval scores. Append a new entry on every
material change to rubrics, goldens, or the evaluator. Never rewrite old
entries — this file is the audit trail for quality over time.

**Format** — one H2 per entry, dated. Scores reported as `per-type strong avg / weak avg`:

- strong avg: mean overall score of that type's 3 "strong" golden cases
- weak avg: mean overall score of that type's 2 "weak" golden cases

A healthy evaluator shows a wide gap (strong ≥ 0.72, weak ≤ 0.50).

---

## 2026-04-19 — F4 baseline

**Evaluator:** `openai:gpt-4o-mini` (temperature 0)
**Rubrics:** `prd-v1`, `adr-v1`, `project-charter-v1`, `chat-response-v1`
**Goldens:** 20 cases, 5 per type (3 strong + 2 weak)

Dry-run validation:
- All 4 rubrics load; weights sum to 1.0 (±1e-6) ✓
- 20 golden cases structurally valid ✓
- Every golden artifact maps to a registered rubric ✓
- Evaluator refuses to score when `generatorProviderId === evaluator.id` (GAN guard) ✓

Live scores (openai:gpt-4o-mini evaluating hand-written goldens, pipeline generator assumed = Anthropic; GAN-separated at the provider level):

| Type             | Strong avg | Weak avg | Gap  |
|------------------|-----------:|---------:|-----:|
| prd              |      0.86  |    0.20  | 0.66 |
| adr              |      0.87  |    0.24  | 0.63 |
| project-charter  |      0.83  |    0.20  | 0.63 |
| chat-response    |      0.91  |    0.36  | 0.55 |

All 20 golden cases clear their thresholds. Evaluator shows healthy
discriminating power (strong/weak gap ≥ 0.55 across every type). Full
run: 122 passed, 0 failed, 122 total.

---

## How to update

1. Make the rubric or golden change.
2. Run `npm run eval` — must pass dry-run (structure + weights + GAN guard).
3. Run `npm run eval:live` if an API key is available; record per-type averages here.
4. Commit the log update with the code change.

## When to bump a rubric version

- Material change to criteria (add/remove/re-weight) → bump rubric `id` suffix
  (e.g. `prd-v1` → `prd-v2`). Old scores stay pinned to the old id so the
  log stays comparable over time.
- Tweaking a single `scoringGuide` description → no bump, note it here.
