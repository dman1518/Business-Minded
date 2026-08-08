import { describe, expect, it } from "vitest";
import { SubmitAssessment } from "@/application/use-cases/SubmitAssessment";
import { InvalidAnswersError } from "@/domain/policies/AnswerValidation";
import { ConfigurableScoringEngine } from "@/infrastructure/scoring-engine/ConfigurableScoringEngine";
import { QuestionRepository } from "@/domain/repositories/QuestionRepository";
import { ScoringConfigRepository } from "@/domain/repositories/ScoringConfigRepository";
import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { AssessmentScoreResult } from "@/domain/entities/Score";
import { Answer } from "@/domain/entities/Answer";
import { buildValidQuestionSet, buildValidScoringConfig } from "@/infrastructure/scoring-engine/__tests__/fixtures";
import { Segmentation } from "@/domain/value-objects/Segmentation";

/**
 * In-memory fakes for the two repository ports SubmitAssessment doesn't
 * validate against directly (question set + scoring config are trusted
 * config sources) plus a spying fake for the result repository, so these
 * tests can prove — end to end, at the use-case boundary the API route
 * actually calls — that a malformed/malicious payload is rejected before
 * it is ever scored or persisted.
 */
function buildFakeQuestionRepository(): QuestionRepository {
  return {
    getQuestionSet: async () => buildValidQuestionSet(),
  };
}

function buildFakeScoringConfigRepository(): ScoringConfigRepository {
  return {
    getConfig: async () => buildValidScoringConfig(),
  };
}

function buildSpyingResultRepository(): AssessmentResultRepository & {
  saveCallCount: number;
  lastSegmentation: Segmentation | undefined;
} {
  const state = { saveCallCount: 0, lastSegmentation: undefined as Segmentation | undefined };

  return {
    get saveCallCount() {
      return state.saveCallCount;
    },
    get lastSegmentation() {
      return state.lastSegmentation;
    },
    async save(
      result: AssessmentScoreResult,
      rawAnswers: Record<string, number>,
      segmentation?: Segmentation
    ): Promise<SavedAssessmentResult> {
      state.saveCallCount += 1;
      state.lastSegmentation = segmentation;
      return { ...result, id: "fake-id", rawAnswers, segmentation, createdAt: new Date("2026-01-01") };
    },
    async findById(): Promise<SavedAssessmentResult | null> {
      return null;
    },
  };
}

function buildUseCase() {
  const questionRepository = buildFakeQuestionRepository();
  const scoringConfigRepository = buildFakeScoringConfigRepository();
  const resultRepository = buildSpyingResultRepository();
  const scoringEngine = new ConfigurableScoringEngine();

  const useCase = new SubmitAssessment(
    questionRepository,
    scoringConfigRepository,
    scoringEngine,
    resultRepository
  );

  return { useCase, resultRepository };
}

function genuineAnswers(): Answer[] {
  return [
    { questionId: "money_1", value: 5 },
    { questionId: "money_2", value: 5 },
    { questionId: "operations_1", value: 1 },
    { questionId: "operations_2", value: 1 },
    { questionId: "growth_1", value: 3 },
  ];
}

describe("SubmitAssessment (server-side input integrity)", () => {
  it("scores and persists a genuinely valid submission", async () => {
    const { useCase, resultRepository } = buildUseCase();

    const result = await useCase.execute(genuineAnswers());

    expect(result.id).toBe("fake-id");
    expect(resultRepository.saveCallCount).toBe(1);
  });

  it("rejects a payload with an unknown question id and never scores or saves it", async () => {
    const { useCase, resultRepository } = buildUseCase();
    const malicious: Answer[] = [...genuineAnswers(), { questionId: "forged_question", value: 5 }];

    await expect(useCase.execute(malicious)).rejects.toBeInstanceOf(InvalidAnswersError);
    expect(resultRepository.saveCallCount).toBe(0);
  });

  it("rejects a payload with duplicate answers for the same question and never saves it", async () => {
    const { useCase, resultRepository } = buildUseCase();
    const malicious: Answer[] = [...genuineAnswers(), { questionId: "money_1", value: 1 }];

    await expect(useCase.execute(malicious)).rejects.toBeInstanceOf(InvalidAnswersError);
    expect(resultRepository.saveCallCount).toBe(0);
  });

  it("rejects a payload with an out-of-range value and never saves it", async () => {
    const { useCase, resultRepository } = buildUseCase();
    const malicious: Answer[] = [...genuineAnswers(), { questionId: "freedom_1", value: 9001 }];

    await expect(useCase.execute(malicious)).rejects.toBeInstanceOf(InvalidAnswersError);
    expect(resultRepository.saveCallCount).toBe(0);
  });

  it("cannot have its confidence inflated by padding a payload with forged question ids", async () => {
    const { useCase: honestUseCase } = buildUseCase();
    const honestResult = await honestUseCase.execute(genuineAnswers()); // 5/10 answered

    // An attacker who could bypass shape validation and reach the use
    // case directly with forged extra ids still gets hard-rejected —
    // there is no path through which padding raises completeness.
    const { useCase: maliciousUseCase } = buildUseCase();
    const padded: Answer[] = [
      ...genuineAnswers(),
      { questionId: "forged_1", value: 5 },
      { questionId: "forged_2", value: 5 },
      { questionId: "forged_3", value: 5 },
      { questionId: "forged_4", value: 5 },
      { questionId: "forged_5", value: 5 },
    ];

    await expect(maliciousUseCase.execute(padded)).rejects.toBeInstanceOf(InvalidAnswersError);
    expect(honestResult.confidenceLevel).toBe("Low"); // 5/10 = 50%
  });

  it("passes optional segmentation through to the repository unchanged", async () => {
    const { useCase, resultRepository } = buildUseCase();
    const segmentation: Segmentation = { industry: "retail_ecommerce", companySize: "6_20" };

    const result = await useCase.execute(genuineAnswers(), segmentation);

    expect(resultRepository.lastSegmentation).toEqual(segmentation);
    expect(result.segmentation).toEqual(segmentation);
  });

  it("saves with segmentation undefined when the intro screen was skipped entirely", async () => {
    const { useCase, resultRepository } = buildUseCase();

    await useCase.execute(genuineAnswers());

    expect(resultRepository.lastSegmentation).toBeUndefined();
  });
});
