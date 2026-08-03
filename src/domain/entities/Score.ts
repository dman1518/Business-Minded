import { Insight } from "../value-objects/Insight";

/**
 * Domain entity: scored outcome of a completed Business Health Check.
 * Produced by the Scoring Engine (application/infrastructure layer),
 * consumed by the UI and the Report Engine. Contains no scoring logic
 * itself — it is the pure result shape.
 */
export interface CategoryScore {
  categoryId: string;
  categoryName: string;
  /** 0-100, normalized. */
  score: number;
}

export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface AssessmentScoreResult {
  /** 0-100, normalized, weighted across categories. */
  overallScore: number;
  categoryScores: CategoryScore[];
  biggestOpportunity: Insight;
  biggestConstraint: Insight;
  topPriorities: string[];
  confidenceLevel: ConfidenceLevel;
}
