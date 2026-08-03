import { QuestionSet } from "../entities/Question";

/**
 * Port: loads the assessment question set.
 * Sprint 1 implementation reads from JSON (see infrastructure/repositories),
 * but the application layer only ever depends on this interface.
 */
export interface QuestionRepository {
  getQuestionSet(): Promise<QuestionSet>;
}
