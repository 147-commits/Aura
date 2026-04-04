/**
 * Memory Consolidator — background memory cleanup inspired by Claude Code's autoDream.
 *
 * Runs periodically (not every request) in 4 phases:
 *   1. ORIENT — check if consolidation is needed
 *   2. GATHER — fetch, group, find duplicates/contradictions
 *   3. CONSOLIDATE — merge duplicates, resolve contradictions via GPT-4o-mini
 *   4. PRUNE — delete merged memories, cap at 100 per user
 *
 * Trigger: every 10th API request from a user, async (never blocks).
 * All actions logged for audit trail.
 */

import { query, queryOne } from "./db";
import { getOpenAI } from "./ai-provider";
import { encrypt } from "./encryption";

const MAX_MEMORIES_PER_USER = 100;
const MIN_HOURS_BETWEEN_RUNS = 24;
const MIN_NEW_MEMORIES = 5;

export interface ConsolidationLog {
  action: "merged" | "contradiction_resolved" | "pruned";
  details: string;
  timestamp: string;
}

// ── Request Counter (in-memory, per user) ───────────────────────────────────

const requestCounts = new Map<string, number>();

/**
 * Increment request counter for a user.
 * Returns true every 10th request (trigger consolidation check).
 */
export function shouldCheckConsolidation(userId: string): boolean {
  const count = (requestCounts.get(userId) || 0) + 1;
  requestCounts.set(userId, count);
  return count % 10 === 0;
}

// ── Phase 1: ORIENT ─────────────────────────────────────────────────────────

async function shouldConsolidate(userId: string): Promise<boolean> {
  const user = await queryOne<any>(
    "SELECT last_memory_consolidation, memory_count FROM users WHERE id = $1",
    [userId]
  );

  if (!user) return false;

  const lastRun = user.last_memory_consolidation
    ? new Date(user.last_memory_consolidation).getTime()
    : 0;
  const hoursSinceLastRun = (Date.now() - lastRun) / (1000 * 60 * 60);

  if (hoursSinceLastRun < MIN_HOURS_BETWEEN_RUNS) return false;

  // Count current memories
  const countResult = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM memories WHERE user_id = $1",
    [userId]
  );
  const currentCount = parseInt(countResult?.count || "0");

  // Update stored count
  await query("UPDATE users SET memory_count = $1 WHERE id = $2", [currentCount, userId]);

  const previousCount = user.memory_count || 0;
  const newMemories = currentCount - previousCount;

  return newMemories >= MIN_NEW_MEMORIES || currentCount > MAX_MEMORIES_PER_USER;
}

// ── Phase 2: GATHER ─────────────────────────────────────────────────────────

interface MemoryRecord {
  id: string;
  text: string;
  category: string;
  confidence: string;
  createdAt: string;
}

