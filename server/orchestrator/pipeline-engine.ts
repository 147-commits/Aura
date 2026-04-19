/**
 * Pipeline engine — the Virtual Company Engine orchestrator.
 *
 * Lifecycle:
 *   acquireRunSlot (concurrency guard)
 *   createRun
 *   for each phase in [discovery, design, planning, implementation, verification]:
 *     emit phase_start
 *     activate eligible agents (CISO conditional on auth/PII/payments brief)
 *     parallel fan-out via Promise.allSettled — failures are isolated per agent
 *     gather artifacts; if all agents failed → pipeline_error and abort
 *     evaluate phase gates; reuse F4 scores stamped by agent-invoker
 *     on gate-fail → status=paused-gate, emit gate_failed, return
 *     on budget breach → status=paused-budget, emit budget_exceeded, return
 *     emit phase_complete
 *   completeRun(completed)
 *   emit pipeline_complete
 *   finally: releaseRunSlot
 *
 * Phases F (release) and G (gtm) are deferred to v2 per spec.
 *
 * Dependencies are injectable so tests can mock invokeAgent + evaluateGate
 * without touching real models.
 */

import { randomUUID } from "node:crypto";
import type { PipelinePhase, AgentDefinition } from "../../shared/agent-schema";
import type { ConfidenceField } from "../truth-first/artifact-schema";
import type { ArtifactType } from "../eval/rubric-schema";
import { AGENT_REGISTRY, getAgentsForPhase } from "../agents/agent-registry";
import { acquireRunSlot, releaseRunSlot } from "./concurrency-guard";
import {
  createRun,
  updateRunStatus,
  completeRun,
} from "./run-tracer";
import { BudgetGuard, DEFAULT_BUDGET, type RunBudget } from "./budget-guard";
import { invokeAgent as defaultInvokeAgent, type InvokeAgentResult } from "./agent-invoker";
import {
  evaluateGate as defaultEvaluateGate,
  getRequiredGates,
  isGateRequired,
  type GateArtifact,
  type GateId,
} from "./gate-engine";
import { getArtifactSchema } from "./artifact-schemas";

// ── Phase order (A-E) ──────────────────────────────────────────────────────

export const PIPELINE_PHASES: PipelinePhase[] = [
  "discovery",
  "design",
  "planning",
  "implementation",
  "verification",
];

// ── Public types ───────────────────────────────────────────────────────────

export type PipelineStatus =
  | "completed"
  | "paused-gate"
  | "paused-budget"
  | "failed"
  | "cancelled";

export interface PipelineInput {
  userId: string;
  orgId?: string | null;
  brief: string;
  deliveryOption?: string | null;
  budget?: RunBudget;
  /** Resume an existing paused run rather than creating a new one. */
  existingRunId?: string;
  /** Phase to start from (used by resume). Defaults to "discovery". */
  startFromPhase?: PipelinePhase;
  /** SSE event sink. */
  emit?: (event: PipelineEvent) => void;
  /** Test/mocking hooks. */
  deps?: Partial<PipelineDeps>;
}

export interface PipelineDeps {
  invokeAgent: typeof defaultInvokeAgent;
  evaluateGate: typeof defaultEvaluateGate;
  acquireRunSlot: typeof acquireRunSlot;
  releaseRunSlot: typeof releaseRunSlot;
  createRun: typeof createRun;
  updateRunStatus: typeof updateRunStatus;
  completeRun: typeof completeRun;
}

export interface PipelineResult {
  runId: string;
  status: PipelineStatus;
  totalCostUSD: number;
  totalTokens: number;
  durationMs: number;
  /** Phase that paused the run, when status is paused-*. */
  pausedAtPhase?: PipelinePhase;
  /** Reason text for paused / failed states. */
  reason?: string;
}

export type PipelineEvent =
  | { type: "pipeline_start"; runId: string; brief: string }
  | { type: "phase_start"; runId: string; phase: PipelinePhase; agents: string[] }
  | { type: "agent_working"; runId: string; phase: PipelinePhase; agentId: string }
  | { type: "agent_failed"; runId: string; phase: PipelinePhase; agentId: string; error: string }
  | { type: "artifact_produced"; runId: string; phase: PipelinePhase; agentId: string; artifactId: string; artifactType: ArtifactType; qualityScore: number | null }
  | { type: "gate_check"; runId: string; phase: PipelinePhase; gateId: GateId }
  | { type: "gate_failed"; runId: string; phase: PipelinePhase; gateId: GateId; confidence: ConfidenceField; reason: string }
  | { type: "phase_complete"; runId: string; phase: PipelinePhase; artifactsCount: number }
  | { type: "pipeline_complete"; runId: string; totalCostUSD: number; totalTokens: number; durationMs: number }
  | { type: "pipeline_error"; runId: string; phase?: PipelinePhase; message: string }
  | { type: "budget_exceeded"; runId: string; reason: string };

// ── Public errors (thrown before SSE stream starts) ────────────────────────

