import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { logError } from "@/infrastructure/logging/logger";

const RATE_LIMIT = { limit: 30, windowMs: 60_000 };

const SCHEDULING_ELIGIBLE_STATUSES = [
  "scheduling_pending",
  "scheduled",
  "delivered",
  "followup_due",
  "completed",
];

/**
 * GET /api/clarity-session/scheduling-link?purchase_id=...
 *
 * Returns the external scheduling URL (CLARITY_SESSION_SCHEDULING_URL)
 * for a purchase that has completed intake, or `null` if no scheduling
 * provider is configured yet — the UI shows a "we'll follow up
 * personally" fallback rather than a broken/fake link. See
 * PRODUCT_OWNER_DECISIONS: which scheduling provider to use is an open
 * decision; this endpoint works unchanged once one is chosen and its
 * booking-page URL is set as the env var.
 *
 * Only actually hands out the URL for purchases that have finished
 * intake (scheduling_pending or later) — same capability-token
 * authorization model as the rest of this funnel (purchase id is an
 * unguessable cuid).
 */
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);

  const rateLimitResult = checkRateLimit(`clarity-scheduling-link:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const purchaseId = searchParams.get("purchase_id");
  if (!purchaseId) {
    return NextResponse.json({ error: "purchase_id is required." }, { status: 400 });
  }

  try {
    const purchase = await container.clarityPurchaseRepository.findById(purchaseId);
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
    }
    if (!SCHEDULING_ELIGIBLE_STATUSES.includes(purchase.status)) {
      return NextResponse.json({ error: "Intake hasn't been completed yet." }, { status: 403 });
    }

    const schedulingUrl = process.env.CLARITY_SESSION_SCHEDULING_URL || null;

    // Record that a link was handed out, once, the first time — purely
    // informational for the internal fulfillment view ("did they even
    // get a link"); never blocks or alters what's returned above.
    if (schedulingUrl && purchase.schedulingStatus === "not_started") {
      await container.clarityPurchaseRepository.updateFields(purchase.id, { schedulingStatus: "link_sent" });
    }

    return NextResponse.json({ schedulingUrl });
  } catch (error) {
    logError("clarity_scheduling_link.get_failed", error, { clientIp });
    return NextResponse.json({ error: "Unable to load scheduling link." }, { status: 500 });
  }
}
