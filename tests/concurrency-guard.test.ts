/**
 * Concurrency-guard integration test — touches the real Postgres.
 *
 * Creates throwaway users in the `users` table with unique device_ids,
 * runs the acquire/release flow, and cleans up after itself. Each test
 * uses a fresh user so parallel CI runs don't collide.
 *
 * Run: npx tsx tests/concurrency-guard.test.ts
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";
import { initDatabase } from "../server/migration";
import {
  acquireRunSlot,
  releaseRunSlot,
  inspectRunSlots,
  CONCURRENCY_LIMITS,
  type SubscriptionTier,
} from "../server/orchestrator/concurrency-guard";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.error(`FAIL: ${label}`); failed++; process.exitCode = 1; }
}

async function createTestUser(tier: SubscriptionTier): Promise<string> {
  const deviceId = `cg-test-${randomUUID()}`;
  const r = await pool.query<{ id: string }>(
    "INSERT INTO users (device_id, tier) VALUES ($1, $2) RETURNING id",
    [deviceId, tier]
  );
  return r.rows[0].id;
}

async function cleanupUser(userId: string): Promise<void> {
  // ON DELETE CASCADE takes care of active_runs rows.
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL not set — concurrency-guard test requires Postgres");
    process.exit(0);
  }

  // Ensure tables exist (idempotent).
  await initDatabase();

  console.log("\n=== ConcurrencyGuard ===\n");

  assert(CONCURRENCY_LIMITS.free === 1, "free tier limit = 1");
  assert(CONCURRENCY_LIMITS.paid === 3, "paid tier limit = 3");
  assert(CONCURRENCY_LIMITS.enterprise === 10, "enterprise tier limit = 10");

  // ─── Free tier: first slot acquired, second refused ───────────────────
  {
    const userId = await createTestUser("free");
    try {
      const runId1 = randomUUID();
      const a1 = await acquireRunSlot(userId, null, runId1);
      assert(a1.acquired === true, "free: first slot acquired");
      assert(a1.currentRuns === 1, `free: currentRuns=1 after first (got ${a1.currentRuns})`);
      assert(a1.maxRuns === 1, "free: maxRuns=1");
      assert(a1.tier === "free", "free: tier echoed back");

      const runId2 = randomUUID();
      const a2 = await acquireRunSlot(userId, null, runId2);
      assert(a2.acquired === false, "free: second slot refused");
      assert(a2.currentRuns === 1, "free: second acquire does not increment count");

      // Release the first and try again
      await releaseRunSlot(userId, runId1);
      const a3 = await acquireRunSlot(userId, null, runId2);
      assert(a3.acquired === true, "free: third acquire succeeds after release");

      await releaseRunSlot(userId, runId2);
      const after = await inspectRunSlots(userId);
      assert(after.currentRuns === 0, "free: release cleans up");
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── Paid tier: 3 allowed, 4th refused ─────────────────────────────────
  {
    const userId = await createTestUser("paid");
    const runIds: string[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const runId = randomUUID();
        runIds.push(runId);
        const a = await acquireRunSlot(userId, null, runId);
        assert(a.acquired === true, `paid: slot ${i + 1} of 3 acquired`);
      }
      const fourth = await acquireRunSlot(userId, null, randomUUID());
      assert(fourth.acquired === false, "paid: 4th slot refused");
      assert(fourth.maxRuns === 3, "paid: maxRuns = 3");
    } finally {
      for (const runId of runIds) await releaseRunSlot(userId, runId).catch(() => {});
      await cleanupUser(userId);
    }
  }

  // ─── Unknown user (tier column absent / row missing) defaults to free ──
  {
    const userId = await createTestUser("free");
    // Null out tier to exercise the fallback path.
    await pool.query("UPDATE users SET tier = NULL WHERE id = $1", [userId]);
    try {
      const a = await acquireRunSlot(userId, null, randomUUID());
      assert(a.acquired === true, "null-tier: first slot acquired");
      assert(a.tier === "free", "null-tier: falls back to 'free'");
    } finally {
      await cleanupUser(userId);
    }
  }

  // ─── inspectRunSlots reports correctly ─────────────────────────────────
  {
    const userId = await createTestUser("paid");
    const runId = randomUUID();
    try {
      const before = await inspectRunSlots(userId);
      assert(before.currentRuns === 0, "inspect: 0 runs before acquire");
      assert(before.maxRuns === 3, "inspect: paid maxRuns = 3");
      await acquireRunSlot(userId, null, runId);
      const during = await inspectRunSlots(userId);
      assert(during.currentRuns === 1, "inspect: 1 run after acquire");
    } finally {
      await releaseRunSlot(userId, runId).catch(() => {});
      await cleanupUser(userId);
    }
  }

  // ─── releaseRunSlot is idempotent ──────────────────────────────────────
  {
    const userId = await createTestUser("free");
    const runId = randomUUID();
    try {
      await acquireRunSlot(userId, null, runId);
      await releaseRunSlot(userId, runId);
      // second release should not throw
      await releaseRunSlot(userId, runId);
      const after = await inspectRunSlots(userId);
      assert(after.currentRuns === 0, "release: idempotent — second call no-ops");
    } finally {
      await cleanupUser(userId);
    }
  }

  console.log(`\n=== ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("concurrency-guard test crashed:", err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
