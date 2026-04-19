import { Router } from "express";
import type { Response } from "express";
import { requireAuth, budgetCheck } from "../middleware";
import {
  runPipeline,
  ConcurrencyExceededError,
  type PipelineEvent,
  type PipelineInput,
  type PipelineStatus,
} from "../orchestrator/pipeline-engine";
import {
  getRun,
  listRuns,
  getRunArtifacts,
  updateRunStatus,
} from "../orchestrator/run-tracer";
import { releaseRunSlot } from "../orchestrator/concurrency-guard";

export const pipelineRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

function startSseResponse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

function emitSse(res: Response, event: PipelineEvent | { type: string; [k: string]: unknown }): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function endSse(res: Response): void {
  res.write("data: [DONE]\n\n");
  res.end();
}

async function runPipelineToSse(res: Response, input: PipelineInput): Promise<void> {
  startSseResponse(res);
  try {
    const result = await runPipeline({
      ...input,
      emit: (event) => {
        try { emitSse(res, event); } catch { /* client may have hung up */ }
      },
    });
    emitSse(res, { type: "result", ...result });
    endSse(res);
  } catch (err) {
    if (err instanceof ConcurrencyExceededError) {
      emitSse(res, {
        type: "concurrency_exceeded",
        currentRuns: err.currentRuns,
        maxRuns: err.maxRuns,
        tier: err.tier,
      });
      endSse(res);
      return;
    }
    const msg = (err as Error)?.message ?? String(err);
    emitSse(res, { type: "pipeline_error", message: msg });
    endSse(res);
  }
}

// ── POST /api/pipeline/start ──────────────────────────────────────────────
//
// Body: { brief: string, deliveryOption?: string, budget?: RunBudget }
// SSE response — events from the pipeline engine, ending with a `result`
// event and `[DONE]`.

pipelineRouter.post("/pipeline/start", requireAuth, budgetCheck, async (req, res) => {
  const { brief, deliveryOption, budget } = (req.body ?? {}) as {
    brief?: string;
    deliveryOption?: string;
    budget?: PipelineInput["budget"];
  };
  if (!brief || typeof brief !== "string" || brief.trim().length === 0) {
    return res.status(400).json({ error: "brief is required" });
  }

  // Concurrency-guard tier resolution happens INSIDE runPipeline. We let
  // it throw ConcurrencyExceededError; the SSE wrapper catches and emits.
  // This means free-tier 2nd-run rejection arrives as an SSE event, NOT
  // a 429. Callers of /api/pipeline/start should respect the
  // concurrency_exceeded event before treating the stream as live.
  return runPipelineToSse(res, {
    userId: req.userId!,
    orgId: null, // orgs not modelled yet; falls through concurrency-guard
    brief: brief.trim(),
    deliveryOption: deliveryOption ?? null,
    budget,
  });
});

// ── GET /api/pipeline/runs ────────────────────────────────────────────────

pipelineRouter.get("/pipeline/runs", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const status = (req.query.status as PipelineStatus | undefined) ?? undefined;
    const runs = await listRuns(req.userId!, { limit, status });
    res.json(runs);
  } catch (err) {
    console.error("List runs error:", err);
    res.status(500).json({ error: "Failed to list runs" });
  }
});

// ── GET /api/pipeline/runs/:id ────────────────────────────────────────────

pipelineRouter.get("/pipeline/runs/:id", requireAuth, async (req, res) => {
  try {
    const run = await getRun(req.params.id as string);
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (run.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    res.json(run);
  } catch (err) {
    console.error("Get run error:", err);
    res.status(500).json({ error: "Failed to fetch run" });
  }
});

// ── GET /api/pipeline/runs/:id/artifacts ──────────────────────────────────

pipelineRouter.get("/pipeline/runs/:id/artifacts", requireAuth, async (req, res) => {
  try {
    const run = await getRun(req.params.id as string);
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (run.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    const artifacts = await getRunArtifacts(req.params.id as string);
    res.json(artifacts);
  } catch (err) {
    console.error("Get artifacts error:", err);
    res.status(500).json({ error: "Failed to fetch artifacts" });
  }
});

// ── POST /api/pipeline/runs/:id/resume (SSE) ──────────────────────────────

pipelineRouter.post("/pipeline/runs/:id/resume", requireAuth, budgetCheck, async (req, res) => {
  const run = await getRun(req.params.id as string);
  if (!run) return res.status(404).json({ error: "Run not found" });
  if (run.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  if (run.status !== "paused-gate" && run.status !== "paused-budget") {
    return res.status(409).json({ error: `Cannot resume — current status is "${run.status}"` });
  }

  // Move back into running state so the concurrency guard can re-acquire.
  // (releaseRunSlot is a no-op for a slot that doesn't exist.)
  await updateRunStatus(req.params.id as string, "running");

  return runPipelineToSse(res, {
    userId: req.userId!,
    orgId: run.orgId,
    brief: run.inputBrief,
    deliveryOption: run.deliveryOption,
    budget: run.budget,
    existingRunId: run.runId,
    // Resume from discovery for now — orchestrator deduplicates by phase
    // index against accumulated artifacts in v2. v1 simply re-runs from
    // the start, but agents see prior artifacts via similarity retrieval.
    startFromPhase: "discovery",
  });
});

// ── POST /api/pipeline/runs/:id/cancel ────────────────────────────────────

pipelineRouter.post("/pipeline/runs/:id/cancel", requireAuth, async (req, res) => {
  try {
    const run = await getRun(req.params.id as string);
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (run.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    if (run.status === "completed" || run.status === "cancelled" || run.status === "failed") {
      return res.status(409).json({ error: `Cannot cancel — current status is "${run.status}"` });
    }
    await updateRunStatus(req.params.id as string, "cancelled" as never, "cancelled by user");
    await releaseRunSlot(req.userId!, req.params.id as string).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error("Cancel run error:", err);
    res.status(500).json({ error: "Failed to cancel run" });
  }
});
