/**
 * Domain entity: Answer.
 * A single respondent answer to a single question.
 */
export interface Answer {
  questionId: string;
  value: number;
}

/** A full, unscored set of answers submitted by a respondent. */
export interface AnswerSet {
  answers: Answer[];
}
