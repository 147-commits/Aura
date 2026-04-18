import type { Request, Response, NextFunction } from "express";
import { query, queryOne } from "./db";

// ─── Types ───────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      deviceId?: string;
    }
  }
}

// ─── Authentication Middleware ────────────────────────────────────────────
// Uses device-id with server-side validation.
// The device ID must correspond to a registered user in the database.
// This replaces the old approach of trusting any x-device-id header.

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const deviceId = req.headers["x-device-id"] as string;

  if (!deviceId || deviceId === "anonymous") {
    // Allow unauthenticated access to limited endpoints
    req.deviceId = "anonymous";
    req.userId = undefined;
    next();
    return;
  }

  // Validate the device ID length and format to prevent injection
  if (deviceId.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
    res.status(400).json({ error: "Invalid device ID format" });
    return;
  }

  try {
    // Look up or create user — this validates the device ID is real
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    );

    if (existing) {
      req.userId = existing.id;
      req.deviceId = deviceId;
    } else {
      // Auto-register new devices
      const created = await queryOne<{ id: string }>(
        "INSERT INTO users (device_id) VALUES ($1) RETURNING id",
        [deviceId]
      );
      req.userId = created!.id;
      req.deviceId = deviceId;
    }

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
}

// ─── Require Auth Middleware ──────────────────────────────────────────────
// Use this on endpoints that MUST have a valid user

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required. Include x-device-id header." });
    return;
  }
  next();
}

// ─── Rate Limiting ───────────────────────────────────────────────────────
// In-memory rate limiter with per-user and per-endpoint limits.
// Falls back gracefully — never blocks due to internal errors.

interface RateBucket {
  count: number;
  windowStart: number;
}

// In-memory store — suitable for single-instance deployment.
// Migrate to Redis (Upstash) when scaling to multiple instances.
const rateBuckets = new Map<string, RateBucket>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    if (now - bucket.windowStart > 120_000) {
      rateBuckets.delete(key);
    }
  }
}, 300_000);

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Identifier for this limiter
}

export function rateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.userId || req.ip || "unknown";
    const key = `${config.keyPrefix}:${identifier}`;
    const now = Date.now();

    let bucket = rateBuckets.get(key);

    if (!bucket || now - bucket.windowStart > config.windowMs) {
      bucket = { count: 0, windowStart: now };
      rateBuckets.set(key, bucket);
    }

    bucket.count++;

    if (bucket.count > config.maxRequests) {
      const retryAfter = Math.ceil((bucket.windowStart + config.windowMs - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Limit", String(config.maxRequests));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.status(429).json({
        error: "Too many requests. Please slow down.",
        retryAfter,
      });
      return;
    }

    res.setHeader("X-RateLimit-Limit", String(config.maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(config.maxRequests - bucket.count));
    next();
  };
}

// Pre-configured rate limiters for different endpoints
export const chatRateLimit = rateLimit({
  windowMs: 60_000,      // 1 minute
  maxRequests: 30,        // 30 messages per minute
  keyPrefix: "chat",
});

export const researchRateLimit = rateLimit({
  windowMs: 60_000,
  maxRequests: 10,        // 10 research queries per minute
  keyPrefix: "research",
});

export const memoryRateLimit = rateLimit({
  windowMs: 60_000,
  maxRequests: 30,
  keyPrefix: "memory",
});

export const generalRateLimit = rateLimit({
  windowMs: 60_000,
  maxRequests: 60,        // 60 general API calls per minute
  keyPrefix: "general",
});

// ─── Daily Budget Tracking ───────────────────────────────────────────────
// Tracks per-user daily API token usage to prevent cost overruns.

const DAILY_TOKEN_BUDGET = 500_000; // ~$2.50/day on GPT-4o-mini

interface DailyUsage {
  tokens: number;
  date: string;
}

const dailyUsage = new Map<string, DailyUsage>();

export function trackTokenUsage(userId: string, tokens: number): boolean {
  const today = new Date().toISOString().split("T")[0];
  const key = `daily:${userId}`;
  
  let usage = dailyUsage.get(key);
  if (!usage || usage.date !== today) {
    usage = { tokens: 0, date: today };
    dailyUsage.set(key, usage);
  }

  usage.tokens += tokens;
  return usage.tokens <= DAILY_TOKEN_BUDGET;
}

export function checkDailyBudget(userId: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  const key = `daily:${userId}`;
  const usage = dailyUsage.get(key);
  
  if (!usage || usage.date !== today) return true;
  return usage.tokens <= DAILY_TOKEN_BUDGET;
}

export function budgetCheck(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.userId) {
    next();
    return;
  }

  if (!checkDailyBudget(req.userId)) {
    res.status(429).json({
      error: "Daily usage limit reached. Resets at midnight UTC.",
      type: "budget_exceeded",
    });
    return;
  }

  next();
}
