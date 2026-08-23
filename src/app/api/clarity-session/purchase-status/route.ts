import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { logError } from "@/infrastructure/logging/logger";

const RATE_LIMIT = { limit: 60, windowMs: 60_000 };

/**
 * GET /api/clarity-session/purchase-status?session_id=...  or  ?purchase_id=...
 *
 * Read-only status lookup used by the success/cancel/intake pages.
 * Authorization is the same unguessable-id capability-token model this
 * app already uses for assessment results (see /api/assessments/[id])
 * — knowing a Stripe Checkout Session id or purchase cuid is what
 * grants access, since there's no login system. The response never
 * includes Stripe ids, source-campaign attribution, or internal
 * fulfillment notes.
 */
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);

  const rateLimitResult = checkRateLimit(`clarity-purchase-status:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  const purchaseId = searchParams.get("purchase_id");

  if (!sessionId && !purchaseId) {
    return NextResponse.json({ error: "session_id or purchase_id is required." }, { status: 400 });
  }

  try {
    const purchase = sessionId
      ? await container.clarityPurchaseRepository.findByStripeCheckoutSessionId(sessionId)
      : await container.clarityPurchaseRepository.findById(purchaseId as string);

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
    }

    return NextResponse.json({
      purchaseId: purchase.id,
      status: purchase.status,
      intakeStatus: purchase.intakeStatus,
      schedulingStatus: purchase.schedulingStatus,
      amountMinorUnits: purchase.amountMinorUnits,
      currency: purchase.currency,
    });
  } catch (error) {
    logError("clarity_purchase_status.get_failed", error, { clientIp });
    return NextResponse.json({ error: "Unable to load purchase status." }, { status: 500 });
  }
}
