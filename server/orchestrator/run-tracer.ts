/**
 * Run tracer — observability for the Virtual Company Engine.
 *
 * Every pipeline run, step, artifact, gate decision, tool call, and
 * routing decision flows through here. Writes go to dedicated tables
 * (see server/migration.ts):
 *
 *   pipeline_runs    — canonical run record (per F5/F6 budget + concurrency)
 *   run_steps        — per-agent invocation
 *   run_artifacts    — agent outputs (encrypted; embedded for similarity)
 *   gate_results     — phase-gate decisions (F6 GateResult shape)
 *   tool_calls       — tool invocations (encrypted I/O)
 *   agent_decisions  — orchestrator routing log (F6 AgentDecision shape)
 *
 * retrieveSimilarArtifacts() is the read path for memory-aware pipelines:
 * cosine similarity over `run_artifacts.embedding`, scoped by org_id for
 * multi-tenant isolation.
 */

import { randomUUID } from "node:crypto";
import { pool, query, queryOne } from "../db";
import { encrypt, safeDecrypt } from "../encryption";
import type { RunBudget } from "./budget-guard";
import type { ArtifactType } from "../eval/rubric-schema";
import type { ConfidenceField, GateResult, AgentDecision } from "../truth-first/artifact-schema";
import type { PipelinePhase } from "../../shared/agent-schema";

// ── Types ───────────────────────────────────────────────────────────────────

export type RunStatus =
  | "running"
  | "completed"
  | "failed"
  | "paused-budget"
  | "cancelled";

export type StepStatus = "running" | "completed" | "failed" | "skipped";

export interface CreateRunInput {
  runId?: string;
  userId: string;
  orgId?: string | null;
  deliveryOption?: string | null;
  budget: RunBudget;
  inputBrief: string;
  promptVersionSet?: Record<string, string>;
}

