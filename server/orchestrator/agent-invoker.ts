/**
 * Agent invoker — the per-step execution unit of the Virtual Company Engine.
 *
 * Lifecycle (one call to invokeAgent):
 *   1. Budget pre-check (BudgetGuard.canAfford). Abort if breached.
 *   2. Resolve the agent's output schema via the artifact-schemas registry.
 *   3. Best-effort retrieve 2–3 similar past artifacts for in-context priming
 *      (server/orchestrator/run-tracer.retrieveSimilarArtifacts).
 *   4. Log the step (run-tracer.logStep, status="running").
 *   5. Assemble the system prompt:
 *      F6 truth-first preamble + agent's authored prompt + schema description
 *      + few-shot context from past artifacts + the input payload.
 *   6. Call the provider (selected by agent.modelTier).
 *   7. Parse JSON + Zod-validate. ONE retry with the error fed back if the
 *      first attempt fails validation.
 *   8. Record cost on the BudgetGuard.
 *   9. Persist the artifact (run-tracer.logArtifact). Embed asynchronously.
 *  10. Run the F4 evaluator and persist the score back onto the artifact.
 *  11. completeStep with output payload + token + cost telemetry.
 *
 * Throws BudgetExceededError when the pre-check fails. All other failures
 * mark the step as "failed" via completeStep before re-throwing.
 */

import type { z } from "zod";
import type { AgentDefinition } from "../../shared/agent-schema";
import type { AIProvider } from "../providers/ai-provider-interface";
import type { ConfidenceField } from "../truth-first/artifact-schema";
import {
  ConfidenceFieldSchema,
} from "../truth-first/artifact-schema";
import {
  type EvalResult,
  evaluateArtifact,
} from "../eval/evaluator";
import { getRubric } from "../eval/rubrics";
import { selectProvider, getOpenAIProviderInstance } from "../providers/provider-registry";
import { BudgetGuard, estimateCallCost } from "./budget-guard";
import {
  getArtifactSchema,
  type ArtifactSchemaEntry,
} from "./artifact-schemas";
import { buildAgentSystemPrompt } from "../agents/prompt-builder";
import {
  logStep,
  completeStep,
  logArtifact,
  setArtifactEval,
  retrieveSimilarArtifacts,
  type SimilarArtifactRow,
} from "./run-tracer";
import { embedArtifact } from "./artifact-embedder";
import { embedText } from "../embedding-engine";

// ── Errors ─────────────────────────────────────────────────────────────────

export class BudgetExceededError extends Error {
  constructor(
    readonly runId: string,
    readonly agentId: string,
    readonly reason: "cost" | "tokens" | "duration" | "calls"
  ) {
    super(`BudgetExceededError: agent ${agentId} cannot proceed in run ${runId} (reason: ${reason})`);
    this.name = "BudgetExceededError";
  }
}

export class SchemaValidationError extends Error {
  constructor(readonly agentId: string, readonly attempts: number, readonly zodMessage: string) {
    super(`SchemaValidationError: agent ${agentId} failed after ${attempts} attempt(s): ${zodMessage}`);
    this.name = "SchemaValidationError";
  }
}

export class UnknownOutputSchemaError extends Error {
  constructor(readonly agentId: string, readonly outputSchemaName: string) {
    super(`UnknownOutputSchemaError: agent ${agentId} references unknown outputSchema "${outputSchemaName}"`);
    this.name = "UnknownOutputSchemaError";
  }
}

// ── Public types ───────────────────────────────────────────────────────────

export interface InvokeAgentInput {
  agent: AgentDefinition;
  /** Run identifier (from run-tracer.createRun). */
  runId: string;
  /** Sequential index inside the run; ascending per agent invocation. */
  stepIndex: number;
  /** Org id, used for retrieval scoping. Null for solo-user runs. */
  orgId?: string | null;
  /** Structured input payload — passed to the agent as JSON. */
  input: unknown;
  /**
   * Optional: text to embed for retrieval. Defaults to a flattened JSON
   * dump of `input` if absent. Set to "" to skip retrieval entirely.
   */
  retrievalQueryText?: string;
  /** Override provider (for tests / replay). Defaults to selectProvider(agent.modelTier). */
  provider?: AIProvider;
  /** Override the model id (for tests / replay). */
  modelOverride?: string;
  /** BudgetGuard for the enclosing run. Required. */
  budget: BudgetGuard;
  /** Cap on retrieved similar artifacts. Default 3. */
  similarLimit?: number;
}

