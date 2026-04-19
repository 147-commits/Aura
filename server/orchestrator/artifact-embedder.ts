/**
 * Artifact embedder — async embedding for run_artifacts.
 *
 * Pipeline agents log their artifacts via run-tracer.logArtifact() WITHOUT
 * blocking on embedding. This module then:
 *   1. Picks the artifact id off an in-process queue
 *   2. Computes the embedding via embedding-engine
 *   3. Writes it back via setArtifactEmbedding()
 *
 * Single-flight per artifact id — duplicate enqueues are coalesced. Failures
 * are logged but do not throw upstream; the artifact stays embeddable on
 * the next attempt (manually or via a future re-index).
 *
 * Stringification: structured artifacts are flattened to a representative
 * text blob before embedding (title + key fields concatenated). The
 * embedding is computed on the plaintext IN MEMORY before encryption ever
 * happens; nothing on disk leaks the literal text.
 */

import { embedText } from "../embedding-engine";
import { setArtifactEmbedding } from "./run-tracer";

// ── In-process queue ───────────────────────────────────────────────────────

const inflight = new Map<string, Promise<void>>();

/**
 * Flatten any artifact payload to the text we want to embed.
 *
 * Strings pass through. Objects: prefer common fields (title, summary,
 * problem, vision, decision, content) then fall back to JSON.
 */
export function artifactToEmbeddingText(payload: unknown, title?: string | null): string {
  const parts: string[] = [];
  if (title && typeof title === "string") parts.push(title);

  if (typeof payload === "string") {
    parts.push(payload);
  } else if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const PRIMARY_KEYS = [
      "title", "name", "vision", "problem", "decision",
      "summary", "abstract", "context", "content", "body",
    ];
    for (const k of PRIMARY_KEYS) {
      const v = obj[k];
      if (typeof v === "string" && v.length > 0) parts.push(v);
    }
    // Fall back to a JSON dump if we still have nothing useful — capped
    // at 8000 chars so we don't ship a giant blob to the embedding API.
    if (parts.length === (title ? 1 : 0)) {
      try {
        parts.push(JSON.stringify(payload).slice(0, 8000));
      } catch {
        parts.push(String(payload));
      }
    }
  } else if (payload != null) {
    parts.push(String(payload));
  }

  // Embedding API limit safety mirrors embedding-engine.ts (8000 chars).
  return parts.join("\n\n").slice(0, 8000);
}

/**
 * Compute and store the embedding for an artifact. Idempotent per artifact id
 * within a single process — concurrent enqueues share the same Promise.
 *
 * Fire-and-forget callers should still attach a `.catch()` if they want to
 * see embed failures; this function never throws into the caller's
 * unhandled-rejection path beyond what they choose to await.
 */
export function embedArtifact(
  artifactId: string,
  payload: unknown,
  opts?: { title?: string | null }
): Promise<void> {
  const existing = inflight.get(artifactId);
  if (existing) return existing;

  const task = (async () => {
    const text = artifactToEmbeddingText(payload, opts?.title ?? null);
    if (!text) {
      console.warn(`[artifact-embedder] artifact ${artifactId} has no embeddable text — skipping`);
      return;
    }
    try {
      const vector = await embedText(text);
      await setArtifactEmbedding(artifactId, vector);
    } catch (err) {
      console.error(`[artifact-embedder] failed to embed ${artifactId}:`, (err as Error)?.message ?? err);
      // Don't rethrow — embedder is best-effort. Artifact stays in DB
      // without an embedding; a re-index can fix it later.
    }
  })().finally(() => inflight.delete(artifactId));

  inflight.set(artifactId, task);
  return task;
}

/**
 * Test-only helper: drain all in-flight embedding tasks. Production code
 * should never need this; tests use it to await async embeddings before
 * asserting.
 */
export async function _waitForAllEmbeddingsForTest(): Promise<void> {
  const tasks = Array.from(inflight.values());
  await Promise.allSettled(tasks);
}

/** Test-only: number of artifacts currently being embedded. */
export function _inflightCountForTest(): number {
  return inflight.size;
}