export interface PipelineRunRow {
  runId: string;
  userId: string;
  orgId: string | null;
  status: RunStatus;
  deliveryOption: string | null;
  budget: RunBudget;
  promptVersionSet: Record<string, string>;
  inputBrief: string;
  totalCostUSD: number;
  totalTokens: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface LogStepInput {
  stepId?: string;
  runId: string;
  agentId: string;
  stepIndex: number;
  promptVersion: string;
  inputPayload?: unknown;
}

export interface CompleteStepInput {
  stepId: string;
  status: StepStatus;
  outputPayload?: unknown;
  tokensIn?: number;
  tokensOut?: number;
  costUSD?: number;
  errorMessage?: string | null;
}

export interface RunStepRow {
  id: string;
  runId: string;
  agentId: string;
  stepIndex: number;
  status: StepStatus;
  inputPayload: unknown;
  outputPayload: unknown;
  promptVersion: string | null;
  startedAt: string;
  endedAt: string | null;
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  latencyMs: number | null;
  errorMessage: string | null;
}

export interface LogArtifactInput {
  artifactId?: string;
  runId: string;
  stepId?: string | null;
  orgId?: string | null;
  artifactType: ArtifactType;
  title?: string | null;
  payload: unknown;
  /** Optional: pre-computed embedding. If absent, artifact-embedder fills async. */
  embedding?: number[] | null;
  qualityScore?: number | null;
  rubricId?: string | null;
  evaluatorId?: string | null;
  confidence?: ConfidenceField | null;
}

export interface RunArtifactRow {
  id: string;
  runId: string;
  stepId: string | null;
  orgId: string | null;
  artifactType: ArtifactType;
  title: string | null;
  payload: unknown;
  qualityScore: number | null;
  rubricId: string | null;
  evaluatorId: string | null;
  confidenceLevel: string | null;
  confidenceReason: string | null;
  hasEmbedding: boolean;
  createdAt: string;
}

export interface SimilarArtifactRow extends RunArtifactRow {
  /** 0-1, higher = more similar (1 - cosine distance). */
  similarity: number;
}

export interface LogGateInput {
  runId: string;
  stepId?: string | null;
  gateId: string;
  phase: PipelinePhase;
  result: GateResult;
}

export interface LogToolCallInput {
  runId: string;
  stepId?: string | null;
  agentId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  costUSD?: number;
  errorMessage?: string | null;
}

// ── Run lifecycle ──────────────────────────────────────────────────────────

export async function createRun(input: CreateRunInput): Promise<string> {
  const runId = input.runId ?? randomUUID();
  await query(
    `INSERT INTO pipeline_runs
       (run_id, user_id, org_id, status, delivery_option, budget_json,
        prompt_version_set, input_brief_encrypted, input_brief_is_encrypted)
     VALUES ($1, $2, $3, 'running', $4, $5::jsonb, $6::jsonb, $7, TRUE)`,
    [
      runId,
      input.userId,
      input.orgId ?? null,
      input.deliveryOption ?? null,
      JSON.stringify(input.budget),
      JSON.stringify(input.promptVersionSet ?? {}),
      encrypt(input.inputBrief),
    ]
  );
  return runId;
}

export async function updateRunStatus(
  runId: string,
  status: RunStatus,
  errorMessage?: string | null
): Promise<void> {
  await query(
    `UPDATE pipeline_runs SET status = $2, error_message = $3 WHERE run_id = $1`,
    [runId, status, errorMessage ?? null]
  );
}

export async function completeRun(
  runId: string,
  status: Exclude<RunStatus, "running">,
  totals?: { costUSD?: number; tokens?: number; errorMessage?: string | null }
): Promise<void> {
  await query(
    `UPDATE pipeline_runs
        SET status = $2,
            completed_at = NOW(),
            total_cost_usd = COALESCE($3, total_cost_usd),
            total_tokens   = COALESCE($4, total_tokens),
            error_message  = COALESCE($5, error_message)
      WHERE run_id = $1`,
    [
      runId,
      status,
      totals?.costUSD ?? null,
      totals?.tokens ?? null,
      totals?.errorMessage ?? null,
    ]
  );
}

export async function getRun(runId: string): Promise<PipelineRunRow | null> {
  const r = await queryOne<any>(
    `SELECT run_id, user_id, org_id, status, delivery_option, budget_json,
            prompt_version_set, input_brief_encrypted, input_brief_is_encrypted,
            total_cost_usd, total_tokens, error_message, started_at, completed_at
       FROM pipeline_runs WHERE run_id = $1`,
    [runId]
  );
  if (!r) return null;
  return {
    runId: r.run_id,
    userId: r.user_id,
    orgId: r.org_id,
    status: r.status,
    deliveryOption: r.delivery_option,
    budget: r.budget_json as RunBudget,
    promptVersionSet: r.prompt_version_set ?? {},
    inputBrief: safeDecrypt(r.input_brief_encrypted, r.input_brief_is_encrypted),
    totalCostUSD: Number(r.total_cost_usd ?? 0),
    totalTokens: Number(r.total_tokens ?? 0),
    errorMessage: r.error_message,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  };
}

export async function listRuns(
  userId: string,
  opts?: { limit?: number; status?: RunStatus }
): Promise<PipelineRunRow[]> {
  const limit = opts?.limit ?? 50;
  const params: any[] = [userId, limit];
  let where = "user_id = $1";
  if (opts?.status) {
    where += " AND status = $3";
    params.push(opts.status);
  }
  const rows = await query<any>(
    `SELECT run_id, user_id, org_id, status, delivery_option, budget_json,
            prompt_version_set, input_brief_encrypted, input_brief_is_encrypted,
            total_cost_usd, total_tokens, error_message, started_at, completed_at
       FROM pipeline_runs WHERE ${where}
       ORDER BY started_at DESC LIMIT $2`,
    params
  );
  return rows.map((r) => ({
    runId: r.run_id,
    userId: r.user_id,
    orgId: r.org_id,
    status: r.status,
    deliveryOption: r.delivery_option,
    budget: r.budget_json as RunBudget,
    promptVersionSet: r.prompt_version_set ?? {},
    inputBrief: safeDecrypt(r.input_brief_encrypted, r.input_brief_is_encrypted),
    totalCostUSD: Number(r.total_cost_usd ?? 0),
    totalTokens: Number(r.total_tokens ?? 0),
    errorMessage: r.error_message,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }));
}

export async function getRunCost(runId: string): Promise<{ costUSD: number; tokens: number; calls: number }> {
  const r = await queryOne<any>(
    `SELECT COALESCE(SUM(cost_usd), 0)::float AS cost,
            COALESCE(SUM(tokens_in + tokens_out), 0)::int AS tokens,
            COUNT(*)::int AS calls
       FROM run_steps WHERE run_id = $1`,
    [runId]
  );
  return {
    costUSD: Number(r?.cost ?? 0),
    tokens: Number(r?.tokens ?? 0),
    calls: Number(r?.calls ?? 0),
  };
}

// ── Step lifecycle ─────────────────────────────────────────────────────────

export async function logStep(input: LogStepInput): Promise<string> {
  const id = input.stepId ?? randomUUID();
  await query(
    `INSERT INTO run_steps
       (id, run_id, agent_id, step_index, status, input_payload, prompt_version)
     VALUES ($1, $2, $3, $4, 'running', $5::jsonb, $6)`,
    [
      id,
      input.runId,
      input.agentId,
      input.stepIndex,
      JSON.stringify(input.inputPayload ?? null),
      input.promptVersion,
    ]
  );
  return id;
}

export async function completeStep(input: CompleteStepInput): Promise<void> {
  await query(
    `UPDATE run_steps
        SET status = $2,
            output_payload = $3::jsonb,
            tokens_in = COALESCE($4, tokens_in),
            tokens_out = COALESCE($5, tokens_out),
            cost_usd = COALESCE($6, cost_usd),
            error_message = COALESCE($7, error_message),
            ended_at = NOW(),
            latency_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
      WHERE id = $1`,
    [
      input.stepId,
      input.status,
      JSON.stringify(input.outputPayload ?? null),
      input.tokensIn ?? null,
      input.tokensOut ?? null,
      input.costUSD ?? null,
      input.errorMessage ?? null,
    ]
  );
}

export async function getRunSteps(runId: string): Promise<RunStepRow[]> {
  const rows = await query<any>(
    `SELECT id, run_id, agent_id, step_index, status,
            input_payload, output_payload, prompt_version,
            started_at, ended_at, tokens_in, tokens_out, cost_usd, latency_ms, error_message
       FROM run_steps WHERE run_id = $1 ORDER BY step_index ASC, started_at ASC`,
    [runId]
  );
  return rows.map((r) => ({
    id: r.id,
    runId: r.run_id,
    agentId: r.agent_id,
    stepIndex: r.step_index,
    status: r.status,
    inputPayload: r.input_payload,
    outputPayload: r.output_payload,
    promptVersion: r.prompt_version,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    tokensIn: Number(r.tokens_in ?? 0),
    tokensOut: Number(r.tokens_out ?? 0),
    costUSD: Number(r.cost_usd ?? 0),
    latencyMs: r.latency_ms != null ? Number(r.latency_ms) : null,
    errorMessage: r.error_message,
  }));
}

// ── Artifact lifecycle ─────────────────────────────────────────────────────

function payloadToString(payload: unknown): string {
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload);
}

