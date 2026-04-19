/**
 * Concurrency guard — caps the number of pipeline runs a user (or org)
 * can have in flight at once.
 *
 * Backed by the `active_runs` table. Slot acquisition is atomic via a
 * transaction: we count the user's current live rows, compare against the
 * tier cap, and insert the new row all under a single transaction + row
 * lock so two parallel acquires can't both succeed above the cap.
 *
 * Tiers:
 *   free       = 1 concurrent run
 *   paid       = 3 concurrent runs
 *   enterprise = 10 concurrent runs
 *
 * Tier defaults to the user's `users.tier` column (added by migration.ts).
 * If a future org model lands, orgId takes precedence.
 */

import { pool } from "../db";

export type SubscriptionTier = "free" | "paid" | "enterprise";

export const CONCURRENCY_LIMITS: Record<SubscriptionTier, number> = {
  free: 1,
  paid: 3,
  enterprise: 10,
};

export interface AcquireResult {
  acquired: boolean;
  currentRuns: number;
  maxRuns: number;
  tier: SubscriptionTier;
}

/** True if `v` is a known tier. */
function isTier(v: unknown): v is SubscriptionTier {
  return v === "free" || v === "paid" || v === "enterprise";
}

/** Look up the user's tier. Default 'free' when missing or unknown. */
async function resolveTier(
  client: { query: (q: string, p?: any[]) => Promise<any> },
  userId: string,
  orgId: string | null | undefined
): Promise<SubscriptionTier> {
  // Orgs aren't modelled yet; when an orgs table lands, check org.tier first.
  void orgId;
  const r = await client.query(
    "SELECT tier FROM users WHERE id = $1",
    [userId]
  );
  const raw = r.rows?.[0]?.tier;
  return isTier(raw) ? raw : "free";
}

/**
 * Try to acquire a run slot for `userId` (optionally scoped to `orgId`).
 * Atomic: a parallel caller cannot squeeze past the limit.
 *
 * The new row is inserted with `run_id` — caller provides a fresh UUID so
 * release can target it without a SELECT.
 */
export async function acquireRunSlot(
  userId: string,
  orgId: string | null | undefined,
  runId: string
): Promise<AcquireResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tier = await resolveTier(client, userId, orgId);
    const maxRuns = CONCURRENCY_LIMITS[tier];

    // Lock the user's current active rows for the duration of the tx.
    // Postgres SELECT ... FOR UPDATE on the user's row set prevents a
    // parallel acquire from reading a stale count.
    const countRes = await client.query(
      "SELECT run_id FROM active_runs WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const currentRuns = countRes.rows.length;

    if (currentRuns >= maxRuns) {
      await client.query("ROLLBACK");
      return { acquired: false, currentRuns, maxRuns, tier };
    }

    await client.query(
      `INSERT INTO active_runs (run_id, user_id, org_id, status)
       VALUES ($1, $2, $3, 'running')`,
      [runId, userId, orgId ?? null]
    );
    await client.query("COMMIT");
    return { acquired: true, currentRuns: currentRuns + 1, maxRuns, tier };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Release a previously-acquired slot. Safe to call even if already released. */
export async function releaseRunSlot(userId: string, runId: string): Promise<void> {
  await pool.query(
    "DELETE FROM active_runs WHERE run_id = $1 AND user_id = $2",
    [runId, userId]
  );
}

/**
 * Inspect current concurrency state without acquiring. Useful for UI.
 */
export async function inspectRunSlots(
  userId: string,
  orgId?: string | null
): Promise<{ currentRuns: number; maxRuns: number; tier: SubscriptionTier }> {
  const client = await pool.connect();
  try {
    const tier = await resolveTier(client, userId, orgId ?? null);
    const r = await client.query(
      "SELECT COUNT(*)::int AS n FROM active_runs WHERE user_id = $1",
      [userId]
    );
    return { currentRuns: r.rows[0]?.n ?? 0, maxRuns: CONCURRENCY_LIMITS[tier], tier };
  } finally {
    client.release();
  }
}