export interface InvokeAgentResult<T = unknown> {
  artifact: T;
  artifactId: string;
  stepId: string;
  evaluation: EvalResult;
  /** Tokens used (input + output). */
  tokensUsed: number;
  costUSD: number;
  /** Number of provider attempts (1 on first-try success, 2 after retry). */
  attempts: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pickModelId(agent: AgentDefinition): string {
  // Map AgentDefinition.modelTier to a concrete model id. The provider
  // registry abstracts the provider; the model id picks the model within
  // that provider.
  switch (agent.modelTier) {
    case "frontier":
      return "claude-sonnet-4-6";
    case "skill":
      return "claude-sonnet-4-6";
    case "standard":
      return "gpt-4o";
    case "mini":
    default:
      return "gpt-4o-mini";
  }
}

function summarizeArtifactForContext(row: SimilarArtifactRow): string {
  const head = `[similar past ${row.artifactType}, similarity ${row.similarity.toFixed(2)}]`;
  const payloadStr = typeof row.payload === "string"
    ? row.payload
    : JSON.stringify(row.payload, null, 2);
  // Cap at ~600 chars per past artifact; we ship up to 3 of them.
  const trimmed = payloadStr.length > 600 ? payloadStr.slice(0, 600) + "…" : payloadStr;
  return `${head}\n${trimmed}`;
}

function flattenForEmbedding(payload: unknown): string {
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload).slice(0, 8000);
  } catch {
    return String(payload);
  }
}

function extractJSON(raw: string): unknown {
  // Strip markdown fences, leading prose. Match the first top-level brace.
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON object in response");
  return JSON.parse(match[0]);
}

function buildPrompt(args: {
  agent: AgentDefinition;
  schemaEntry: ArtifactSchemaEntry;
  similarContext: string;
  input: unknown;
}): { system: string; user: string } {
  const agentPrompt = buildAgentSystemPrompt(args.agent);
  const schemaSection = [
    `── Output schema (REQUIRED) ──`,
    `Return ONLY valid JSON matching the "${args.schemaEntry.name}" schema. No prose, no markdown fences.`,
    args.schemaEntry.description,
    `Every artifact ends with a "confidence" object: { "level": "High"|"Medium"|"Low", "reason": "5–15 words" }.`,
  ].join("\n");
  const contextSection = args.similarContext
    ? `── Past similar artifacts (context only — do not copy verbatim) ──\n${args.similarContext}`
    : "";
  const system = [agentPrompt, schemaSection, contextSection].filter(Boolean).join("\n\n");
  const user = `── Input ──\n${typeof args.input === "string" ? args.input : JSON.stringify(args.input, null, 2)}`;
  return { system, user };
}

function buildRetryPrompt(args: {
  base: { system: string; user: string };
  previousResponse: string;
  zodErrorMessage: string;
}): { system: string; user: string } {
  const retryUser = [
    args.base.user,
    ``,
    `── Your previous response failed schema validation ──`,
    `Validator error:`,
    args.zodErrorMessage,
    ``,
    `Previous response (truncated):`,
    args.previousResponse.slice(0, 1500),
    ``,
    `Return valid JSON now. JSON only.`,
  ].join("\n");
  return { system: args.base.system, user: retryUser };
}

// ── Public entry ───────────────────────────────────────────────────────────

