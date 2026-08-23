import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { computeOfferPricing, foundingPriceBadgeCopy } from "@/domain/policies/ClarityOfferConfig";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { logError } from "@/infrastructure/logging/logger";

const RATE_LIMIT = { limit: 60, windowMs: 60_000 };

/**
 * GET /api/clarity-session/offer
 *
 * Read-only current pricing for the offer page to display. The client
 * never computes or submits a price itself — this is purely a display
 * value derived the same way checkout pricing is (see
 * ClarityOfferConfig.computeOfferPricing), from a real count of
 * already-paid founding purchases.
 */
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);

  const rateLimitResult = checkRateLimit(`clarity-offer:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  try {
    const foundingCount = await container.clarityPurchaseRepository.countPaidFoundingPurchases();
    const pricing = computeOfferPricing(foundingCount);

    return NextResponse.json({
      amountMinorUnits: pricing.amountMinorUnits,
      currency: pricing.currency,
      founderPricingApplied: pricing.founderPricingApplied,
      foundingSpotsRemaining: pricing.foundingSpotsRemaining,
      badgeCopy: foundingPriceBadgeCopy(pricing),
    });
  } catch (error) {
    logError("clarity_offer.get_failed", error, { clientIp });
    return NextResponse.json({ error: "Unable to load current pricing." }, { status: 500 });
  }
}
