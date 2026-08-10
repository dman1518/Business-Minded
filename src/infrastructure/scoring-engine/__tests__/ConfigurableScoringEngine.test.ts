import { describe, expect, it } from "vitest";
import { ConfigurableScoringEngine } from "@/infrastructure/scoring-engine/ConfigurableScoringEngine";
import { InsufficientDataError } from "@/domain/policies/InsufficientDataError";
import { Answer } from "@/domain/entities/Answer";
import { buildValidQuestionSet, buildValidScoringConfig } from "./fixtures";

const engine = new ConfigurableScoringEngine();

/**
 * money -> 5,5   (normalized 100 -> 20/20, Strength)
 * operations -> 1,1 (normalized 0 -> 0/20, Constraint)
 * growth -> 3,3  (normalized 50 -> 10/20, Developing)
 * freedom -> 4,4 (normalized 75 -> 15/20, Solid)
 * resilience -> 2,2 (normalized 25 -> 5/20, Constraint)
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

    expect(result.scoreDisplay.value).toBe(50);
    expect(result.scoreDisplay.suppressed).toBe(false);
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
    expect(sumOfDimensions).toBe(result.scoreDisplay.value);
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
    expect(result.scoreDisplay.value).toBe(100);
  });

  it("REQUIRED TEST: Freedom is included in the overall score and is never a separate top-level score", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);
    const freedom = result.categoryScores.find((c) => c.categoryId === "freedom");

    expect(freedom).toBeDefined();
    expect(freedom?.score).toBe(15);
    // Freedom contributes to the headline score like every other
    // category — there is no separate "freedom score" field anywhere.
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

  it("assigns a category status from the configured four-tier thresholds", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);
    const statusById = Object.fromEntries(result.categoryScores.map((c) => [c.categoryId, c.status]));

    expect(statusById.money).toBe("Strength"); // 20 >= 18
    expect(statusById.freedom).toBe("Solid"); // 14 <= 15 < 18
    expect(statusById.growth).toBe("Developing"); // 8 <= 10 < 14
    expect(statusById.operations).toBe("Constraint"); // 0
    expect(statusById.resilience).toBe("Constraint"); // 5 < 8
  });

  it("marks a fully-skipped category as Insufficient data, never scores it as a measured zero, and excludes it from role selection", () => {
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
    expect(freedom?.answeredCount).toBe(0);

    // Headline score is the sum of the four SCOREABLE dimensions only
    // (money 20 + operations 0 + growth 10 + resilience 5 = 35) — not
    // suppressed, since 4 of 5 dimensions have real evidence.
    expect(result.scoreDisplay.suppressed).toBe(false);
    expect(result.scoreDisplay.value).toBe(35);
    expect(result.scoreDisplay.scoreableDimensionCount).toBe(4);

    // Freedom must never be selected as the constraint, opportunity, or a
    // priority just because "Insufficient data" scores 0 — that would
    // misrepresent missing evidence as a measured weakness.
    expect(result.roles.constraint?.categoryId).not.toBe("freedom");
    expect(result.roles.opportunity?.categoryId).not.toBe("freedom");
    expect(result.roles.strength?.categoryId).not.toBe("freedom");
    expect(result.topPriorities.map((p) => p.categoryId)).not.toContain("freedom");
  });

  it("scores a category from a single answered question when its sibling question is skipped, and flags reduced confidence", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const answers = fullAnswers().filter((a) => a.questionId !== "money_2");

    const result = engine.score(answers, questionSet, config);
    const money = result.categoryScores.find((c) => c.categoryId === "money");

    // money_1 alone = 5 -> normalized 100 -> 20/20.
    expect(money?.score).toBe(20);
    expect(money?.status).toBe("Strength");
    expect(money?.answeredCount).toBe(1);
    expect(money?.applicableCount).toBe(2);
    expect(money?.reducedConfidence).toBe(true);
  });

  it("REQUIRED TEST: throws InsufficientDataError (not a generic error) if every question was skipped", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    expect(() => engine.score([], questionSet, config)).toThrow(InsufficientDataError);
  });

  it("REQUIRED TEST: suppresses the headline score entirely when fewer than three of five dimensions have evidence (1 of 10 answered)", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score([{ questionId: "resilience_1", value: 3 }], questionSet, config);

    expect(result.scoreDisplay.suppressed).toBe(true);
    expect(result.scoreDisplay.value).toBeNull();
    expect(result.scoreDisplay.answeredQuestionCount).toBe(1);
    expect(result.scoreDisplay.totalQuestionCount).toBe(10);
    expect(result.scoreDisplay.scoreableDimensionCount).toBe(1);

    // The one answered dimension must not simultaneously be presented
    // as What's Working, Biggest Constraint, AND Biggest Opportunity —
    // with only one scoreable dimension there is nothing to compare
    // against, so at most one ranked role is assigned to it.
    const filledRoles = [result.roles.strength, result.roles.constraint, result.roles.opportunity].filter(
      (r) => r !== null
    );
    expect(filledRoles.length).toBeLessThanOrEqual(1);
  });

  it("ranks the lowest-scoring category as the constraint and the next-lowest as the opportunity", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);

    // operations (0) is lowest, resilience (5) is second-lowest.
    expect(result.roles.constraint?.categoryId).toBe("operations");
    expect(result.roles.opportunity?.categoryId).toBe("resilience");
    expect(result.roles.strength?.categoryId).toBe("money");
  });

  it("REQUIRED INVARIANT: strength, constraint, and opportunity are always three distinct dimensions", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);
    const ids = [result.roles.strength?.categoryId, result.roles.constraint?.categoryId, result.roles.opportunity?.categoryId];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cites the actual score as evidence in the constraint and opportunity descriptions", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);

    expect(result.roles.constraint?.description).toContain("0/20");
    expect(result.roles.opportunity?.description).toContain("5/20");
  });

  it("returns action/why/timeframe/status for the N lowest-priority categories as top priorities", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);

    // Priority order: Constraint-band first (operations 0, resilience 5),
    // then Developing (growth 10), then Solid (freedom), then Strength
    // (money) — capped at topPriorityCount (3).
    expect(result.topPriorities.map((p) => p.categoryId)).toEqual(["operations", "resilience", "growth"]);
    expect(result.topPriorities[0]).toEqual({
      categoryId: "operations",
      categoryName: "Operations",
      status: "Constraint",
      action: config.categoryInsights.operations.Constraint.priorityAction,
      whyItMatters: config.categoryInsights.operations.Constraint.priorityWhyItMatters,
      timeframe: config.categoryInsights.operations.Constraint.priorityTimeframe,
    });
  });

  describe("REQUIRED TEST: complete tie at every performance band", () => {
    it("all-low tie (every dimension Constraint) reports a balanced-risk tie state instead of inventing a strength", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const allLow: Answer[] = questionSet.questions.map((q) => ({ questionId: q.id, value: 1 }));
      const result = engine.score(allLow, questionSet, config);

      expect(result.scoreDisplay.value).toBe(0);
      expect(result.roles.tieState).toBe("all-low-tied");
      expect(result.roles.strength).toBeNull();
      expect(result.roles.constraint).toBeNull();
      expect(result.roles.opportunity).toBeNull();
      expect(result.roles.tieMessage).toBeTruthy();
      // Priorities are still generated (foundational framework order),
      // never zero just because of the tie.
      expect(result.topPriorities.length).toBe(config.topPriorityCount);
    });

    it("all-high tie (every dimension Strength) reports a balanced-strength tie state and never shows a fabricated constraint", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const allHigh: Answer[] = questionSet.questions.map((q) => ({ questionId: q.id, value: 5 }));
      const result = engine.score(allHigh, questionSet, config);

      expect(result.scoreDisplay.value).toBe(100);
      expect(result.roles.tieState).toBe("all-high-tied");
      expect(result.roles.constraint).toBeNull();
      expect(result.roles.strength).toBeNull();
      expect(result.roles.opportunity).toBeNull();
      // A perfect score must get band-appropriate (Strength) priority
      // copy, never the same remedial copy a zero-score business gets.
      for (const priority of result.topPriorities) {
        expect(priority.status).toBe("Strength");
        expect(priority.action).toBe(config.categoryInsights[priority.categoryId].Strength.priorityAction);
      }
    });

    it("midrange tie (every dimension Developing) discloses the tie rather than implying false precision", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const allMid: Answer[] = questionSet.questions.map((q) => ({ questionId: q.id, value: 3 }));
      const result = engine.score(allMid, questionSet, config);

      expect(result.roles.tieState).toBe("midrange-tied");
      expect(result.roles.strength).toBeNull();
      expect(result.roles.constraint).toBeNull();
      expect(result.roles.opportunity).toBeNull();
      expect(result.roles.tieMessage).toMatch(/balanced/i);
    });

    it("tie at the Solid band also discloses the tie rather than fabricating a unique standout", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      // value 4 on a 1-5 scale -> normalized 75 -> 15/20 -> Solid band for every dimension.
      const allSolid: Answer[] = questionSet.questions.map((q) => ({ questionId: q.id, value: 4 }));
      const result = engine.score(allSolid, questionSet, config);

      const statuses = new Set(result.categoryScores.map((c) => c.status));
      expect(statuses).toEqual(new Set(["Solid"]));
      expect(result.roles.tieState).toBe("midrange-tied");
      expect(result.roles.strength).toBeNull();
      expect(result.roles.constraint).toBeNull();
      expect(result.roles.opportunity).toBeNull();
    });
  });

  it("REQUIRED TEST: one skipped question in every dimension still scores every dimension, with reduced confidence throughout", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    // Every category answers its _1 question and skips its _2 question.
    const answers: Answer[] = ["money", "operations", "growth", "freedom", "resilience"].map((id) => ({
      questionId: `${id}_1`,
      value: 3,
    }));

    const result = engine.score(answers, questionSet, config);

    expect(result.categoryScores).toHaveLength(5);
    for (const category of result.categoryScores) {
      expect(category.status).not.toBe("Insufficient data");
      expect(category.answeredCount).toBe(1);
      expect(category.applicableCount).toBe(2);
      expect(category.reducedConfidence).toBe(true);
    }
    expect(result.scoreDisplay.scoreableDimensionCount).toBe(5);
    expect(result.scoreDisplay.suppressed).toBe(false);
    expect(result.confidenceLevel).toBe("Low"); // 5/10 = 50%, below the 60% Medium floor
  });

  it("REQUIRED TEST: recommendation copy is selected correctly for every dimension and every performance band", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();
    const bandValueByBand: Record<"Constraint" | "Developing" | "Solid" | "Strength", number> = {
      Constraint: 1, // -> 0/20
      Developing: 3, // -> 10/20
      Solid: 4, // -> 15/20
      Strength: 5, // -> 20/20
    };

    for (const categoryId of ["money", "operations", "growth", "freedom", "resilience"] as const) {
      for (const band of ["Constraint", "Developing", "Solid", "Strength"] as const) {
        // Score the target category at the target band, and every other
        // category at a fixed Developing value so ties never interfere.
        const answers: Answer[] = questionSet.questions.map((q) => ({
          questionId: q.id,
          value: q.categoryId === categoryId ? bandValueByBand[band] : 3,
        }));
        const result = engine.score(answers, questionSet, config);
        const category = result.categoryScores.find((c) => c.categoryId === categoryId)!;

        expect(category.status).toBe(band);

        const priority = result.topPriorities.find((p) => p.categoryId === categoryId);
        if (priority) {
          const expectedCopy = config.categoryInsights[categoryId][band];
          expect(priority.action).toBe(expectedCopy.priorityAction);
          expect(priority.whyItMatters).toBe(expectedCopy.priorityWhyItMatters);
          expect(priority.timeframe).toBe(expectedCopy.priorityTimeframe);
          expect(priority.status).toBe(band);
        }

        for (const role of [result.roles.strength, result.roles.constraint, result.roles.opportunity]) {
          if (role?.categoryId === categoryId) {
            expect(role.headline).toBe(config.categoryInsights[categoryId][band].headline);
          }
        }
      }
    }
  });

  it("REQUIRED INVARIANT: every narrative score cited in a role's description matches that dimension's actual displayed score", () => {
    const questionSet = buildValidQuestionSet();
    const config = buildValidScoringConfig();

    const result = engine.score(fullAnswers(), questionSet, config);

    for (const role of [result.roles.strength, result.roles.constraint, result.roles.opportunity]) {
      if (!role) continue;
      const category = result.categoryScores.find((c) => c.categoryId === role.categoryId)!;
      expect(role.description).toContain(`${category.score}/20`);
    }
  });

  describe("REQUIRED TEST: eligible-dimension-count edge cases", () => {
    it("one eligible dimension never gets slotted into more than one role, and priorities never exceed one", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const answers: Answer[] = [{ questionId: "money_1", value: 5 }, { questionId: "money_2", value: 5 }];
      const result = engine.score(answers, questionSet, config);

      expect(result.scoreDisplay.scoreableDimensionCount).toBe(1);
      const filledRoles = [result.roles.strength, result.roles.constraint, result.roles.opportunity].filter(
        (r) => r !== null
      );
      expect(filledRoles.length).toBeLessThanOrEqual(1);
      expect(result.topPriorities.length).toBeLessThanOrEqual(1);
    });

    it("two eligible dimensions produce at most two distinct roles and at most two priorities", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const answers: Answer[] = [
        { questionId: "money_1", value: 5 },
        { questionId: "money_2", value: 5 },
        { questionId: "operations_1", value: 1 },
        { questionId: "operations_2", value: 1 },
      ];
      const result = engine.score(answers, questionSet, config);

      expect(result.scoreDisplay.scoreableDimensionCount).toBe(2);
      expect(result.roles.strength?.categoryId).toBe("money");
      expect(result.roles.constraint?.categoryId).toBe("operations");
      expect(result.topPriorities.length).toBeLessThanOrEqual(2);
    });

    it("three eligible dimensions can populate all three roles distinctly", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const answers: Answer[] = [
        { questionId: "money_1", value: 5 },
        { questionId: "money_2", value: 5 },
        { questionId: "operations_1", value: 1 },
        { questionId: "operations_2", value: 1 },
        { questionId: "growth_1", value: 3 },
        { questionId: "growth_2", value: 3 },
      ];
      const result = engine.score(answers, questionSet, config);

      expect(result.scoreDisplay.scoreableDimensionCount).toBe(3);
      expect(result.roles.strength?.categoryId).toBe("money");
      expect(result.roles.constraint?.categoryId).toBe("operations");
      expect(result.roles.opportunity?.categoryId).toBe("growth");
    });
  });

  describe("REQUIRED INVARIANT: band/status language never contradicts the score", () => {
    it("a 20/20 dimension is never described with constraint language", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const answers: Answer[] = [
        { questionId: "money_1", value: 5 },
        { questionId: "money_2", value: 5 },
        { questionId: "operations_1", value: 1 },
        { questionId: "operations_2", value: 1 },
      ];
      const result = engine.score(answers, questionSet, config);

      expect(result.roles.strength?.categoryId).toBe("money");
      expect(result.roles.constraint?.categoryId).not.toBe("money");
    });

    it("a 0/20 dimension is never described with strength language", () => {
      const questionSet = buildValidQuestionSet();
      const config = buildValidScoringConfig();

      const answers: Answer[] = [
        { questionId: "money_1", value: 5 },
        { questionId: "money_2", value: 5 },
        { questionId: "operations_1", value: 1 },
        { questionId: "operations_2", value: 1 },
      ];
      const result = engine.score(answers, questionSet, config);

      expect(result.roles.constraint?.categoryId).toBe("operations");
      expect(result.roles.strength?.categoryId).not.toBe("operations");
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

      expect(highScoreResult.scoreDisplay.value).not.toBe(lowScoreResult.scoreDisplay.value);
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
      expect(forgedResult.scoreDisplay.value).toBe(genuineResult.scoreDisplay.value);
    });
  });
});
