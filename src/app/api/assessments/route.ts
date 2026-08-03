import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { SubmitAssessmentSchema } from "@/application/dto/SubmitAssessmentDto";
import { toAssessmentResultView } from "@/application/dto/AssessmentResultView";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { readJsonBodyWithLimit } from "@/infrastructure/security/requestGuards";
import { logError } from "@/infrastructure/logging/logger";

const MAX_BODY_BYTES = 20_000; // up to 10 answers plus envelope — generous but bounded
const RATE_LIMIT = { limit: 20, windowMs: 60_000 }; // 20 submissions / minute / IP

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  const rateLimitResult = checkRateLimit(`assessments:submit:${clientIp}`, RATE_LIMIT);
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

  const parsed = SubmitAssessmentSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await container.submitAssessment().execute(parsed.data.answers);
    // Public response never includes raw answers — those stay internal
    // for auditing only. See AssessmentResultView.
    return NextResponse.json(toAssessmentResultView(result), { status: 201 });
  } catch (error) {
    logError("assessments.submit_failed", error, { clientIp });
    return NextResponse.json(
      { error: "Unable to score assessment. Please try again." },
      { status: 500 }
    );
  }
}
