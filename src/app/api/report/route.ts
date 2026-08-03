import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { logError } from "@/infrastructure/logging/logger";

const RATE_LIMIT = { limit: 20, windowMs: 60_000 }; // 20 report generations / minute / IP

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const assessmentResultId = request.nextUrl.searchParams.get("assessmentResultId");

  const rateLimitResult = checkRateLimit(`report:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  if (!assessmentResultId || assessmentResultId.length > 100) {
    return NextResponse.json(
      { error: "assessmentResultId is required." },
      { status: 400 }
    );
  }

  try {
    const pdfBuffer = await container.generateReport().execute(assessmentResultId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="business-minded-report.pdf"',
      },
    });
  } catch (error) {
    logError("report.generate_failed", error, { clientIp, assessmentResultId });
    return NextResponse.json({ error: "Unable to generate report." }, { status: 404 });
  }
}
