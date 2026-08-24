import { timingSafeEqual } from "crypto";

/**
 * Shared-secret auth for the internal fulfillment view
 * (/internal/clarity-fulfillment). This codebase has no real
 * admin/auth system, so a single long random secret
 * (CLARITY_ADMIN_SHARED_SECRET) stands in for one — anyone holding it
 * can view every customer's intake answers and purchase data. This is
 * an explicit, flagged stopgap (see .env.example and
 * PRODUCT_OWNER_DECISIONS), not a permanent design: a real solution
 * would use per-user credentials and audit logging.
 */

export function isAdminAuthConfigured(): boolean {
  return Boolean(process.env.CLARITY_ADMIN_SHARED_SECRET);
}

/**
 * Constant-time comparison so a wrong guess can't be distinguished
 * from a near-miss by response timing. Returns false (never throws)
 * for any malformed input, including a length mismatch —
 * timingSafeEqual itself throws on unequal-length buffers, which this
 * wraps so callers get a plain boolean.
 */
export function isValidAdminSecret(provided: string | null): boolean {
  const expected = process.env.CLARITY_ADMIN_SHARED_SECRET;
  if (!expected || !provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
