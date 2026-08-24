import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { isAdminAuthConfigured, isValidAdminSecret } from "@/infrastructure/security/adminAuth";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { logError } from "@/infrastructure/logging/logger";

const RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const ADMIN_SECRET_HEADER = "x-admin-secret";

/**
 * GET /api/internal/clarity-fulfillment
 *
 * Lists every Business Clarity Session purchase for the internal
 * fulfillment view. Gated by a shared secret (see adminAuth.ts) rather
 * than a real auth system — an explicit, documented stopgap. Never
 * returns intake answers here (that's the detail route only); this is
 * the queue/overview list.
 */
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);

  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: "Internal fulfillment view is not configured." }, { status: 503 });
  }

  const rateLimitResult = checkRateLimit(`clarity-fulfillment-list:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  if (!isValidAdminSecret(request.headers.get(ADMIN_SECRET_HEADER))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const purchases = await container.clarityPurchaseRepository.listForFulfillment();
    return NextResponse.json(
      purchases.map((p) => ({
        id: p.id,
        customerEmail: p.customerEmail,
        status: p.status,
        intakeStatus: p.intakeStatus,
        schedulingStatus: p.schedulingStatus,
        amountMinorUnits: p.amountMinorUnits,
        currency: p.currency,
        founderPricingApplied: p.founderPricingApplied,
        scheduledAt: p.scheduledAt,
        createdAt: p.createdAt,
      }))
    );
  } catch (error) {
    logError("clarity_fulfillment.list_failed", error, { clientIp });
    return NextResponse.json({ error: "Unable to load fulfillment queue." }, { status: 500 });
  }
}
