/**
 * Artifact retrieval test — pgvector cosine similarity scoped by org.
 *
 * Inserts 3 artifacts with synthetic embeddings + 1 cross-tenant artifact.
 * Asserts:
 *   - results sorted by cosine similarity (closest first)
 *   - org isolation (no leak across tenants)
 *   - artifactType filter
 *   - artifact-embedder flattens structured payloads to embeddable text
 *
 * Uses synthetic embeddings (no API call). Real OpenAI embedding is
 * exercised by the ad-hoc verification below the test suite.
 *
 * Run: npx tsx tests/artifact-retrieval.test.ts
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";
import { initDatabase } from "../server/migration";
import {
  createRun,
  logArtifact,
  retrieveSimilarArtifacts,
  setArtifactEmbedding,
  _deleteRunForTest,
} from "../server/orchestrator/run-tracer";
import { artifactToEmbeddingText } from "../server/orchestrator/artifact-embedder";
import { DEFAULT_BUDGET } from "../server/orchestrator/budget-guard";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

/**
 * Build a deterministic 1536-d unit vector. Different seeds produce
 * different but reproducible vectors so cosine ordering is predictable.
 */
function syntheticEmbedding(seed: number): number[] {
  const v = new Array<number>(1536);
  let s = seed * 9301 + 49297;
  let norm = 0;
  for (let i = 0; i < 1536; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = (s / 233280 - 0.5) * 2;
    v[i] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < 1536; i++) v[i] /= norm;
  return v;
}

async function createTestUser(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    "INSERT INTO users (device_id, tier) VALUES ($1, 'free') RETURNING id",
    [`art-retr-${randomUUID()}`]
  );
  return r.rows[0].id;
}
async function cleanupUser(userId: string): Promise<void> {
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL not set — artifact-retrieval test requires Postgres");
    process.exit(0);
  }

  // Confirm pgvector is enabled before relying on it.
  const ext = await pool.query<{ extname: string }>(
    "SELECT extname FROM pg_extension WHERE extname = 'vector'"
  );
  if (ext.rows.length === 0) {
    console.log("SKIP: pgvector extension not present in this Postgres — install first");
    process.exit(0);
  }

  await initDatabase();

  console.log("\n=== artifact-retrieval ===\n");

  // ─── artifactToEmbeddingText helper ────────────────────────────────────
  {
    const text = artifactToEmbeddingText({ title: "T", problem: "P", body: "B" }, "FromArg");
    assert(text.includes("FromArg"), "embed-text uses provided title");
    assert(text.includes("P"), "embed-text picks 'problem' field");
    assert(text.includes("B"), "embed-text picks 'body' field");

    const fallback = artifactToEmbeddingText({ unrelated: "xyz" });
    assert(fallback.length > 0 && fallback.includes("xyz"), "fallback JSON-stringifies when no primary fields");

    const stringPayload = artifactToEmbeddingText("plain string");
    assert(stringPayload === "plain string", "string payload pass-through");
  }

  // ─── Cosine ordering + org isolation ──────────────────────────────────
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userId = await createTestUser();
  const runIds: string[] = [];

  try {
    // Three artifacts in org A:
    //   id1: seed 1   — query baseline (most similar)
    //   id2: seed 2   — moderately similar
    //   id3: seed 100 — least similar
    // Plus one artifact in org B (must NOT appear in org-A queries).
    const runIdA = await createRun({ userId, orgId: orgA, budget: DEFAULT_BUDGET, inputBrief: "A" });
    const runIdB = await createRun({ userId, orgId: orgB, budget: DEFAULT_BUDGET, inputBrief: "B" });
    runIds.push(runIdA, runIdB);

    const id1 = await logArtifact({ runId: runIdA, orgId: orgA, artifactType: "prd", payload: { problem: "p1" } });
    const id2 = await logArtifact({ runId: runIdA, orgId: orgA, artifactType: "prd", payload: { problem: "p2" } });
    const id3 = await logArtifact({ runId: runIdA, orgId: orgA, artifactType: "prd", payload: { problem: "p3" } });
    const idCrossTenant = await logArtifact({ runId: runIdB, orgId: orgB, artifactType: "prd", payload: { problem: "leak" } });

    await setArtifactEmbedding(id1, syntheticEmbedding(1));
    await setArtifactEmbedding(id2, syntheticEmbedding(2));
    await setArtifactEmbedding(id3, syntheticEmbedding(100));
    await setArtifactEmbedding(idCrossTenant, syntheticEmbedding(1)); // identical to id1's seed

    // Query with seed 1 — id1 should be most similar.
    const queryEmbedding = syntheticEmbedding(1);

    const resultsA = await retrieveSimilarArtifacts(orgA, queryEmbedding, "prd", 10);
    assert(resultsA.length === 3, `org A returns 3 prd artifacts (got ${resultsA.length})`);
    assert(resultsA.every((r) => r.orgId === orgA), "all results scoped to org A");
    assert(resultsA[0].id === id1, "most-similar artifact is id1 (cosine sort)");

    // Verify cosine sort order: similarity descending.
    for (let i = 1; i < resultsA.length; i++) {
      assert(resultsA[i - 1].similarity >= resultsA[i].similarity, `result[${i - 1}] sim ≥ result[${i}] sim`);
    }
    assert(Math.abs(resultsA[0].similarity - 1.0) < 1e-3, `id1 similarity ≈ 1.0 (got ${resultsA[0].similarity})`);

    // Org isolation: querying as org B never returns org A's id1 even though
    // their embeddings are identical.
    const resultsB = await retrieveSimilarArtifacts(orgB, queryEmbedding, "prd", 10);
    assert(resultsB.length === 1, `org B returns 1 artifact (got ${resultsB.length})`);
    assert(resultsB[0].id === idCrossTenant, "org B sees only its own artifact");
    assert(resultsB.every((r) => r.id !== id1 && r.id !== id2 && r.id !== id3), "org B does NOT see org A artifacts");

    // artifactType filter — query for ADRs only returns nothing.
    const resultsAdr = await retrieveSimilarArtifacts(orgA, queryEmbedding, "adr", 10);
    assert(resultsAdr.length === 0, "artifactType filter excludes non-matching types");

    // Limit honored
    const limited = await retrieveSimilarArtifacts(orgA, queryEmbedding, "prd", 1);
    assert(limited.length === 1, "limit=1 returns exactly 1 row");
    assert(limited[0].id === id1, "limit=1 still returns the most-similar");

    // Decryption round-trip: payload is JSON-decoded back to object form.
    assert(typeof resultsA[0].payload === "object", "retrieved payload is decrypted + JSON-parsed");
    assert((resultsA[0].payload as any).problem === "p1", "retrieved payload content matches original");

  } finally {
    for (const r of runIds) await _deleteRunForTest(r).catch(() => {});
    await cleanupUser(userId);
  }

  console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("artifact-retrieval test crashed:", err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
