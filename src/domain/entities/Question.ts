/**
 * Domain entity: Question / Category.
 *
 * These types describe the SHAPE of an assessment question. They carry
 * no business logic and no knowledge of where questions come from
 * (JSON today, a CMS or DB later) — that is an infrastructure concern.
 */

export type QuestionOptionValue = number;

export interface QuestionOption {
  /** Numeric value used by the scoring engine. Higher = healthier. */
  value: QuestionOptionValue;
  /** Copy shown to the respondent. */
  label: string;
}

export type QuestionType = "single-select";

export interface Question {
  id: string;
  categoryId: string;
  /** Display order within the assessment. */
  order: number;
  text: string;
  helpText?: string;
  type: QuestionType;
  options: QuestionOption[];
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface QuestionSet {
  categories: Category[];
  questions: Question[];
}
