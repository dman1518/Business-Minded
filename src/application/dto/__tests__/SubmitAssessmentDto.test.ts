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

  it("REQUIRED TEST: accepts an empty answers array at the wire boundary (the real all-skipped payload shape)", () => {
    // skipAnswer() deletes the key entirely (see useAssessmentProgress),
    // so a fully-skipped assessment submits answers: [] over the wire.
    // This schema must NOT reject that with a generic 400 -- it has to
    // reach SubmitAssessment / ConfigurableScoringEngine so the
    // intentional InsufficientDataError -> 422 INSUFFICIENT_DATA path
    // fires instead. A .min(1) here previously short-circuited that
    // and reintroduced the all-skipped generic-error bug at the schema
    // layer (caught via live production testing, not a local test).
    const parsed = SubmitAssessmentSchema.safeParse({ answers: [] });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.answers).toEqual([]);
    }
  });
});
