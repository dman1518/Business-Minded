import { AssessmentScoreResult } from "./Score";
import { Segmentation } from "../value-objects/Segmentation";

/**
 * Domain entity: a persisted AssessmentScoreResult, identified and
 * timestamped once it has been stored by the Infrastructure layer.
 */
export interface SavedAssessmentResult extends AssessmentScoreResult {
  id: string;
  /** The raw answers that produced this result, kept for audit/debugging. */
  rawAnswers: Record<string, number>;
  /**
   * Unscored segmentation info collected on the intro screen (industry,
   * company size, revenue range). Never used in scoring — internal
   * lead-qualification data only. Absent when the respondent skipped
   * the intro screen entirely.
   */
  segmentation?: Segmentation;
  createdAt: Date;
}
