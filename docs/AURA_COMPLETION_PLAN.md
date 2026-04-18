Aura Virtual Company Engine — Completion Plan
For: Lithin
Starting from: Aura-v3-Complete-20260405.zip (Stage 3 complete)
Building with: Claude Code in VS Code
Date: April 2026

1. Where You Actually Are (stop and read this)
Take a breath. You are not behind. You are not lost. You are at a specific, identifiable point in the build.
What is DONE in your codebase:

Stage 1–3 chat app, including: tab navigation, chat SSE streaming, task/project/memory management, file attachments, confidence ratings, RAG pipeline, premium UI, 26 skills across 9 domains, builder engine, craft/DOCX generation, PostgreSQL schema with encryption at rest, 16 test files totalling ~2,000+ assertions
Prompts 1–6 completed (conversations, skill fixes, craft fix, model upgrade, greeting, API)
Architecture specification for the Virtual Company Engine (locked)
Master prompts file with Prompts 7–11 detailed + Prompts 12–20 queued

What is NOT yet built (confirmed by reading the zip):

shared/agent-schema.ts — does not exist
server/agents/ — does not exist
server/orchestrator/ — does not exist
pipeline_runs, run_steps, run_artifacts, gate_results, tool_calls, agent_decisions database tables — do not exist
Intent classifier (chat vs build) — does not exist
Pipeline UI components — do not exist

Translation: Everything up to "chat assistant with skills" exists. Everything that turns it into a "Virtual Company" is ahead of you. Your next keystroke is Prompt 7.

2. The Simple Path to MVP
You have one job for the next 1–2 weeks: execute Prompts 7 through 11, in order, in Claude Code. That is the whole plan for getting the Virtual Company Engine live.
  [DONE]          [YOU ARE HERE]                                      [MVP DONE]
Stage 1-3  ─►  Prompt 7  ─►  Prompt 8  ─►  Prompt 9  ─►  Prompt 10  ─►  Prompt 11
             (agents)      (DB/tracer)   (orchestrator)  (artifacts)    (UI)
                │              │              │              │              │
              2-3 hrs        1-2 hrs        3-4 hrs        2-3 hrs        2-3 hrs
Total: 10–15 hours of Claude Code execution plus ~4 hours of your review/debugging time. At the Max 5x tier you're on, this fits comfortably inside usage limits if spread over 3–5 sessions.
After Prompt 11 you have a working Virtual Company Engine. Prompts 12–20 are polish, breadth, and enterprise features. Do NOT start them until 7–11 are running end-to-end.

3. Pre-Flight Checklist (do this BEFORE typing a single prompt)
Skip this at your peril. Most of the pain people feel with Claude Code is from starting on a dirty base.
3.1 Clean working directory
bash# Fresh clone or fresh unzip to a NEW folder — do not layer on top of old attempts
cd ~/projects
unzip ~/Downloads/Aura-v3-Complete-20260405.zip -d aura-vce
cd aura-vce
git init
git add -A
git commit -m "baseline: Aura v3 Stage 3 complete"
The git init + commit is non-negotiable. Every prompt you run will be one commit. If anything explodes, git reset --hard is your undo button.
3.2 Environment variables
Create .env (or confirm existing one has):
DATABASE_URL=postgres://...           # your Postgres URL
SESSION_SECRET=...                    # 32+ random chars — encryption key derives from this
OPENAI_API_KEY=...                    # for existing chat
ANTHROPIC_API_KEY=...                 # Claude Agent SDK + frontier agents (Prompt 9)
The ANTHROPIC_API_KEY is new. Prompts 9+ call both OpenAI and Anthropic for model routing (executive agents use Claude, specialists use GPT).
3.3 Baseline tests pass
bashnpm install
npm test
Every test must pass before you start. If tests are broken in the baseline, fix them first — otherwise you'll waste hours chasing ghosts that were already there.
3.4 Claude Code setup
In VS Code:

Open the aura-vce folder as a Claude Code workspace
Set the default model to Claude Opus 4.7 for Prompts 7, 9, 11 (architecture-heavy, need the strongest reasoning)
Switch to Claude Sonnet 4.6 for Prompts 8, 10 (mostly mechanical — DB migrations, template code)
Make sure Claude Code has permission to run npm test, npm run server:dev, and npx expo start

3.5 Create a scratch file for yourself
Make a NOTES.md in the repo root. After each Claude Code session, jot down:

Which prompt you ran
What broke (if anything)
What you changed manually
What the next session should start with

You will thank yourself. Context across sessions is where people lose the thread.

4. Execution Strategy — Prompt by Prompt
Prompt 7: Agent Definition Framework
Builds: shared/agent-schema.ts, server/agents/agent-registry.ts, 9 agent definition files (CEO, CTO, CPO, COO, CISO, eng-lead, qa-lead, security-lead, design-lead), server/agents/index.ts, tests/agent-registry.test.ts
Time: 2–3 hours of Claude Code execution
How to run it:

