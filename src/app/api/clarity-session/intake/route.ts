import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { SubmitClarityIntakeSchema } from "@/application/dto/SubmitClarityIntakeDto";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { readJsonBodyWithLimit } from "@/infrastructure/security/requestGuards";
import { logError } from "@/infrastructure/logging/logger";

const MAX_BODY_BYTES = 20_000; // nine free-text fields, generous but bounded
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

/**
 * POST /api/clarity-session/intake
 *
 * Accepts pre-session intake answers for a Business Clarity Session
 * purchase. The use case (not this route) is the real authorization
 * boundary — see SubmitClarityIntake: it rejects any purchase that
 * hasn't reached at least "intake_pending", i.e. payment verified by
 * the Stripe webhook, regardless of what purchaseId is supplied here.
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  const rateLimitResult = checkRateLimit(`clarity-intake:${clientIp}`, RATE_LIMIT);
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

  const parsed = SubmitClarityIntakeSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid intake submission", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await container.submitClarityIntake().execute({
      purchaseId: parsed.data.purchaseId,
      answers: parsed.data.answers,
    });

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
    }
    if (result.kind === "not_paid") {
      return NextResponse.json(
        { error: "We don't see a completed payment for this session yet." },
        { status: 403 }
      );
    }

    return NextResponse.json({ submitted: true }, { status: 200 });
  } catch (error) {
    logError("clarity_intake.submit_failed", error, { clientIp });
    return NextResponse.json({ error: "Unable to submit intake. Please try again." }, { status: 500 });
  }
}
