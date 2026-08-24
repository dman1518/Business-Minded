import { describe, expect, it } from "vitest";
import { SubmitClarityIntakeSchema } from "@/application/dto/SubmitClarityIntakeDto";

function validAnswers(overrides: Record<string, unknown> = {}) {
  return {
    businessDescription: "We sell widgets.",
    primaryCustomer: "Small manufacturers.",
    approxAnnualRevenue: "$250K–$1M",
    teamSize: "2–5",
    mostUrgentProblem: "Too much owner dependence.",
    ninetyDayOutcome: "A repeatable sales process.",
    whatYouveAlreadyTried: "Nothing yet",
    metricsCurrentlyTracked: "None yet",
    implementationBlockers: "Nothing specific",
    approvalNeededFromOthers: false,
    isOwnerOrDecisionMaker: true,
    readyToActWithinThirtyDays: true,
    ...overrides,
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    purchaseId: "purchase-1",
    answers: validAnswers(),
    intakeConsent: true,
    ...overrides,
  };
}

describe("SubmitClarityIntakeSchema", () => {
  it("accepts a fully filled-in valid submission", () => {
    const result = SubmitClarityIntakeSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("treats a blank optional otherAttendees as null, not an empty string", () => {
    const result = SubmitClarityIntakeSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.answers.otherAttendees).toBeNull();
    }
  });

  it("rejects consent that isn't explicitly true", () => {
    const result = SubmitClarityIntakeSchema.safeParse(validPayload({ intakeConsent: false }));
    expect(result.success).toBe(false);
  });

  it("REQUIRED TEST: rejects a submission with a blank required free-text field rather than silently accepting it", () => {
    const result = SubmitClarityIntakeSchema.safeParse(
      validPayload({ answers: validAnswers({ mostUrgentProblem: "" }) })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a missing purchaseId", () => {
    const result = SubmitClarityIntakeSchema.safeParse(validPayload({ purchaseId: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean answers for the three yes/no questions", () => {
    const result = SubmitClarityIntakeSchema.safeParse(
      validPayload({ answers: validAnswers({ isOwnerOrDecisionMaker: "yes" }) })
    );
    expect(result.success).toBe(false);
  });
});
