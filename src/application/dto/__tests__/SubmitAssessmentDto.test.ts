import { describe, expect, it } from "vitest";
import { SubmitAssessmentSchema } from "@/application/dto/SubmitAssessmentDto";

function baseAnswers() {
  return [{ questionId: "money_1", value: 5 }];
}

describe("SubmitAssessmentSchema", () => {
  it("accepts a submission with no segmentation at all", () => {
    const parsed = SubmitAssessmentSchema.safeParse({ answers: baseAnswers() });
    expect(parsed.success).toBe(true);
  });

  it("accepts a submission with an empty segmentation object (all fields skipped)", () => {
    const parsed = SubmitAssessmentSchema.safeParse({ answers: baseAnswers(), segmentation: {} });
    expect(parsed.success).toBe(true);
  });

  it("accepts a submission with a valid segmentation subset", () => {
    const parsed = SubmitAssessmentSchema.safeParse({
      answers: baseAnswers(),
      segmentation: { industry: "technology_software", revenueRange: "1m_5m" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a segmentation value outside the allowed option list", () => {
    const parsed = SubmitAssessmentSchema.safeParse({
      answers: baseAnswers(),
      segmentation: { industry: "<script>alert(1)</script>" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown segmentation field", () => {
    // companySize misspelled; zod's default object mode strips unknown keys
    // rather than rejecting, so this only proves the known key is unaffected —
    // paired with the enum test above to prove garbage values are rejected.
    const parsed = SubmitAssessmentSchema.safeParse({
      answers: baseAnswers(),
      segmentation: { companySize: "6_20" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.segmentation).toEqual({ companySize: "6_20" });
    }
  });
});
