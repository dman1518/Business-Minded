import { QuestionRepository } from "@/domain/repositories/QuestionRepository";
import { QuestionSet } from "@/domain/entities/Question";

/**
 * Use case: fetch the current assessment question set.
 * Depends only on the QuestionRepository port — swapping JSON for a
 * CMS/DB later requires no change here or in the UI.
 */
export class GetQuestionSet {
  constructor(private readonly questionRepository: QuestionRepository) {}

  async execute(): Promise<QuestionSet> {
    const questionSet = await this.questionRepository.getQuestionSet();
    return {
      ...questionSet,
      questions: [...questionSet.questions].sort((a, b) => a.order - b.order),
    };
  }
}
