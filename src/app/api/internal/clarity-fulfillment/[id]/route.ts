import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { UpdateClarityFulfillmentSchema } from "@/application/dto/UpdateClarityFulfillmentDto";
import { isAdminAuthConfigured, isValidAdminSecret } from "@/infrastructure/security/adminAuth";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { readJsonBodyWithLimit } from "@/infrastructure/security/requestGuards";
import { logError } from "@/infrastructure/logging/logger";

const RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const ADMIN_SECRET_HEADER = "x-admin-secret";

function checkAdminAuth(request: NextRequest): NextResponse | null {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: "Internal fulfillment view is not configured." }, { status: 503 });
  }
  if (!isValidAdminSecret(request.headers.get(ADMIN_SECRET_HEADER))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

/**
 * GET /api/internal/clarity-fulfillment/[id]
 *
 * Full detail for one purchase, including intake answers — this is
 * the only place in the app intake content is ever exposed, and only
 * behind the admin shared secret.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const clientIp = getClientIp(request);
  const authError = checkAdminAuth(request);
  if (authError) return authError;

  const rateLimitResult = checkRateLimit(`clarity-fulfillment-detail:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  try {
    const purchase = await container.clarityPurchaseRepository.findById(params.id);
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
    }
    const intake = await container.clarityIntakeRepository.findByPurchaseId(params.id);

    return NextResponse.json({ purchase, intake });
  } catch (error) {
    logError("clarity_fulfillment.detail_failed", error, { clientIp, id: params.id });
    return NextResponse.json({ error: "Unable to load purchase." }, { status: 500 });
  }
}

/**
 * POST /api/internal/clarity-fulfillment/[id]
 *
 * Applies one fulfillment action (a status advance, or an
 * internal-notes update). See UpdateClarityFulfillment for how
 * transition legality is enforced.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const clientIp = getClientIp(request);
  const authError = checkAdminAuth(request);
  if (authError) return authError;

  const rateLimitResult = checkRateLimit(`clarity-fulfillment-update:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  const bodyResult = await readJsonBodyWithLimit(request, 10_000);
  if (!bodyResult.ok) {
    const status = bodyResult.reason === "too_large" ? 413 : 400;
    return NextResponse.json(
      { error: bodyResult.reason === "too_large" ? "Request too large." : "Invalid request body." },
      { status }
    );
  }

  const parsed = UpdateClarityFulfillmentSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await container.updateClarityFulfillment().execute(params.id, parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("clarity_fulfillment.update_failed", error, { clientIp, id: params.id });
    return NextResponse.json({ error: "Unable to apply update." }, { status: 500 });
  }
}