Paste the full Prompt 7 block from AURA_VIRTUAL_COMPANY_ENGINE_PROMPTS.md (lines 26–384) into Claude Code
Add this preamble at the top: "Execute this prompt in full. Read server/skill-engine.ts and shared/schema.ts first to match existing patterns. When done, run npm test and report results."
Let it run. Don't interrupt.

Verify:

AGENT_REGISTRY.size >= 9
npm test — all existing tests still pass + new agent-registry.test.ts passes
Every chainsWith and escalatesTo reference resolves

If it fails: Most likely cause is TypeScript type import errors. Ask Claude Code: "The test agent-registry.test.ts is failing. Diagnose and fix without touching the schema definitions."
Commit: git commit -m "prompt 7: agent definition framework"

Prompt 8: Database Schema + Run Tracer
Builds: 6 new Postgres tables (pipeline_runs, run_steps, run_artifacts, gate_results, tool_calls, agent_decisions), server/orchestrator/run-tracer.ts, server/orchestrator/gate-engine.ts, tests/run-tracer.test.ts
Time: 1–2 hours
How to run it:

Paste Prompt 8 (lines 388–651) into Claude Code
Preamble: "Read server/migration.ts and server/memory-engine.ts first for patterns. All sensitive text must go through encrypt()/safeDecrypt(). After migrations, restart the server once so initDatabase() runs."

Verify:

Open Postgres, run \dt — you should see the 6 new tables
npm test passes
Write a quick sanity query: SELECT count(*) FROM pipeline_runs; → should return 0, no error

If it fails: Migration errors usually mean the CREATE TABLE IF NOT EXISTS order is wrong (foreign keys reference tables not yet created). Ask Claude Code: "The migration is failing with [error]. Reorder CREATE TABLE statements so dependencies come first, without dropping any of them."
Commit.

