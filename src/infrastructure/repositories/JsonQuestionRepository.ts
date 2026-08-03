import { QuestionRepository } from "@/domain/repositories/QuestionRepository";
import { QuestionSet } from "@/domain/entities/Question";
import questionsData from "@/infrastructure/config/questions.json";

/**
 * Adapter: loads the question set from the bundled JSON config.
 * Sprint 1 requirement: "Implement the engine so questions are loaded
 * from JSON." Swap this class (behind QuestionRepository) for a CMS
 * or database-backed adapter later — nothing else in the app changes.
 */
export class JsonQuestionRepository implements QuestionRepository {
  async getQuestionSet(): Promise<QuestionSet> {
    return questionsData as unknown as QuestionSet;
  }
}
