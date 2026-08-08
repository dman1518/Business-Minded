import { describe, expect, it } from "vitest";
import { validateStartupConfig } from "@/infrastructure/config/validateStartupConfig";
import { QuestionSet } from "@/domain/entities/Question";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";
import {
  buildValidQuestionSet,
  buildValidScoringConfig,
} from "@/infrastructure/scoring-engine/__tests__/fixtures";
import questionsData from "@/infrastructure/config/questions.json";
import scoringRulesData from "@/infrastructure/config/scoring-rules.json";

describe("validateStartupConfig", () => {
  it("accepts a valid configuration without throwing", () => {
    expect(() =>
      validateStartupConfig(buildValidQuestionSet(), buildValidScoringConfig())
    ).not.toThrow();
  });

  it("accepts the real bundled production configuration", () => {
    expect(() =>
      validateStartupConfig(
        questionsData as unknown as QuestionSet,
        scoringRulesData as unknown as ScoringConfig
      )
    ).not.toThrow();
  });

  it("the real bundled configuration has exactly the five locked categories at 20% each", () => {
    const config = scoringRulesData as unknown as ScoringConfig;
    const questionSet = questionsData as unknown as QuestionSet;

    expect(questionSet.categories.map((c) => c.id).sort()).toEqual(
      ["freedom", "growth", "money", "operations", "resilience"].sort()
    );
    for (const weight of Object.values(config.categoryWeights)) {
      expect(weight).toBeCloseTo(0.2);
    }
  });

  it("the real bundled question set has between 8 and 10 questions", () => {
    const questionSet = questionsData as unknown as QuestionSet;
    expect(questionSet.questions.length).toBeGreaterThanOrEqual(8);
    expect(questionSet.questions.length).toBeLessThanOrEqual(10);
  });

  it("fails if a required category is missing", () => {
    const questionSet = buildValidQuestionSet();
    questionSet.categories = questionSet.categories.filter((c) => c.id !== "freedom");
    questionSet.questions = questionSet.questions.filter((q) => q.categoryId !== "freedom");

    expect(() => validateStartupConfig(questionSet, buildValidScoringConfig())).toThrow(
      /Missing required category "freedom"/
    );
  });

  it("fails if an unexpected category is present (framework is locked)", () => {
    const questionSet = buildValidQuestionSet();
    questionSet.categories.push({ id: "ownerDependence", name: "Owner Dependence" });

    expect(() => validateStartupConfig(questionSet, buildValidScoringConfig())).toThrow(
      /Unexpected category "ownerDependence"/
    );
  });

  it("fails if a category weight is missing", () => {
    const config = buildValidScoringConfig();
    delete (config.categoryWeights as Record<string, number>).money;

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /Missing categoryWeights entry for "money"/
    );
  });

  it("fails if weights are not all exactly 20%", () => {
    const config = buildValidScoringConfig();
    config.categoryWeights.money = 0.3;
    config.categoryWeights.operations = 0.1;

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /weight must be exactly 0.2/
    );
  });

  it("fails if weights do not sum to 1.0", () => {
    const config = buildValidScoringConfig();
    config.categoryWeights.money = 0.25;

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /must sum to 1.0/
    );
  });

  it("fails if a question references an unknown category", () => {
    const questionSet = buildValidQuestionSet();
    questionSet.questions[0] = { ...questionSet.questions[0], categoryId: "not-a-real-category" };

    expect(() => validateStartupConfig(questionSet, buildValidScoringConfig())).toThrow(
      /references unknown category "not-a-real-category"/
    );
  });

  it("fails if a required category has no questions", () => {
    const questionSet = buildValidQuestionSet();
    questionSet.questions = questionSet.questions.filter((q) => q.categoryId !== "growth");

    expect(() => validateStartupConfig(questionSet, buildValidScoringConfig())).toThrow(
      /Category "growth" has no questions/
    );
  });

  it("fails if required insight text is missing for a category", () => {
    const config = buildValidScoringConfig();
    config.categoryInsights.resilience.strengthHeadline = "";

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /Missing or empty "strengthHeadline" text for category "resilience"/
    );
  });

  it("fails if priority action/why/timeframe text is missing for a category", () => {
    const config = buildValidScoringConfig();
    config.categoryInsights.money.priorityWhyItMatters = "";

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /Missing or empty "priorityWhyItMatters" text for category "money"/
    );
  });

  it("fails if confidenceThresholds has no minCompleteness: 0 catch-all", () => {
    const config = buildValidScoringConfig();
    config.confidenceThresholds = [{ minCompleteness: 0.5, level: "Medium" }];

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /must include a catch-all entry with minCompleteness: 0/
    );
  });

  it("fails if a confidenceThresholds level is invalid", () => {
    const config = buildValidScoringConfig();
    config.confidenceThresholds = [
      // @ts-expect-error — intentionally invalid for the test
      { minCompleteness: 0, level: "Excellent" },
    ];

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /Invalid confidenceThresholds.level "Excellent"/
    );
  });

  it("fails if categoryStatusThresholds has no minScore: 0 catch-all", () => {
    const config = buildValidScoringConfig();
    config.categoryStatusThresholds = [{ minScore: 10, status: "Developing" }];

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /categoryStatusThresholds must include a catch-all entry with minScore: 0/
    );
  });

  it("fails if a categoryStatusThresholds status is invalid", () => {
    const config = buildValidScoringConfig();
    config.categoryStatusThresholds = [
      // @ts-expect-error — intentionally invalid for the test
      { minScore: 0, status: "Amazing" },
    ];

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /Invalid categoryStatusThresholds.status "Amazing"/
    );
  });

  it("fails if scoreInterpretationThresholds has no minScore: 0 catch-all", () => {
    const config = buildValidScoringConfig();
    config.scoreInterpretationThresholds = [{ minScore: 50, text: "Good." }];

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /scoreInterpretationThresholds must include a catch-all entry with minScore: 0/
    );
  });

  it("fails if a scoreInterpretationThresholds entry has empty text", () => {
    const config = buildValidScoringConfig();
    config.scoreInterpretationThresholds = [{ minScore: 0, text: "" }];

    expect(() => validateStartupConfig(buildValidQuestionSet(), config)).toThrow(
      /scoreInterpretationThresholds entries must have non-empty text/
    );
  });

  it("reports every violation at once, not just the first", () => {
    const questionSet = buildValidQuestionSet();
    questionSet.categories = questionSet.categories.filter((c) => c.id !== "freedom");
    questionSet.questions = questionSet.questions.filter((q) => q.categoryId !== "freedom");

    const config = buildValidScoringConfig();
    config.categoryWeights.money = 0.9;

    try {
      validateStartupConfig(questionSet, config);
      throw new Error("expected validateStartupConfig to throw");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/Missing required category "freedom"/);
      expect(message).toMatch(/weight must be exactly 0.2/);
    }
  });
});
