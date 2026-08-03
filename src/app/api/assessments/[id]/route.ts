import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { toAssessmentResultView } from "@/application/dto/AssessmentResultView";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { logError } from "@/infrastructure/logging/logger";

const RATE_LIMIT = { limit: 60, windowMs: 60_000 }; // 60 lookups / minute / IP

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const clientIp = getClientIp(request);

  const rateLimitResult = checkRateLimit(`assessments:get:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  try {
    const result = await container.assessmentResultRepository.findById(params.id);

    if (!result) {
      return NextResponse.json({ error: "Assessment result not found." }, { status: 404 });
    }

    // Public response never includes raw answers — those stay internal
    // for auditing only. See AssessmentResultView.
    return NextResponse.json(toAssessmentResultView(result));
  } catch (error) {
    logError("assessments.get_failed", error, { clientIp, id: params.id });
    return NextResponse.json({ error: "Unable to load assessment result." }, { status: 500 });
  }
}
