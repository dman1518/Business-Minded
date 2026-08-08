import { describe, expect, it } from "vitest";
import { ConfigurableScoringEngine } from "@/infrastructure/scoring-engine/ConfigurableScoringEngine";
import { Answer } from "@/domain/entities/Answer";
import { buildValidQuestionSet, buildValidScoringConfig } from "./fixtures";

const engine = new ConfigurableScoringEngine();

/**
 * money -> 5,5   (normalized 100 -> 20/20)
 * operations -> 1,1 (normalized 0 -> 0/20)
 * growth -> 3,3  (normalized 50 -> 10/20)
 * freedom -> 4,4 (normalized 75 -> 15/20)
 * resilience -> 2,2 (normalized 25 -> 5/20)
 * sum: 20 + 0 + 10 + 15 + 5 = 50
 */
function fullAnswers(): Answer[] {
  return [
    { questionId: "money_1", value: 5 },
    { questionId: "money_2", value: 5 },
    { questionId: "operations_1", value: 1 },
    { questionId: "operations_2", value: 1 },
    { questionId: "growth_1", value: 3 },
    { questionId: "growth_2", value: 3 },
    { questionId: "freedom_1", value: 4 },
    { questionId: "freedom_2", value: 4 },
    { questionId: "resilience_1", value: 2 },
    { questionId: "resilience_2", value: 2 },
  ];
}