export async function invokeAgent<T = unknown>(input: InvokeAgentInput): Promise<InvokeAgentResult<T>> {
  const { agent, runId, stepIndex, budget } = input;

  // 1. Resolve the agent's output schema
  const schemaEntry = getArtifactSchema(agent.outputSchema);
  if (!schemaEntry) throw new UnknownOutputSchemaError(agent.id, agent.outputSchema);

  // 2. Budget pre-check
  if (!budget.canAfford(agent.estimatedTokens, agent.modelTier)) {
    const reason = budget.check().reason ?? "calls";
    throw new BudgetExceededError(runId, agent.id, reason);
  }

  // 3. Best-effort retrieve similar past artifacts
  let similar: SimilarArtifactRow[] = [];
  const retrievalText = input.retrievalQueryText ?? flattenForEmbedding(input.input);
  if (retrievalText && retrievalText.trim().length > 0) {
    try {
      const queryVec = await embedText(retrievalText);
      similar = await retrieveSimilarArtifacts(
        input.orgId ?? null,
        queryVec,
        schemaEntry.artifactType,
        input.similarLimit ?? 3
      );
    } catch (err) {
      console.warn(`[agent-invoker] similar-artifact retrieval failed for ${agent.id}:`, (err as Error).message);
    }
  }

  // 4. Log step
  const stepId = await logStep({
    runId,
    agentId: agent.id,
    stepIndex,
    promptVersion: agent.promptVersion,
    inputPayload: input.input,
  });

  // 5. Assemble prompts
  const similarContext = similar.map(summarizeArtifactForContext).join("\n\n");
  const base = buildPrompt({ agent, schemaEntry, similarContext, input: input.input });

  // 6. Provider + model
  const provider = input.provider ?? selectProvider(agent.modelTier);
  const model = input.modelOverride ?? pickModelId(agent);

  // 7. Provider call + parse + retry
  let attempts = 0;
  let parsed: T;
  let tokensIn = 0;
  let tokensOut = 0;
  let lastResponseContent = "";

  try {
    const callOnce = async (messages: { role: "system" | "user"; content: string }[]) => {
      attempts += 1;
      const resp = await provider.chat({
        model,
        messages,
        maxTokens: agent.estimatedTokens,
        temperature: 0,
      });
      tokensIn += resp.usage?.inputTokens ?? 0;
      tokensOut += resp.usage?.outputTokens ?? 0;
      lastResponseContent = resp.content;
      return resp;
    };

    let json: unknown;
    let zodResult: z.SafeParseReturnType<unknown, unknown>;

    // Attempt 1
    await callOnce([
      { role: "system", content: base.system },
      { role: "user", content: base.user },
    ]);
    try {
      json = extractJSON(lastResponseContent);
      zodResult = schemaEntry.schema.safeParse(json);
    } catch (parseErr) {
      const msg = (parseErr as Error).message;
      // Attempt 2 — feed the parse error back
      const retry = buildRetryPrompt({
        base, previousResponse: lastResponseContent, zodErrorMessage: msg,
      });
      await callOnce([
        { role: "system", content: retry.system },
        { role: "user", content: retry.user },
      ]);
      try {
        json = extractJSON(lastResponseContent);
        zodResult = schemaEntry.schema.safeParse(json);
      } catch (parseErr2) {
        await completeStep({
          stepId, status: "failed",
          tokensIn, tokensOut, costUSD: estimateCallCost(tokensIn + tokensOut, agent.modelTier),
          errorMessage: `parse failed twice: ${(parseErr2 as Error).message}`,
        });
        throw new SchemaValidationError(agent.id, attempts, (parseErr2 as Error).message);
      }
    }

    if (!zodResult.success) {
      const errMsg = zodResult.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      // Attempt 2 (or 3 if first-attempt parse worked but zod failed) —
      // retry only if we haven't already retried.
      if (attempts < 2) {
        const retry = buildRetryPrompt({
          base, previousResponse: lastResponseContent, zodErrorMessage: errMsg,
        });
        await callOnce([
          { role: "system", content: retry.system },
          { role: "user", content: retry.user },
        ]);
        json = extractJSON(lastResponseContent);
        zodResult = schemaEntry.schema.safeParse(json);
      }
      if (!zodResult.success) {
        const finalErr = zodResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        await completeStep({
          stepId, status: "failed",
          tokensIn, tokensOut, costUSD: estimateCallCost(tokensIn + tokensOut, agent.modelTier),
          errorMessage: `zod validation failed: ${finalErr}`,
        });
        throw new SchemaValidationError(agent.id, attempts, finalErr);
      }
    }

    parsed = zodResult.data as T;
  } catch (err) {
    if (err instanceof SchemaValidationError) throw err;
    // Provider crash, JSON parse, anything else.
    const msg = (err as Error)?.message ?? String(err);
    await completeStep({
      stepId, status: "failed",
      tokensIn, tokensOut, costUSD: estimateCallCost(tokensIn + tokensOut, agent.modelTier),
      errorMessage: msg,
    }).catch(() => {});
    throw err;
  }

  // 8. Record cost on the budget
  const totalTokens = tokensIn + tokensOut;
  const costUSD = estimateCallCost(totalTokens, agent.modelTier);
  budget.record(totalTokens, costUSD);

  // 9. Persist the artifact + async embed
  const confidenceParse = ConfidenceFieldSchema.safeParse((parsed as { confidence?: ConfidenceField }).confidence);
  const confidence = confidenceParse.success ? confidenceParse.data : null;
  const artifactId = await logArtifact({
    runId,
    stepId,
    orgId: input.orgId ?? null,
    artifactType: schemaEntry.artifactType,
    title: agent.name,
    payload: parsed,
    confidence,
  });
  // Fire-and-forget embed — never block on this.
  embedArtifact(artifactId, parsed, { title: agent.name }).catch((e) =>
    console.warn(`[agent-invoker] embed for ${artifactId} failed:`, (e as Error).message)
  );

  // 10. Evaluate via F4
  let evaluation: EvalResult;
  try {
    evaluation = await evaluateArtifact({
      artifactId,
      artifact: parsed,
      rubric: getRubric(schemaEntry.artifactType),
      evaluator: getOpenAIProviderInstance(),
      generatorProviderId: provider.id === "openai" ? undefined : provider.id,
    });
    await setArtifactEval(artifactId, {
      qualityScore: evaluation.overallScore,
      rubricId: evaluation.rubricId,
      evaluatorId: evaluation.evaluatedBy,
      confidence,
    });
  } catch (err) {
    // Eval failures are non-fatal — the artifact still exists; the gate
    // engine will surface the missing score. Log and proceed.
    console.warn(`[agent-invoker] evaluator failed for ${artifactId}:`, (err as Error).message);
    evaluation = {
      rubricId: getRubric(schemaEntry.artifactType).id,
      artifactId,
      overallScore: 0,
      criterionScores: [],
      evaluatedBy: "evaluator-failed",
      evaluatedAt: new Date().toISOString(),
      confidence: "Low",
    };
  }

  // 11. Mark step complete
  await completeStep({
    stepId,
    status: "completed",
    outputPayload: parsed,
    tokensIn,
    tokensOut,
    costUSD,
  });

  return {
    artifact: parsed,
    artifactId,
    stepId,
    evaluation,
    tokensUsed: totalTokens,
    costUSD,
    attempts,
  };
}