export class ConcurrencyExceededError extends Error {
  constructor(readonly currentRuns: number, readonly maxRuns: number, readonly tier: string) {
    super(`ConcurrencyExceededError: ${currentRuns}/${maxRuns} runs in flight (tier: ${tier})`);
    this.name = "ConcurrencyExceededError";
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function shouldActivateAgent(agent: AgentDefinition, opts: { briefText: string; deliveryOption: string | null }): boolean {
  // CISO is conditional on the same trigger that gates G3.
  if (agent.id === "ciso") {
    return isGateRequired("G3", { briefText: opts.briefText, deliveryOption: opts.deliveryOption });
  }
  return true;
}

interface AccumulatedArtifact {
  agentId: string;
  artifactType: ArtifactType;
  artifact: unknown;
  artifactId: string;
  /** F4 evaluator score stamped by the agent-invoker. */
  qualityScore: number;
}

function buildAgentInput(args: {
  brief: string;
  deliveryOption: string | null;
  phase: PipelinePhase;
  prior: AccumulatedArtifact[];
}): {
  brief: string;
  deliveryOption: string | null;
  phase: PipelinePhase;
  priorArtifacts: { agentId: string; artifactType: ArtifactType; artifact: unknown }[];
} {
  return {
    brief: args.brief,
    deliveryOption: args.deliveryOption,
    phase: args.phase,
    priorArtifacts: args.prior.map((p) => ({
      agentId: p.agentId,
      artifactType: p.artifactType,
      artifact: p.artifact,
    })),
  };
}

function noopEmit(_e: PipelineEvent): void { /* no-op */ }

// ── Main entry ─────────────────────────────────────────────────────────────

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const startedAt = Date.now();
  const emit = input.emit ?? noopEmit;
  const deps: PipelineDeps = {
    invokeAgent: input.deps?.invokeAgent ?? defaultInvokeAgent,
    evaluateGate: input.deps?.evaluateGate ?? defaultEvaluateGate,
    acquireRunSlot: input.deps?.acquireRunSlot ?? acquireRunSlot,
    releaseRunSlot: input.deps?.releaseRunSlot ?? releaseRunSlot,
    createRun: input.deps?.createRun ?? createRun,
    updateRunStatus: input.deps?.updateRunStatus ?? updateRunStatus,
    completeRun: input.deps?.completeRun ?? completeRun,
  };

  const runId = input.existingRunId ?? randomUUID();
  const budget = new BudgetGuard(runId, input.budget ?? DEFAULT_BUDGET);

  // Concurrency: acquire slot. Failure throws BEFORE the run record exists.
  const slot = await deps.acquireRunSlot(input.userId, input.orgId ?? null, runId);
  if (!slot.acquired) {
    throw new ConcurrencyExceededError(slot.currentRuns, slot.maxRuns, slot.tier);
  }

  let totalCostUSD = 0;
  let totalTokens = 0;
  let pausedAtPhase: PipelinePhase | undefined;
  let pauseReason: string | undefined;
  let status: PipelineStatus = "failed"; // overwritten on success

  try {
    // Create the run record (or skip if resuming).
    if (!input.existingRunId) {
      await deps.createRun({
        runId,
        userId: input.userId,
        orgId: input.orgId ?? null,
        deliveryOption: input.deliveryOption ?? null,
        budget: input.budget ?? DEFAULT_BUDGET,
        inputBrief: input.brief,
        promptVersionSet: snapshotPromptVersionsForPipeline(),
      });
    }

    emit({ type: "pipeline_start", runId, brief: input.brief });

    const startPhaseIdx = input.startFromPhase
      ? Math.max(0, PIPELINE_PHASES.indexOf(input.startFromPhase))
      : 0;
    const accumulated: AccumulatedArtifact[] = [];
    let stepIndex = 0;

    for (let p = startPhaseIdx; p < PIPELINE_PHASES.length; p++) {
      const phase = PIPELINE_PHASES[p];

      // 1. Pick agents for the phase
      const all = getAgentsForPhase(phase);
      const eligible = all.filter((a) =>
        shouldActivateAgent(a, { briefText: input.brief, deliveryOption: input.deliveryOption ?? null })
      );

      emit({
        type: "phase_start",
        runId,
        phase,
        agents: eligible.map((a) => a.id),
      });

      if (eligible.length === 0) {
        // No agents activate for this phase under the current brief — skip.
        emit({ type: "phase_complete", runId, phase, artifactsCount: 0 });
        continue;
      }

      // 2. Parallel fan-out
      const indexAt = stepIndex;
      stepIndex += eligible.length;

      const invocations = eligible.map((agent, i) => {
        emit({ type: "agent_working", runId, phase, agentId: agent.id });
        return deps.invokeAgent({
          agent,
          runId,
          stepIndex: indexAt + i,
          orgId: input.orgId ?? null,
          input: buildAgentInput({
            brief: input.brief,
            deliveryOption: input.deliveryOption ?? null,
            phase,
            prior: accumulated,
          }),
          budget,
        });
      });

      const settled = await Promise.allSettled(invocations);

      const phaseArtifacts: AccumulatedArtifact[] = [];
      for (let i = 0; i < settled.length; i++) {
        const agent = eligible[i];
        const r = settled[i];
        if (r.status === "fulfilled") {
          const res = r.value as InvokeAgentResult;
          const schemaEntry = getArtifactSchema(agent.outputSchema);
          if (!schemaEntry) {
            // Should be impossible — registry validates at module load — but
            // be defensive so a missing entry doesn't crash a long run.
            emit({
              type: "agent_failed", runId, phase, agentId: agent.id,
              error: `unknown outputSchema "${agent.outputSchema}"`,
            });
            continue;
          }
          phaseArtifacts.push({
            agentId: agent.id,
            artifactType: schemaEntry.artifactType,
            artifact: res.artifact,
            artifactId: res.artifactId,
            qualityScore: res.evaluation.overallScore,
          });
          totalCostUSD += res.costUSD;
          totalTokens += res.tokensUsed;
          emit({
            type: "artifact_produced",
            runId, phase,
            agentId: agent.id,
            artifactId: res.artifactId,
            artifactType: schemaEntry.artifactType,
            qualityScore: res.evaluation.overallScore,
          });
        } else {
          emit({
            type: "agent_failed",
            runId, phase, agentId: agent.id,
            error: (r.reason as Error)?.message ?? String(r.reason),
          });
        }
      }

      // 3. If every agent in the phase failed, abort the pipeline.
      if (phaseArtifacts.length === 0) {
        const msg = `Phase ${phase}: all agents failed`;
        emit({ type: "pipeline_error", runId, phase, message: msg });
        await deps.updateRunStatus(runId, "failed", msg);
        return finalize("failed", msg, phase);
      }

      accumulated.push(...phaseArtifacts);

      // 4. Run gates for the phase. Reuse the agent-invoker's quality scores
      //    via precomputedScores so we don't pay the evaluator twice.
      const gates = getRequiredGates(phase, {
        briefText: input.brief,
        deliveryOption: input.deliveryOption,
      });
      for (const gate of gates) {
        emit({ type: "gate_check", runId, phase, gateId: gate.id });

        // Build GateArtifact[] from this phase's NEW artifacts whose type
        // matches the gate's required artifact list.
        const gateInputs: GateArtifact[] = [];
        const precomputedScores: Record<string, number> = {};
        for (const a of phaseArtifacts) {
          if (gate.requiredArtifacts.includes(a.artifactType)) {
            gateInputs.push({
              artifactId: a.artifactId,
              artifactType: a.artifactType,
              payload: a.artifact,
            });
            precomputedScores[a.artifactId] = a.qualityScore;
          }
        }

        const gateResult = await deps.evaluateGate({
          gateId: gate.id,
          artifacts: gateInputs,
          precomputedScores,
        });

        if (!gateResult.passed) {
          const reason = gateResult.confidence.reason ||
            `gate ${gate.id} failed: ${gateResult.checks.filter((c) => !c.passed).map((c) => c.id).join(", ")}`;
          emit({
            type: "gate_failed",
            runId, phase,
            gateId: gate.id,
            confidence: gateResult.confidence,
            reason,
          });
          await deps.updateRunStatus(runId, "paused-gate" as never, reason);
          return finalize("paused-gate", reason, phase);
        }
      }

      // 5. Budget check at the phase boundary.
      const budgetCheck = budget.check();
      if (!budgetCheck.withinBudget) {
        const reason = `budget breach: ${budgetCheck.reason}`;
        emit({ type: "budget_exceeded", runId, reason });
        await deps.updateRunStatus(runId, "paused-budget", reason);
        return finalize("paused-budget", reason, phase);
      }

      emit({
        type: "phase_complete",
        runId, phase,
        artifactsCount: phaseArtifacts.length,
      });
    }

    // 6. All phases done.
    status = "completed";
    await deps.completeRun(runId, "completed", {
      costUSD: totalCostUSD,
      tokens: totalTokens,
    });
    emit({
      type: "pipeline_complete",
      runId, totalCostUSD, totalTokens,
      durationMs: Date.now() - startedAt,
    });

    return finalize("completed");
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    emit({ type: "pipeline_error", runId, message: msg });
    await deps.updateRunStatus(runId, "failed", msg).catch(() => {});
    throw err;
  } finally {
    await deps.releaseRunSlot(input.userId, runId).catch(() => {});
  }

  function finalize(s: PipelineStatus, reason?: string, phase?: PipelinePhase): PipelineResult {
    status = s;
    pausedAtPhase = phase;
    pauseReason = reason;
    return {
      runId,
      status,
      totalCostUSD,
      totalTokens,
      durationMs: Date.now() - startedAt,
      pausedAtPhase,
      reason: pauseReason,
    };
  }
}

// ── Prompt-version snapshot (for the run record) ───────────────────────────

/**
 * Snapshot the prompt version of every PIPELINE-layer agent into a flat
 * record. Stored on pipeline_runs.prompt_version_set so a replay can
 * pin to the exact prompt versions used.
 */
function snapshotPromptVersionsForPipeline(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, agent] of AGENT_REGISTRY) {
    if (agent.layer === "advisor") continue;
    out[id] = agent.promptVersion;
  }
  return out;
}