Prompt 9: The Orchestrator (the big one)
Builds: server/orchestrator/intent-classifier.ts, server/orchestrator/artifact-schemas.ts (9 Zod schemas), server/orchestrator/agent-invoker.ts, server/orchestrator/e2e-pdl.ts (the main engine), 5 new /api/pipeline/* routes, integration into existing POST /api/chat, tests/orchestrator.test.ts
Time: 3–4 hours — this is the longest and most complex
How to run it:

Split this into two sessions. Run it as two sub-prompts:

Session 9A: "Execute Prompt 9, parts 1, 2, 3 only (intent classifier, artifact schemas, agent invoker). Stop there. Run npm test and report."
Session 9B: "Now execute Prompt 9, parts 4, 5, 6, 7 (the main orchestrator, routes, chat integration, tests)."


Before Session 9B, manually verify intent classification works by calling the function in a REPL or with a tiny test script.

Verify:

Send a POST to /api/chat with "build me a simple todo app" → returns a build_detected SSE event
Send "what is TypeScript" → returns a normal chat response (no pipeline trigger)
Measure regular chat response time — it should not be noticeably slower (<50ms overhead)
POST /api/pipeline/start with a simple request → watch SSE events flow through phases

If it fails: The orchestrator has many moving parts. Do NOT ask for a rewrite. Ask surgically: "The phase_start SSE event isn't firing for Phase B. The agent-invoker completes but the orchestrator skips ahead. Show me the loop in e2e-pdl.ts that advances phases and identify the bug."
Commit.

Prompt 10: Artifact-to-Craft Document Generation
Builds: server/orchestrator/artifact-to-craft.ts (7 DOCX templates), server/orchestrator/bundle-generator.ts, updates to e2e-pdl.ts to invoke it, tests/artifact-to-craft.test.ts
Time: 2–3 hours
How to run it:

Paste Prompt 10 (lines 938–1118)
Preamble: "Read server/craft-engine.ts and server/document-engine.ts first. Use the existing generateCraft() with kind: 'docx' — do not create a new DOCX path."

Verify:

Trigger a full pipeline run with a simple request
Check the run_artifacts table — every artifact should have a craft_id populated
Download each Craft from /api/crafts/:id/download — each should be a valid DOCX that opens in Word
The final "bundle" DOCX contains all sections

This is the most satisfying prompt — you will see 7–12 real Word documents come out of one user request. That moment is the payoff for everything before.
Commit.

Prompt 11: Client-Side Pipeline UI
Builds: components/pipeline/PipelineCard.tsx, PipelineProgress.tsx, ArtifactCard.tsx, PipelineSummary.tsx, updates to app/(tabs)/aura.tsx for SSE event handling
Time: 2–3 hours
How to run it:

Paste Prompt 11 (lines 1124–1228)
Preamble: "Match the styling of existing components/chat/ components exactly. Use constants/colors.ts tokens, no inline colors. Do not modify the existing chat message rendering path — pipeline components are additive."

Verify:

npx expo start --clear
In the app: type "build me a budget tracker" → see PipelineCard with 3 options
Tap "Start Build" → see PipelineProgress animate A→B→C...
Artifact cards appear as documents are produced
Final PipelineSummary shows download links
Go back to a normal chat message → everything works as before

Commit.

5. Claude Code Working Tactics (hard-won)
Paste the prompt verbatim, don't summarize. The prompts file was written to be executable. Paraphrasing strips details Claude Code needs. Paste it raw.
One prompt = one session = one commit. Don't batch 7 and 8 together to "save time." You cannot debug a 4-hour multi-prompt run that went sideways at hour 2.
When it breaks, don't restart — diagnose. The instinct to git reset and start the prompt over will cost you money and time. Nine times out of ten the fix is a 5-line change Claude Code can make if you point it at the exact failure. Paste the test output, paste the file, say "fix this specifically."
Don't let it wander. If Claude Code starts asking questions like "should I also add X?" during an execution — say "No. Execute the prompt as written. We'll consider extensions after it passes tests." Scope creep inside a prompt run is how you end up with 3 extra files you didn't want.
Budget check after each prompt. At the Max 5x tier, Prompts 7–11 should fit within 2–3 usage windows if you keep sessions focused. If you hit a limit mid-prompt, stop, wait, resume — don't switch to a cheaper model mid-stream.
Keep NOTES.md updated. At the end of every session, write 3 lines: what you ran, what passed, what needs attention next time. You will reopen VS Code in 2 days having forgotten everything; your notes are the handoff.

6. Your First Session Plan (do this next)
Assuming you have 3 hours available:

(15 min) Pre-flight: clean folder, git init, npm install, npm test, confirm all existing tests pass, confirm .env has ANTHROPIC_API_KEY
(5 min) Open VS Code with Claude Code, set model to Opus 4.7
(2 hours) Paste Prompt 7 with the preamble from section 4 above. Let it run. Review the output.
(20 min) Run npm test, fix any issues, commit.
(20 min) Update NOTES.md. Close laptop.

That's it. One prompt, one commit, one session. The entire Virtual Company Engine MVP is just this pattern repeated five times.

7. When to Stop and Reconsider
Hard rules for pausing:

If a prompt takes >2x its estimate, stop and diagnose why. Don't just let it grind.
If tests that used to pass now fail, and Claude Code can't fix it in 2 attempts, git reset --hard to the last good commit and ask Claude Code to re-plan the prompt before re-executing.
If you find yourself adding "small improvements" to the architecture during a run, stop. Write them in NOTES.md as "post-MVP candidates" and keep going. Mid-build architecture drift is the single biggest killer of large projects.
If a whole phase of the pipeline produces nonsense output (e.g., artifacts that don't match schemas), do not patch the agent prompts yet. Finish Prompts 7–11 first. You'll tune the agent system prompts in a dedicated iteration later — that's its own skill.


8. After Prompt 11 — What Comes Next
Once the MVP is working (you typed "build me X" and got 7+ DOCX documents back), you'll want to:

Ship a first build to yourself. Use Aura to build a tiny product. Read the artifacts it produced. This tells you which agent prompts are weak.
Tune the 3 weakest agent prompts — usually CPO, CTO, and QA Lead based on how others have reported. One session each.
Decide which of Prompts 12–20 to do next. My recommendation order based on user value:

Prompt 16 (Observability Dashboard) — you'll want this immediately once you've run 5+ pipelines
Prompt 13 (Cybersecurity Pipeline) — the architecture spec considers this core, not optional
Prompt 18 (Near-Zero Error Chat Mode) — makes the chat side of the product production-grade
Prompt 12 (Remaining Agents) — expansion to full 40+ agent roster
Then the rest



Don't decide this now. Decide after you've lived with the MVP for a week.

9. Recovery Playbook — If You Get Stuck
SymptomFirst responseTests fail after a promptAsk Claude Code to show the failing test, read the expected vs actual, fix surgicallyPrompt produced a file in the wrong placeAsk Claude Code to move it and update imports; do not manually editYou have conflicting zip versions againPick ONE baseline (this one) and archive the others. Never merge across zips manuallyClaude Code loses context mid-promptStart a new session, give it NOTES.md + the prompt, tell it what's done and what's leftDatabase migration failsCheck server/migration.ts runs idempotently — every CREATE TABLE must have IF NOT EXISTSSSE events aren't streaming to the clientFirst check the client receives data: [DONE] at the end; most SSE bugs are missing terminatorsYou don't know what state you're in`git log --oneline

10. The One-Line Summary
Run Prompts 7, 8, 9, 10, 11 in Claude Code, one per session, committing after each, with npm test passing at every checkpoint. That is the entire plan. You are closer than you think.