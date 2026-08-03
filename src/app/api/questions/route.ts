import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { logError } from "@/infrastructure/logging/logger";

const RATE_LIMIT = { limit: 60, windowMs: 60_000 }; // 60 loads / minute / IP

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);

  const rateLimitResult = checkRateLimit(`questions:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  try {
    const questionSet = await container.getQuestionSet().execute();
    return NextResponse.json(questionSet);
  } catch (error) {
    logError("questions.get_failed", error, { clientIp });
    return NextResponse.json({ error: "Unable to load questions." }, { status: 500 });
  }
}
