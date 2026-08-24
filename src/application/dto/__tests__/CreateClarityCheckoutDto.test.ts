import { describe, expect, it } from "vitest";
import { CreateClarityCheckoutSchema } from "@/application/dto/CreateClarityCheckoutDto";

describe("CreateClarityCheckoutSchema", () => {
  it("accepts a minimal valid payload with just a clientRequestId", () => {
    const result = CreateClarityCheckoutSchema.safeParse({
      clientRequestId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    });
    expect(result.success).toBe(true);
  });

  it("REQUIRED TEST: rejects a non-UUID clientRequestId (the idempotency key must be a real UUID)", () => {
    const result = CreateClarityCheckoutSchema.safeParse({ clientRequestId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing clientRequestId", () => {
    const result = CreateClarityCheckoutSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts optional assessmentResultId and sourceCampaign", () => {
    const result = CreateClarityCheckoutSchema.safeParse({
      clientRequestId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      assessmentResultId: "assessment-1",
      sourceCampaign: { source: "newsletter", medium: "email", campaign: "launch" },
    });
    expect(result.success).toBe(true);
  });

  it("does NOT accept a client-submitted price field — pricing is always server-computed", () => {
    const result = CreateClarityCheckoutSchema.safeParse({
      clientRequestId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      amountMinorUnits: 1,
    });
    // Zod's default behavior strips unknown keys rather than rejecting
    // them, so this just confirms the schema has no field that would
    // ever let a price through, not that the request itself is refused.
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).amountMinorUnits).toBeUndefined();
    }
  });
});