describe("ConfigurableScoringEngine", () => {
  it("weighs all five categories equally at 20% and computes a deterministic overall score", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    for (const id of Object.keys(config.categoryWeights)) {
      expect(config.categoryWeights[id]).toBeCloseTo(0.2);
    }
    const totalWeight = Object.values(config.categoryWeights).reduce((a, b) => a + b, 0);
    expect(totalWeight).toBeCloseTo(1.0);

    const result = engine.score(fullAnswers(), questionSet, config);

    expect(result.overallScore).toBe(50);
  });

  it("produces the same result for the same input every time (deterministic, no randomness)", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();
    const answers = fullAnswers();

    const first = engine.score(answers, questionSet, config);
    const second = engine.score(answers, questionSet, config);

    expect(second).toEqual(first);
  });

  it("REQUIRED TEST: always returns exactly five dimensions, and their scores sum to the overall score", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);

    expect(result.categoryScores).toHaveLength(5);
    expect(result.categoryScores.map((c) => c.categoryId)).toEqual([
      "money",
      "operations",
      "growth",
      "freedom",
      "resilience",
    ]);

    const sumOfDimensions = result.categoryScores.reduce((sum, c) => sum + c.score, 0);
    expect(sumOfDimensions).toBe(result.overallScore);
  });

  it("REQUIRED TEST: each dimension score is capped at 20 points", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    // Max out every answer.
    const maxAnswers: Answer[] = questionSet.questions.map((q) => ({ questionId: q.id, value: 5 }));
    const result = engine.score(maxAnswers, questionSet, config);

    for (const category of result.categoryScores) {
      expect(category.score).toBeLessThanOrEqual(20);
      expect(category.score).toBeGreaterThanOrEqual(0);
    }
    expect(result.overallScore).toBe(100);
  });

  it("REQUIRED TEST: Freedom is included in the overall score and is never a separate top-level score", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);
    const freedom = result.categoryScores.find((c) => c.categoryId === "freedom");

    expect(freedom).toBeDefined();
    expect(freedom?.score).toBe(15);
    // Freedom contributes to overallScore like every other category —
    // there is no separate "freedom score" field anywhere on the result.
    expect(Object.keys(result)).not.toContain("freedomScore");
    expect(Object.keys(result)).not.toContain("freedom");
  });

  it("normalizes category scores to a 0-20 scale", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);
    const byId = Object.fromEntries(result.categoryScores.map((c) => [c.categoryId, c.score]));

    expect(byId.money).toBe(20);
    expect(byId.operations).toBe(0);
    expect(byId.growth).toBe(10);
    expect(byId.freedom).toBe(15);
    expect(byId.resilience).toBe(5);
  });

  it("assigns a category status from the configured thresholds", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);
    const statusById = Object.fromEntries(result.categoryScores.map((c) => [c.categoryId, c.status]));

    expect(statusById.money).toBe("Strength"); // 20 >= 16
    expect(statusById.freedom).toBe("Developing"); // 15, 10 <= 15 < 16
    expect(statusById.growth).toBe("Developing"); // 10 >= 10
    expect(statusById.operations).toBe("Constraint"); // 0
    expect(statusById.resilience).toBe("Constraint"); // 5 < 10
  });

  it("marks a fully-skipped category as Insufficient data, scores it 0, and excludes it from ranking-based selections", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    // Drop freedom entirely (respondent skipped both freedom questions).
    const answers = fullAnswers().filter((a) => !a.questionId.startsWith("freedom"));

    const result = engine.score(answers, questionSet, config);

    // Still exactly five dimensions — freedom is present, just unscored.
    expect(result.categoryScores).toHaveLength(5);
    const freedom = result.categoryScores.find((c) => c.categoryId === "freedom");
    expect(freedom?.score).toBe(0);
    expect(freedom?.status).toBe("Insufficient data");

    // Overall score is the direct sum of all five (missing category contributes 0).
    // money 20 + operations 0 + growth 10 + freedom 0 + resilience 5 = 35.
    expect(result.overallScore).toBe(35);

    // Freedom must never be selected as the constraint, opportunity, or a
    // priority just because "Insufficient data" scores 0 — that would
    // misrepresent missing evidence as a measured weakness.
    expect(result.biggestConstraint.categoryId).not.toBe("freedom");
    expect(result.biggestOpportunity.categoryId).not.toBe("freedom");
    expect(result.topPriorities.map((p) => p.categoryId)).not.toContain("freedom");
  });

  it("scores a category from a single answered question when its sibling question is skipped", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const answers = fullAnswers().filter((a) => a.questionId !== "money_2");

    const result = engine.score(answers, questionSet, config);
    const money = result.categoryScores.find((c) => c.categoryId === "money");

    // money_1 alone = 5 -> normalized 100 -> 20/20.
    expect(money?.score).toBe(20);
    expect(money?.status).toBe("Strength");
  });

  it("throws if every question was skipped", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    expect(() => engine.score([], questionSet, config)).toThrow();
  });

  it("ranks the lowest-scoring category as the constraint and the next-lowest as the opportunity", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);

    // operations (0) is lowest, resilience (5) is second-lowest.
    expect(result.biggestConstraint.categoryId).toBe("operations");
    expect(result.biggestOpportunity.categoryId).toBe("resilience");
  });

  it("cites the actual score as evidence in the constraint and opportunity descriptions", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);

    expect(result.biggestConstraint.description).toContain("0/20");
    expect(result.biggestOpportunity.description).toContain("5/20");
  });

  it("returns action/why/timeframe for the N lowest-scoring categories as top priorities", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);

    // Lowest three: operations (0), resilience (5), growth (10).
    expect(result.topPriorities.map((p) => p.categoryId)).toEqual(["operations", "resilience", "growth"]);
    expect(result.topPriorities[0]).toEqual({
      categoryId: "operations",
      categoryName: "Operations",
      action: config.categoryInsights.operations.priorityAction,
      whyItMatters: config.categoryInsights.operations.priorityWhyItMatters,
      timeframe: config.categoryInsights.operations.priorityTimeframe,
    });
  });

  describe("confidence — evidence completeness, not score spread", () => {
    it("is High when at least 90% of questions are answered", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const result = engine.score(fullAnswers(), questionSet, config); // 10/10 = 100%
      expect(result.confidenceLevel).toBe("High");
    });

    it("is Medium at exactly the 60% boundary", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      // 6 of 10 questions answered = 60% completeness.
      const answers = fullAnswers().slice(0, 6);
      const result = engine.score(answers, questionSet, config);
      expect(result.confidenceLevel).toBe("Medium");
    });

    it("is Low below the 60% completeness floor", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      // 5 of 10 questions answered = 50% completeness.
      const answers = fullAnswers().slice(0, 5);
      const result = engine.score(answers, questionSet, config);
      expect(result.confidenceLevel).toBe("Low");
    });

    it("does not change with score spread when completeness is held constant", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      // Same 8/10 completeness (80%), wildly different scores.
      const allHighAnswers: Answer[] = [
        "money_1", "money_2", "operations_1", "operations_2",
        "growth_1", "growth_2", "freedom_1", "freedom_2",
      ].map((questionId) => ({ questionId, value: 5 }));

      const allLowAnswers: Answer[] = [
        "money_1", "money_2", "operations_1", "operations_2",
        "growth_1", "growth_2", "freedom_1", "freedom_2",
      ].map((questionId) => ({ questionId, value: 1 }));

      const highScoreResult = engine.score(allHighAnswers, questionSet, config);
      const lowScoreResult = engine.score(allLowAnswers, questionSet, config);

      expect(highScoreResult.overallScore).not.toBe(lowScoreResult.overallScore);
      expect(highScoreResult.confidenceLevel).toBe(lowScoreResult.confidenceLevel);
      expect(highScoreResult.confidenceLevel).toBe("Medium");
    });

    it("only counts each question once even if duplicate answers are submitted", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const answers = fullAnswers().slice(0, 6);
      const duplicated = [...answers, { ...answers[0] }, { ...answers[1] }];

      const result = engine.score(duplicated, questionSet, config);
      expect(result.confidenceLevel).toBe("Medium"); // still 6/10 unique = 60%
    });

    it("never counts answers referencing unknown question ids toward completeness (defense in depth)", () => {
      // In normal operation validateAnswers() rejects this payload
      // before it ever reaches the engine. This test proves the engine
      // itself is also hardened: even if it were ever called directly
      // with unvalidated input, bogus questionIds cannot inflate
      // confidence above what the real, known answers support.
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const genuineAnswers = fullAnswers().slice(0, 5); // 5/10 = 50% -> Low
      const withForgedExtras: Answer[] = [
        ...genuineAnswers,
        { questionId: "not_a_real_question", value: 5 },
        { questionId: "another_fake_id", value: 5 },
        { questionId: "yet_another_fake_id", value: 5 },
        { questionId: "one_more_fake_id", value: 5 },
        { questionId: "final_fake_id", value: 5 },
      ];

      const genuineResult = engine.score(genuineAnswers, questionSet, config);
      const forgedResult = engine.score(withForgedExtras, questionSet, config);

      expect(genuineResult.confidenceLevel).toBe("Low");
      // Forged extras must not push completeness from 50% to 100%.
      expect(forgedResult.confidenceLevel).toBe("Low");
      expect(forgedResult.confidenceLevel).toBe(genuineResult.confidenceLevel);
      // Scores are unaffected too — forged ids never map to a real category.
      expect(forgedResult.overallScore).toBe(genuineResult.overallScore);
    });
  });
});
