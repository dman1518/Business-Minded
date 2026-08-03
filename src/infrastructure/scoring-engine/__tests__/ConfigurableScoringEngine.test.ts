import { describe, expect, it } from "vitest";
import { ConfigurableScoringEngine } from "@/infrastructure/scoring-engine/ConfigurableScoringEngine";
import { Answer } from "@/domain/entities/Answer";
import { buildValidQuestionSet, buildValidScoringConfig } from "./fixtures";

const engine = new ConfigurableScoringEngine();

/**
 * money -> 5,5   (normalized 100)
 * operations -> 1,1 (normalized 0)
 * growth -> 3,3  (normalized 50)
 * freedom -> 4,4 (normalized 75)
 * resilience -> 2,2 (normalized 25)
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

    // (100 + 0 + 50 + 75 + 25) * 0.2 = 50, exactly.
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

  it("normalizes category scores from the configured scale to 0-100", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);
    const byId = Object.fromEntries(result.categoryScores.map((c) => [c.categoryId, c.score]));

    expect(byId.money).toBe(100);
    expect(byId.operations).toBe(0);
    expect(byId.growth).toBe(50);
    expect(byId.freedom).toBe(75);
    expect(byId.resilience).toBe(25);
  });

  it("excludes a fully-skipped category and re-normalizes weight across the rest", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    // Drop freedom entirely (respondent skipped both freedom questions).
    const answers = fullAnswers().filter((a) => !a.questionId.startsWith("freedom"));

    const result = engine.score(answers, questionSet, config);

    expect(result.categoryScores.find((c) => c.categoryId === "freedom")).toBeUndefined();
    expect(result.categoryScores).toHaveLength(4);

    // Remaining categories (money 100, operations 0, growth 50, resilience 25),
    // each re-weighted to 0.25 of the total after freedom is dropped:
    // 100*0.25 + 0*0.25 + 50*0.25 + 25*0.25 = 43.75 -> rounds to 44.
    expect(result.overallScore).toBe(44);
  });

  it("scores a category from a single answered question when its sibling question is skipped", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const answers = fullAnswers().filter((a) => a.questionId !== "money_2");

    const result = engine.score(answers, questionSet, config);
    const money = result.categoryScores.find((c) => c.categoryId === "money");

    // money_1 alone = 5 -> normalized 100.
    expect(money?.score).toBe(100);
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

    // operations (0) is lowest, resilience (25) is second-lowest.
    expect(result.biggestConstraint.categoryId).toBe("operations");
    expect(result.biggestOpportunity.categoryId).toBe("resilience");
  });

  it("returns the recommendations for the N lowest-scoring categories as top priorities", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);

    // Lowest three: operations (0), resilience (25), growth (50).
    expect(result.topPriorities).toEqual([
      config.categoryInsights.operations.recommendation,
      config.categoryInsights.resilience.recommendation,
      config.categoryInsights.growth.recommendation,
    ]);
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
