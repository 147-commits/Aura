/**
 * Snapshot every agent's current systemPrompt into the `prompt_versions`
 * table, keyed by (agent_id, version).
 *
 * Idempotent — re-running with no registry changes is a no-op, because
 * each (agent_id, version) pair is unique and inserts use ON CONFLICT DO
 * NOTHING. When an agent's promptVersion is bumped, a new row is added
 * without disturbing old rows, so past runs remain reproducible against
 * the exact prompt they used.
 *
 * Usage:
 *   npm run prompts:snapshot
 */

import "dotenv/config";
import { pool } from "../server/db";
import { AGENT_REGISTRY } from "../server/agents/agent-registry";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — cannot snapshot prompts.");
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const agent of AGENT_REGISTRY.values()) {
      const result = await client.query(
        `INSERT INTO prompt_versions (agent_id, version, system_prompt)
         VALUES ($1, $2, $3)
         ON CONFLICT (agent_id, version) DO NOTHING
         RETURNING id`,
        [agent.id, agent.promptVersion, agent.systemPrompt]
      );
      if (result.rowCount && result.rowCount > 0) {
        inserted += 1;
        console.log(`  + ${agent.id}@${agent.promptVersion}`);
      } else {
        skipped += 1;
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const total = AGENT_REGISTRY.size;
  console.log(`\nSnapshot complete: ${inserted} inserted, ${skipped} unchanged, ${total} total agents.`);
  await pool.end();
}

main().catch((err) => {
  console.error("snapshot-prompts failed:", err);
  process.exit(1);
});
