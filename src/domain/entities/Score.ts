import { Insight } from "../value-objects/Insight";

/**
 * Domain entity: scored outcome of a completed Business Health Check.
 * Produced by the Scoring Engine (application/infrastructure layer),
 * consumed by the UI and the Report Engine. Contains no scoring logic
 * itself — it is the pure result shape.
 */

export type ConfidenceLevel = "Low" | "Medium" | "High";

/**
 * Plain-language status for a single category, derived from its /20
 * score against ScoringConfig.categoryStatusThresholds.
 *
 * "Insufficient data" is a distinct state from "Constraint" — it means
 * the respondent skipped every question in that category (so there is
 * no evidence at all), not that the category was measured and found
 * weak. It is never chosen by score threshold; the scoring engine sets
 * it directly whenever a category has zero answered questions.
 */
export type CategoryStatus = "Strength" | "Developing" | "Constraint" | "Insufficient data";

export interface CategoryScore {
  categoryId: string;
  categoryName: string;
  /**
   * 0-20, normalized. The Business Minded Framework v1 is locked to
   * five equally-weighted categories, so this is simply this
   * category's fixed 20-point share of the 100-point overall score —
   * the five CategoryScore.score values always sum to exactly
   * AssessmentScoreResult.overallScore.
   */
  score: number;
  status: CategoryStatus;
}

/**
 * One of the "Top Three Priorities" shown on the Results page —
 * a concrete next step tied to the single category it would most
 * affect, so a reader always knows why it's there and what it moves.
 */
export interface PriorityItem {
  categoryId: string;
  /** The dimension this priority is expected to affect. */
  categoryName: string;
  action: string;
  whyItMatters: string;
  timeframe: string;
}

export interface AssessmentScoreResult {
  /** 0-100. Always exactly the sum of the five CategoryScore.score values. */
  overallScore: number;
  /**
   * Always exactly five entries — money, operations, growth, freedom,
   * resilience, in that fixed order — regardless of which questions
   * were answered. The framework is locked to these five dimensions;
   * Freedom is one of them and never a separate top-level score.
   */
  categoryScores: CategoryScore[];
  biggestOpportunity: Insight;
  biggestConstraint: Insight;
  topPriorities: PriorityItem[];
  confidenceLevel: ConfidenceLevel;
}