async function gatherMemories(userId: string): Promise<{
  memories: MemoryRecord[];
  byCategory: Record<string, MemoryRecord[]>;
  duplicates: [MemoryRecord, MemoryRecord][];
  contradictions: [MemoryRecord, MemoryRecord][];
}> {
  const rows = await query<any>(
    `SELECT id, encrypted_text, is_encrypted, category, confidence, created_at
     FROM memories WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  // Decrypt texts
  const { safeDecrypt } = await import("./encryption");
  const memories: MemoryRecord[] = rows.map((r) => ({
    id: r.id,
    text: safeDecrypt(r.encrypted_text, r.is_encrypted),
    category: r.category,
    confidence: r.confidence || "Medium",
    createdAt: r.created_at,
  }));

  // Group by category
  const byCategory: Record<string, MemoryRecord[]> = {};
  for (const m of memories) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  }

  // Find duplicates (simple word overlap > 60%)
  const duplicates: [MemoryRecord, MemoryRecord][] = [];
  const contradictions: [MemoryRecord, MemoryRecord][] = [];

  for (const [, group] of Object.entries(byCategory)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const similarity = computeSimilarity(group[i].text, group[j].text);
        if (similarity > 0.6) {
          duplicates.push([group[i], group[j]]);
        } else if (similarity > 0.3 && looksContradictory(group[i].text, group[j].text)) {
          contradictions.push([group[i], group[j]]);
        }
      }
    }
  }

  return { memories, byCategory, duplicates, contradictions };
}

function computeSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function looksContradictory(a: string, b: string): boolean {
  const negators = ["not", "don't", "doesn't", "no longer", "stopped", "quit", "changed", "switched"];
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  return negators.some((n) =>
    (aLower.includes(n) && !bLower.includes(n)) || (!aLower.includes(n) && bLower.includes(n))
  );
}

// ── Phase 3: CONSOLIDATE ────────────────────────────────────────────────────

async function consolidate(
  userId: string,
  duplicates: [MemoryRecord, MemoryRecord][],
  contradictions: [MemoryRecord, MemoryRecord][]
): Promise<ConsolidationLog[]> {
  const logs: ConsolidationLog[] = [];
  const toDelete: string[] = [];

  // Merge duplicates
  for (const [a, b] of duplicates.slice(0, 10)) { // Cap at 10 per run
    try {
      const openai = getOpenAI();
      const result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Merge these two similar memories into one concise memory that captures all information. Return ONLY the merged text, nothing else.\n\nMemory 1: "${a.text}"\nMemory 2: "${b.text}"`,
        }],
        max_completion_tokens: 100,
      });

      const merged = result.choices[0]?.message?.content?.trim();
      if (merged) {
        // Keep the newer one, update its text, delete the older
        const keep = new Date(a.createdAt) > new Date(b.createdAt) ? a : b;
        const remove = keep === a ? b : a;

        await query(
          "UPDATE memories SET encrypted_text = $1, is_encrypted = TRUE WHERE id = $2",
          [encrypt(merged), keep.id]
        );
        toDelete.push(remove.id);

        logs.push({
          action: "merged",
          details: `Merged memories ${a.id} and ${b.id} into ${keep.id}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn("[consolidator] Merge failed:", err);
    }
  }

  // Resolve contradictions (keep newer, delete older)
  for (const [a, b] of contradictions.slice(0, 5)) {
    const newer = new Date(a.createdAt) > new Date(b.createdAt) ? a : b;
    const older = newer === a ? b : a;
    toDelete.push(older.id);

    logs.push({
      action: "contradiction_resolved",
      details: `Resolved contradiction: kept ${newer.id} (newer), deleted ${older.id}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Delete all marked memories
  if (toDelete.length > 0) {
    await query(
      `DELETE FROM memories WHERE id = ANY($1)`,
      [toDelete]
    );
  }

  return logs;
}

// ── Phase 4: PRUNE ──────────────────────────────────────────────────────────

async function prune(userId: string): Promise<ConsolidationLog[]> {
  const logs: ConsolidationLog[] = [];

  const countResult = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM memories WHERE user_id = $1",
    [userId]
  );
  const count = parseInt(countResult?.count || "0");

  if (count > MAX_MEMORIES_PER_USER) {
    const excess = count - MAX_MEMORIES_PER_USER;
    // Delete oldest, lowest confidence memories
    const toDelete = await query<{ id: string }>(
      `SELECT id FROM memories WHERE user_id = $1
       ORDER BY
         CASE confidence WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END ASC,
         created_at ASC
       LIMIT $2`,
      [userId, excess]
    );

    if (toDelete.length > 0) {
      const ids = toDelete.map((r) => r.id);
      await query("DELETE FROM memories WHERE id = ANY($1)", [ids]);

      for (const id of ids) {
        logs.push({
          action: "pruned",
          details: `Pruned memory ${id} (over ${MAX_MEMORIES_PER_USER} limit, lowest confidence)`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Update consolidation timestamp
  await query(
    "UPDATE users SET last_memory_consolidation = NOW(), memory_count = (SELECT COUNT(*) FROM memories WHERE user_id = $1) WHERE id = $1",
    [userId]
  );

  return logs;
}

// ── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run the full consolidation pipeline for a user.
 * Call this async — never block the main request.
 */
export async function runConsolidation(userId: string): Promise<ConsolidationLog[]> {
  const allLogs: ConsolidationLog[] = [];

  try {
    // Phase 1: Orient
    if (!(await shouldConsolidate(userId))) {
      return [];
    }

    console.log(`[consolidator] Starting consolidation for user ${userId}`);

    // Phase 2: Gather
    const { duplicates, contradictions } = await gatherMemories(userId);
    console.log(`[consolidator] Found ${duplicates.length} duplicates, ${contradictions.length} contradictions`);

    // Phase 3: Consolidate
    if (duplicates.length > 0 || contradictions.length > 0) {
      const consolidateLogs = await consolidate(userId, duplicates, contradictions);
      allLogs.push(...consolidateLogs);
    }

    // Phase 4: Prune
    const pruneLogs = await prune(userId);
    allLogs.push(...pruneLogs);

    console.log(`[consolidator] Complete: ${allLogs.length} actions taken`);
  } catch (err) {
    console.error("[consolidator] Failed:", err);
  }

  return allLogs;
}

/**
 * Get consolidation status for a user (for debugging).
 */
export async function getConsolidationStatus(userId: string): Promise<{
  lastRun: string | null;
  memoryCount: number;
  nextEligible: string;
}> {
  const user = await queryOne<any>(
    "SELECT last_memory_consolidation, memory_count FROM users WHERE id = $1",
    [userId]
  );

  const lastRun = user?.last_memory_consolidation || null;
  const memoryCount = user?.memory_count || 0;
  const nextEligible = lastRun
    ? new Date(new Date(lastRun).getTime() + MIN_HOURS_BETWEEN_RUNS * 60 * 60 * 1000).toISOString()
    : "now";

  return { lastRun, memoryCount, nextEligible };
}
