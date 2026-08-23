import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { CreateClarityCheckoutSchema } from "@/application/dto/CreateClarityCheckoutDto";
import { isStripeConfigured } from "@/infrastructure/payments/stripeConfig";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { readJsonBodyWithLimit } from "@/infrastructure/security/requestGuards";
import { logError, logWarning } from "@/infrastructure/logging/logger";

const MAX_BODY_BYTES = 2_000;
const RATE_LIMIT = { limit: 10, windowMs: 60_000 }; // 10 checkout attempts / minute / IP

const GENERIC_ERROR = { error: "Unable to start checkout. Please try again." };
const UNAVAILABLE_ERROR = {
  error:
    "Online booking isn't available right now. Please contact us directly to book your Business Clarity Session.",
};

/**
 * POST /api/clarity-session/checkout
 *
 * Creates (or resumes) a Stripe Checkout Session for the Business
 * Clarity Session offer. Never trusts a client-submitted price —
 * pricing is always computed server-side (see
 * CreateClarityCheckoutSession / ClarityOfferConfig). If Stripe is not
 * configured (no STRIPE_SECRET_KEY), returns a clear 503 rather than
 * simulating a successful checkout.
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  if (!isStripeConfigured()) {
    logWarning("clarity_checkout.stripe_unconfigured", "Checkout attempted without STRIPE_SECRET_KEY set.", {
      clientIp,
    });
    return NextResponse.json(UNAVAILABLE_ERROR, { status: 503 });
  }

  const rateLimitResult = checkRateLimit(`clarity-checkout:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  const bodyResult = await readJsonBodyWithLimit(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    const status = bodyResult.reason === "too_large" ? 413 : 400;
    return NextResponse.json(
      { error: bodyResult.reason === "too_large" ? "Request too large." : "Invalid request body." },
      { status }
    );
  }

  const parsed = CreateClarityCheckoutSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/clarity-session/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/clarity-session/cancel`;

  try {
    const result = await container.createClarityCheckoutSession().execute({
      clientRequestId: parsed.data.clientRequestId,
      assessmentResultId: parsed.data.assessmentResultId,
      sourceCampaign: parsed.data.sourceCampaign,
      successUrl,
      cancelUrl,
    });

    if (result.kind === "already_paid") {
      // Refuse to double-charge. Send the client to the same success
      // page it would have landed on after paying — that route
      // re-verifies payment server-side and shows the right state.
      return NextResponse.json(
        {
          alreadyPaid: true,
          redirectUrl: `${origin}/clarity-session/success?purchase_id=${result.purchaseId}`,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ url: result.url }, { status: 200 });
  } catch (error) {
    logError("clarity_checkout.create_failed", error, { clientIp });
    return NextResponse.json(GENERIC_ERROR, { status: 500 });
  }
}
