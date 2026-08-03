import { AssessmentScoreResult } from "./Score";

/**
 * Domain entity: a persisted AssessmentScoreResult, identified and
 * timestamped once it has been stored by the Infrastructure layer.
 */
export interface SavedAssessmentResult extends AssessmentScoreResult {
  id: string;
  /** The raw answers that produced this result, kept for audit/debugging. */
  rawAnswers: Record<string, number>;
  createdAt: Date;
}
