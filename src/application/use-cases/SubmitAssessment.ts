import { Answer } from "@/domain/entities/Answer";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { QuestionRepository } from "@/domain/repositories/QuestionRepository";
import { ScoringConfigRepository } from "@/domain/repositories/ScoringConfigRepository";
import { ScoringEngine } from "@/domain/repositories/ScoringEngine";
import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";
import { validateAnswers } from "@/domain/policies/AnswerValidation";
import { Segmentation } from "@/domain/value-objects/Segmentation";

/**
 * Use case: score a completed assessment and persist the result.
 *
 * Orchestrates domain ports only — the Scoring Engine implementation,
 * question source, and config source are all injected. No scoring
 * rules live in this class or in any UI component.
 */
export class SubmitAssessment {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly scoringConfigRepository: ScoringConfigRepository,
    private readonly scoringEngine: ScoringEngine,
    private readonly assessmentResultRepository: AssessmentResultRepository
  ) {}

  async execute(answers: Answer[], segmentation?: Segmentation): Promise<SavedAssessmentResult> {
    if (!answers.length) {
      throw new Error("At least one answer is required to score an assessment.");
    }

    const [questionSet, config] = await Promise.all([
      this.questionRepository.getQuestionSet(),
      this.scoringConfigRepository.getConfig(),
    ]);

    // Server-side semantic validation against the canonical question
    // set — never trust the client. Throws InvalidAnswersError (caught
    // by the API route and turned into a generic 400) for unknown
    // question ids, duplicate answers, or values outside that
    // question's configured options, so the Scoring Engine only ever
    // sees clean, known, unique answers.
    const validAnswers = validateAnswers(answers, questionSet);

    const result = this.scoringEngine.score(validAnswers, questionSet, config);

    const rawAnswers = validAnswers.reduce<Record<string, number>>((acc, a) => {
      acc[a.questionId] = a.value;
      return acc;
    }, {});

    return this.assessmentResultRepository.save(result, rawAnswers, segmentation);
  }
}
