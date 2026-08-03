import { NextRequest } from "next/server";

/**
 * Basic in-memory, fixed-window rate limiter for the public,
 * unauthenticated assessment/lead/report endpoints.
 *
 * Sprint 1 scope: this is process-local (a Map kept in server memory),
 * which is appropriate for a single-instance public-validation launch.
 * It intentionally does NOT survive a process restart and does NOT
 * coordinate across multiple server instances — see the README's
 * "Remaining launch risks" section. Swapping in a shared store (e.g.
 * Redis/Upstash) later requires touching only this file.
 */

interface WindowState {
  count: number;
  windowStartedAt: number;
}

const buckets = new Map<string, WindowState>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length, in milliseconds. */
  windowMs: number;
}

/**
 * Returns whether `key` (typically `${routeName}:${clientIp}`) is
 * still within its allowed request budget for the current window.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartedAt >= options.windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count < options.limit) {
    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterMs = options.windowMs - (now - existing.windowStartedAt);
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

/** Best-effort client IP extraction behind typical reverse proxies. */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/** Periodically drop stale buckets so memory doesn't grow unbounded. */
export function pruneRateLimitBuckets(maxAgeMs: number): void {
  const now = Date.now();
  for (const [key, state] of buckets) {
    if (now - state.windowStartedAt > maxAgeMs) {
      buckets.delete(key);
    }
  }
}
