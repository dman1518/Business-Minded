import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { isAdminAuthConfigured, isValidAdminSecret } from "@/infrastructure/security/adminAuth";
import { checkRateLimit, getClientIp } from "@/infrastructure/security/rateLimiter";
import { formatCurrency } from "@/lib/formatCurrency";
import { logError } from "@/infrastructure/logging/logger";

const RATE_LIMIT = { limit: 20, windowMs: 60_000 };
const ADMIN_SECRET_HEADER = "x-admin-secret";

/**
 * GET /api/internal/clarity-fulfillment/[id]/plan-template
 *
 * Generates a downloadable Markdown skeleton for the written Business
 * Clarity Plan, pre-filled with the client's intake answers so the
 * consultant isn't retyping them, plus blank sections for what only a
 * human can produce after actually running the session
 * (recommendations, 90-day roadmap, next steps). This is deliberately
 * NOT an auto-generated plan — the task brief's "don't simulate" rule
 * applies here too: the substantive advice comes from the consultant,
 * never fabricated by this endpoint.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const clientIp = getClientIp(request);

  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: "Internal fulfillment view is not configured." }, { status: 503 });
  }

  const rateLimitResult = checkRateLimit(`clarity-plan-template:${clientIp}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  if (!isValidAdminSecret(request.headers.get(ADMIN_SECRET_HEADER))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const purchase = await container.clarityPurchaseRepository.findById(params.id);
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
    }
    const intake = await container.clarityIntakeRepository.findByPurchaseId(params.id);
    if (!intake) {
      return NextResponse.json({ error: "No intake on file for this purchase yet." }, { status: 404 });
    }

    const a = intake.answers;
    const markdown = `# Business Clarity Plan

Prepared for: ${purchase.customerEmail ?? "(email on file not captured)"}
Session fee paid: ${formatCurrency(purchase.amountMinorUnits, purchase.currency)}
Purchase ID: ${purchase.id}

## From intake

**What the business does:** ${a.businessDescription}

**Primary customer:** ${a.primaryCustomer}

**Approximate annual revenue:** ${a.approxAnnualRevenue}

**Team size:** ${a.teamSize}

**Most urgent problem:** ${a.mostUrgentProblem}

**What a win looks like in 90 days:** ${a.ninetyDayOutcome}

**Already tried:** ${a.whatYouveAlreadyTried}

**Currently tracked metrics:** ${a.metricsCurrentlyTracked}

**Implementation blockers:** ${a.implementationBlockers}

**Needs approval from others:** ${a.approvalNeededFromOthers ? "Yes" : "No"}

**Owner / primary decision-maker:** ${a.isOwnerOrDecisionMaker ? "Yes" : "No"}

**Ready to act within 30 days:** ${a.readyToActWithinThirtyDays ? "Yes" : "No"}

**Other attendees:** ${a.otherAttendees ?? "None"}

---

## Session notes

_(Fill in during/after the session.)_

## Recommendations

_(Fill in.)_

## 90-day roadmap

### Weeks 1–2

_(Fill in.)_

### Weeks 3–6

_(Fill in.)_

### Weeks 7–12

_(Fill in.)_

## Immediate next steps

_(Fill in — what the client should do this week.)_
`;

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="business-clarity-plan-${purchase.id}.md"`,
      },
    });
  } catch (error) {
    logError("clarity_plan_template.get_failed", error, { clientIp, id: params.id });
    return NextResponse.json({ error: "Unable to generate plan template." }, { status: 500 });
  }
}
