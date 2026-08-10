import { describe, expect, it } from "vitest";
import {
  MIN_ELIGIBLE_DIMENSIONS_FOR_COMPARISON,
  supportsComparativeLanguage,
  insightRoleLabel,
} from "@/domain/policies/ComparativeLanguage";

describe("ComparativeLanguage — single source of truth for the comparison threshold", () => {
  it("REQUIRED TEST: one eligible partial dimension does not support comparative language", () => {
    expect(supportsComparativeLanguage(1)).toBe(false);
    expect(insightRoleLabel("constraint", 1)).toBe("Preliminary Focus Area");
    expect(insightRoleLabel("strength", 1)).toBe("Preliminary Focus Area");
    expect(insightRoleLabel("opportunity", 1)).toBe("Preliminary Focus Area");
  });

  it("REQUIRED TEST: one fully-answered dimension is still just one dimension — comparison requires more than completeness", () => {
    // The threshold is a function of dimension COUNT only. A single
    // dimension being fully answered (vs. partially answered) doesn't
    // change that there's nothing else to compare it against.
    expect(supportsComparativeLanguage(1)).toBe(false);
    expect(insightRoleLabel("constraint", 1)).toBe("Preliminary Focus Area");
  });

  it("REQUIRED TEST: two eligible dimensions is enough to support a real comparison", () => {
    expect(supportsComparativeLanguage(2)).toBe(true);
    expect(insightRoleLabel("constraint", 2)).toBe("Biggest Constraint");
    expect(insightRoleLabel("strength", 2)).toBe("What's Working");
    expect(insightRoleLabel("opportunity", 2)).toBe("Biggest Opportunity");
  });

  it("REQUIRED TEST: low completeness with mixed partial and complete dimensions still compares on dimension COUNT, not per-dimension completeness", () => {
    // Three eligible dimensions, some reducedConfidence (partial) and
    // some fully answered — comparison is still legitimate because
    // there are 3 distinct data points, regardless of how complete
    // each one individually is.
    expect(supportsComparativeLanguage(3)).toBe(true);
    expect(insightRoleLabel("constraint", 3)).toBe("Biggest Constraint");
  });

  it("REQUIRED TEST: enough data to legitimately select a biggest constraint (full 5-dimension assessment)", () => {
    expect(supportsComparativeLanguage(5)).toBe(true);
    expect(insightRoleLabel("constraint", 5)).toBe("Biggest Constraint");
    expect(insightRoleLabel("strength", 5)).toBe("What's Working");
    expect(insightRoleLabel("opportunity", 5)).toBe("Biggest Opportunity");
  });

  it("zero eligible dimensions does not support comparative language either", () => {
    expect(supportsComparativeLanguage(0)).toBe(false);
    expect(insightRoleLabel("constraint", 0)).toBe("Preliminary Focus Area");
  });

  it("the exported threshold constant is exactly what supportsComparativeLanguage enforces", () => {
    expect(supportsComparativeLanguage(MIN_ELIGIBLE_DIMENSIONS_FOR_COMPARISON)).toBe(true);
    expect(supportsComparativeLanguage(MIN_ELIGIBLE_DIMENSIONS_FOR_COMPARISON - 1)).toBe(false);
  });
});