function payloadFromString(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export async function logArtifact(input: LogArtifactInput): Promise<string> {
  const id = input.artifactId ?? randomUUID();
  const payloadStr = payloadToString(input.payload);
  const embeddingParam = input.embedding && input.embedding.length > 0
    ? JSON.stringify(input.embedding)
    : null;
  await query(
    `INSERT INTO run_artifacts
       (id, run_id, step_id, org_id, artifact_type, title,
        payload_encrypted, is_encrypted, embedding,
        quality_score, rubric_id, evaluator_id,
        confidence_level, confidence_reason)
     VALUES ($1, $2, $3, $4, $5, $6,
             $7, TRUE, $8::vector,
             $9, $10, $11,
             $12, $13)`,
    [
      id,
      input.runId,
      input.stepId ?? null,
      input.orgId ?? null,
      input.artifactType,
      input.title ?? null,
      encrypt(payloadStr),
      embeddingParam,
      input.qualityScore ?? null,
      input.rubricId ?? null,
      input.evaluatorId ?? null,
      input.confidence?.level ?? null,
      input.confidence?.reason ?? null,
    ]
  );
  return id;
}

/**
 * Update an artifact with a freshly-computed embedding. Used by the
 * artifact-embedder to fill in embeddings asynchronously.
 */
export async function setArtifactEmbedding(
  artifactId: string,
  embedding: number[]
): Promise<void> {
  await query(
    `UPDATE run_artifacts SET embedding = $2::vector WHERE id = $1`,
    [artifactId, JSON.stringify(embedding)]
  );
}

/**
 * Update an artifact with eval results (post-gate scoring).
 */
export async function setArtifactEval(
  artifactId: string,
  evalUpdate: {
    qualityScore: number;
    rubricId: string;
    evaluatorId: string;
    confidence?: ConfidenceField | null;
  }
): Promise<void> {
  await query(
    `UPDATE run_artifacts
        SET quality_score = $2,
            rubric_id = $3,
            evaluator_id = $4,
            confidence_level = COALESCE($5, confidence_level),
            confidence_reason = COALESCE($6, confidence_reason)
      WHERE id = $1`,
    [
      artifactId,
      evalUpdate.qualityScore,
      evalUpdate.rubricId,
      evalUpdate.evaluatorId,
      evalUpdate.confidence?.level ?? null,
      evalUpdate.confidence?.reason ?? null,
    ]
  );
}

function rowToArtifact(r: any): RunArtifactRow {
  return {
    id: r.id,
    runId: r.run_id,
    stepId: r.step_id,
    orgId: r.org_id,
    artifactType: r.artifact_type as ArtifactType,
    title: r.title,
    payload: payloadFromString(safeDecrypt(r.payload_encrypted, r.is_encrypted)),
    qualityScore: r.quality_score != null ? Number(r.quality_score) : null,
    rubricId: r.rubric_id,
    evaluatorId: r.evaluator_id,
    confidenceLevel: r.confidence_level,
    confidenceReason: r.confidence_reason,
    hasEmbedding: r.has_embedding === true,
    createdAt: r.created_at,
  };
}

export async function getRunArtifacts(runId: string): Promise<RunArtifactRow[]> {
  const rows = await query<any>(
    `SELECT id, run_id, step_id, org_id, artifact_type, title,
            payload_encrypted, is_encrypted,
            quality_score, rubric_id, evaluator_id,
            confidence_level, confidence_reason,
            (embedding IS NOT NULL) AS has_embedding,
            created_at
       FROM run_artifacts WHERE run_id = $1 ORDER BY created_at ASC`,
    [runId]
  );
  return rows.map(rowToArtifact);
}

/**
 * Cosine-similarity search over run_artifacts, scoped by org for
 * multi-tenant isolation. Returns rows ordered by similarity desc.
 *
 * If orgId is null, only artifacts with org_id IS NULL are returned —
 * never crosses tenant boundaries.
 */
export async function retrieveSimilarArtifacts(
  orgId: string | null,
  queryEmbedding: number[],
  artifactType: ArtifactType | null,
  limit: number = 10
): Promise<SimilarArtifactRow[]> {
  if (!queryEmbedding || queryEmbedding.length === 0) return [];
  const params: any[] = [JSON.stringify(queryEmbedding), limit];
  let where = "embedding IS NOT NULL";
  if (orgId === null) {
    where += " AND org_id IS NULL";
  } else {
    params.push(orgId);
    where += ` AND org_id = $${params.length}`;
  }
  if (artifactType) {
    params.push(artifactType);
    where += ` AND artifact_type = $${params.length}`;
  }
  const rows = await query<any>(
    `SELECT id, run_id, step_id, org_id, artifact_type, title,
            payload_encrypted, is_encrypted,
            quality_score, rubric_id, evaluator_id,
            confidence_level, confidence_reason,
            TRUE AS has_embedding,
            created_at,
            1 - (embedding <=> $1::vector) AS similarity
       FROM run_artifacts
       WHERE ${where}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
    params
  );
  return rows.map((r) => ({ ...rowToArtifact(r), similarity: Number(r.similarity) }));
}

// ── Gate results ───────────────────────────────────────────────────────────

export async function logGateResult(input: LogGateInput): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO gate_results
       (id, run_id, step_id, gate_id, phase, passed, requires_human_review,
        confidence_level, confidence_reason, checks_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
    [
      id,
      input.runId,
      input.stepId ?? null,
      input.gateId,
      input.phase,
      input.result.passed,
      input.result.requiresHumanReview,
      input.result.confidence.level,
      input.result.confidence.reason,
      JSON.stringify(input.result.checks),
    ]
  );
  return id;
}

// ── Tool calls ─────────────────────────────────────────────────────────────

export async function logToolCall(input: LogToolCallInput): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO tool_calls
       (id, run_id, step_id, agent_id, tool_name,
        input_encrypted, output_encrypted, is_encrypted,
        duration_ms, cost_usd, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10)`,
    [
      id,
      input.runId,
      input.stepId ?? null,
      input.agentId,
      input.toolName,
      input.input != null ? encrypt(payloadToString(input.input)) : null,
      input.output != null ? encrypt(payloadToString(input.output)) : null,
      input.durationMs ?? null,
      input.costUSD ?? 0,
      input.errorMessage ?? null,
    ]
  );
  return id;
}

// ── Agent decisions (orchestrator routing log) ─────────────────────────────

export async function logDecision(runId: string, decision: AgentDecision): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO agent_decisions
       (id, run_id, question_encrypted, decision_encrypted, reasoning_encrypted,
        is_encrypted, confidence_level, confidence_reason_encrypted, reversible)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8)`,
    [
      id,
      runId,
      encrypt(decision.question),
      encrypt(decision.decision),
      encrypt(decision.reasoning),
      decision.confidence.level,
      encrypt(decision.confidence.reason),
      decision.reversible,
    ]
  );
  return id;
}

// ── Test/cleanup helper (used by tests, not production code paths) ─────────

/** Delete a run and all its child rows. Hard-delete; not undoable. */
export async function _deleteRunForTest(runId: string): Promise<void> {
  // We don't have FK cascades on these tables (deliberately — runs are an
  // audit trail). Manual cleanup for tests only.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM agent_decisions WHERE run_id = $1", [runId]);
    await client.query("DELETE FROM tool_calls WHERE run_id = $1", [runId]);
    await client.query("DELETE FROM gate_results WHERE run_id = $1", [runId]);
    await client.query("DELETE FROM run_artifacts WHERE run_id = $1", [runId]);
    await client.query("DELETE FROM run_steps WHERE run_id = $1", [runId]);
    await client.query("DELETE FROM pipeline_runs WHERE run_id = $1", [runId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
