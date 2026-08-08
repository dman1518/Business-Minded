import { describe, expect, it } from "vitest";
import { buildResultsPresentation } from "@/application/services/ResultsPresenter";
import { CategoryScore } from "@/domain/entities/Score";
import { buildValidScoringConfig } from "@/infrastructure/scoring-engine/__tests__/fixtures";

function categories(overrides: Partial<Record<string, Partial<CategoryScore>>> = {}): CategoryScore[] {
  const base: CategoryScore[] = [
    { categoryId: "money", categoryName: "Money", score: 20, status: "Strength" },
    { categoryId: "operations", categoryName: "Operations", score: 0, status: "Constraint" },
    { categoryId: "growth", categoryName: "Growth", score: 10, status: "Developing" },
    { categoryId: "freedom", categoryName: "Freedom", score: 15, status: "Developing" },
    { categoryId: "resilience", categoryName: "Resilience", score: 5, status: "Constraint" },
  ];
  return base.map((c) => ({ ...c, ...overrides[c.categoryId] }));
}

describe("buildResultsPresentation", () => {
  it("is a pure, deterministic function of overallScore + categoryScores + config", () => {
    const config = buildValidScoringConfig();
    const a = buildResultsPresentation(50, categories(), config);
    const b = buildResultsPresentation(50, categories(), config);
    expect(a).toEqual(b);
  });

  it("selects the score interpretation band matching the overall score", () => {
    const config = buildValidScoringConfig(); // bands: >=50 "Good", >=0 "Needs work"
    const good = buildResultsPresentation(72, categories(), config);
    const needsWork = buildResultsPresentation(30, categories(), config);

    expect(good.scoreInterpretation).toBe("Good, at 72.");
    expect(needsWork.scoreInterpretation).toBe("Needs work, at 30.");
  });

  it("selects the highest-scoring answered category as What's Working, citing its score", () => {
    const config = buildValidScoringConfig();
    const presentation = buildResultsPresentation(50, categories(), config);

    expect(presentation.whatsWorking.categoryId).toBe("money"); // highest at 20
    expect(presentation.whatsWorking.description).toContain("20/20");
  });

  it("never selects an Insufficient data category as What's Working", () => {
    const config = buildValidScoringConfig();
    // money (the highest scorer) has no evidence — should be skipped in favor of freedom (15).
    const presentation = buildResultsPresentation(
      30,
      categories({ money: { score: 0, status: "Insufficient data" } }),
      config
    );

    expect(presentation.whatsWorking.categoryId).toBe("freedom");
  });

  it("falls back to a generic message when every category is Insufficient data", () => {
    const config = buildValidScoringConfig();
    const allMissing = categories().map((c) => ({ ...c, score: 0, status: "Insufficient data" as const }));

    const presentation = buildResultsPresentation(0, allMissing, config);

    expect(presentation.whatsWorking.categoryId).toBe("");
    expect(presentation.whatsWorking.headline).toMatch(/Not enough answers/i);
  });
});
