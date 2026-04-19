/**
 * Postgres connection pool — generic, host-agnostic.
 *
 * Reads DATABASE_URL from the environment. Works against any standard
 * Postgres connection string (Render, Railway, Fly, AWS RDS, Neon, Supabase,
 * local, etc.). Pool sizing is tuned for serverless / autoscale environments
 * where connection slots are scarce and idle connections should expire fast.
 *
 * Configurable via env:
 *   DATABASE_URL          (required)         — Postgres connection string
 *   PGSSL                 ("true"/"false")    — force SSL on/off; defaults to
 *                                               on in production
 *   DB_POOL_MAX           (number, default 10)
 *   DB_IDLE_TIMEOUT_MS    (number, default 10000)
 *   DB_CONNECTION_TIMEOUT_MS (number, default 10000)
 */

import { Pool } from "pg";

function shouldUseSSL(): false | { rejectUnauthorized: boolean } {
  const explicit = process.env.PGSSL;
  if (explicit === "true") return { rejectUnauthorized: false };
  if (explicit === "false") return false;
  return process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSSL(),
  max: intFromEnv("DB_POOL_MAX", 10),
  idleTimeoutMillis: intFromEnv("DB_IDLE_TIMEOUT_MS", 10_000),
  connectionTimeoutMillis: intFromEnv("DB_CONNECTION_TIMEOUT_MS", 10_000),
});

pool.on("error", (err: Error) => {
  console.error("[db] idle client error:", err.message);
});

let logged = false;
function logConnectionOnce(): void {
  if (logged) return;
  logged = true;
  console.log("Connected to Postgres");
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Set a standard Postgres URL (e.g. postgres://user:pass@host:5432/db)."
    );
  }
  const client = await pool.connect();
  try {
    logConnectionOnce();
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
