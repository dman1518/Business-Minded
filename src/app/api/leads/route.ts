import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { CaptureLeadSchema } from "@/application/dto/CaptureLeadDto";
import { CURRENT_PRIVACY_POLICY_VERSION } from "@/domain/policies/PrivacyPolicy";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { readJsonBodyWithLimit } from "@/infrastructure/security/requestGuards";
import { logError, logWarning } from "@/infrastructure/logging/logger";

const MAX_BODY_BYTES = 5_000; // lead form fields only — generous but bounded
const RATE_LIMIT = { limit: 10, windowMs: 60_000 }; // 10 submissions / minute / IP

const GENERIC_ERROR = { error: "Unable to save your details. Please try again." };

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  const rateLimitResult = checkRateLimit(`leads:${clientIp}`, RATE_LIMIT);
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

  const parsed = CaptureLeadSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead details", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Honeypot: a real visitor never fills the hidden `website` field. A
  // filled value almost certainly means a bot. Rather than tipping the
  // bot off with an error (which invites retries), we quietly report
  // success without saving anything.
  if (parsed.data.website) {
    logWarning("leads.honeypot_triggered", "Honeypot field was filled in — treating as bot.", { clientIp });
    return NextResponse.json({ id: "ignored", accepted: true }, { status: 201 });
  }

  try {
    const lead = await container.captureLead().execute({
      firstName: parsed.data.firstName,
      email: parsed.data.email,
      company: parsed.data.company,
      assessmentResultId: parsed.data.assessmentResultId,
      consentTimestamp: new Date(),
      consentPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    logError("leads.capture_failed", error, { clientIp });
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
  }
}
