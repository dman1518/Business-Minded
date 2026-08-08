import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, getClientIp, pruneRateLimitBuckets } from "@/infrastructure/security/rateLimiter";
import { NextRequest } from "next/server";

function fakeRequest(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit within a window", () => {
    const key = `test-key-${Math.random()}`;
    const options = { limit: 3, windowMs: 60_000 };

    expect(checkRateLimit(key, options).allowed).toBe(true);
    expect(checkRateLimit(key, options).allowed).toBe(true);
    expect(checkRateLimit(key, options).allowed).toBe(true);
  });

  it("blocks a request once the limit is exceeded within the same window", () => {
    const key = `test-key-${Math.random()}`;
    const options = { limit: 2, windowMs: 60_000 };

    checkRateLimit(key, options);
    checkRateLimit(key, options);
    const blocked = checkRateLimit(key, options);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the count once the window has elapsed", () => {
    const key = `test-key-${Math.random()}`;
    const options = { limit: 1, windowMs: 60_000 };

    expect(checkRateLimit(key, options).allowed).toBe(true);
    expect(checkRateLimit(key, options).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(checkRateLimit(key, options).allowed).toBe(true);
  });

  it("tracks independent buckets per key", () => {
    const options = { limit: 1, windowMs: 60_000 };
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;

    expect(checkRateLimit(keyA, options).allowed).toBe(true);
    expect(checkRateLimit(keyB, options).allowed).toBe(true);
    expect(checkRateLimit(keyA, options).allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  it("prefers the first entry of x-forwarded-for", () => {
    const request = fakeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = fakeRequest({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(request)).toBe("9.9.9.9");
  });

  it('returns "unknown" when neither header is present', () => {
    const request = fakeRequest({});
    expect(getClientIp(request)).toBe("unknown");
  });
});

describe("pruneRateLimitBuckets", () => {
  it("does not throw when called with no buckets tracked yet", () => {
    expect(() => pruneRateLimitBuckets(1_000)).not.toThrow();
  });
});
