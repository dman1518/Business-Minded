import { describe, expect, it } from "vitest";
import { Answer } from "@/domain/entities/Answer";
import { validateAnswers, InvalidAnswersError } from "@/domain/policies/AnswerValidation";
import { buildValidQuestionSet } from "@/infrastructure/scoring-engine/__tests__/fixtures";

function genuineAnswers(): Answer[] {
  return [
    { questionId: "money_1", value: 5 },
    { questionId: "money_2", value: 4 },
    { questionId: "operations_1", value: 3 },
  ];
}

describe("validateAnswers", () => {
  it("returns the answers unchanged when every answer is known, unique, and in range", () => {
    const questionSet = buildValidQuestionSet();
    const answers = genuineAnswers();

    expect(validateAnswers(answers, questionSet)).toEqual(answers);
  });

  it("rejects an answer referencing an unknown question id", () => {
    const questionSet = buildValidQuestionSet();
    const answers: Answer[] = [...genuineAnswers(), { questionId: "not_a_real_question", value: 3 }];

    expect(() => validateAnswers(answers, questionSet)).toThrow(InvalidAnswersError);
  });

  it("rejects a duplicate answer for the same question instead of silently coalescing it", () => {
    const questionSet = buildValidQuestionSet();
    const answers: Answer[] = [...genuineAnswers(), { questionId: "money_1", value: 1 }];

    expect(() => validateAnswers(answers, questionSet)).toThrow(InvalidAnswersError);
  });

  it("rejects a value that is not one of the question's configured option values", () => {
    const questionSet = buildValidQuestionSet();
    // Fixture questions use a 1-5 scale; 999 is out of range.
    const answers: Answer[] = [...genuineAnswers(), { questionId: "growth_1", value: 999 }];

    expect(() => validateAnswers(answers, questionSet)).toThrow(InvalidAnswersError);
  });

  it("rejects a non-integer value even if it is numerically close to a valid one", () => {
    const questionSet = buildValidQuestionSet();
    const answers: Answer[] = [{ questionId: "money_1", value: 5.5 }];

    expect(() => validateAnswers(answers, questionSet)).toThrow(InvalidAnswersError);
  });

  it("aggregates every violation into a single error's issues list, in server-log-only detail", () => {
    const questionSet = buildValidQuestionSet();
    const answers: Answer[] = [
      { questionId: "money_1", value: 5 },
      { questionId: "money_1", value: 1 }, // duplicate
      { questionId: "not_real", value: 3 }, // unknown
      { questionId: "growth_1", value: 42 }, // invalid value
    ];

    try {
      validateAnswers(answers, questionSet);
      throw new Error("expected validateAnswers to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAnswersError);
      const invalidAnswersError = error as InvalidAnswersError;
      expect(invalidAnswersError.issues.length).toBeGreaterThanOrEqual(3);
      expect(invalidAnswersError.issues.some((i) => i.includes("Duplicate"))).toBe(true);
      expect(invalidAnswersError.issues.some((i) => i.includes("Unknown question id"))).toBe(true);
      expect(invalidAnswersError.issues.some((i) => i.includes("Invalid value"))).toBe(true);
      // The public-facing error message itself never leaks question ids or values.
      expect(invalidAnswersError.message).not.toContain("money_1");
      expect(invalidAnswersError.message).not.toContain("42");
    }
  });

  it("rejects an empty-string question id since it references no real question", () => {
    const questionSet = buildValidQuestionSet();
    const answers: Answer[] = [{ questionId: "", value: 3 }];

    expect(() => validateAnswers(answers, questionSet)).toThrow(InvalidAnswersError);
  });
});
