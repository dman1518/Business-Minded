import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";

/**
 * Presentation-safe view of a scored assessment result.
 *
 * Deliberately omits `rawAnswers` — the public assessment-result
 * endpoints (POST /api/assessments, GET /api/assessments/:id) must
 * never expose a respondent's individual raw answers, only the
 * aggregated, scored output. Raw answers stay internal, persisted for
 * audit/debugging, and are only ever read directly from the database.
 */
export type AssessmentResultView = Omit<SavedAssessmentResult, "rawAnswers">;

export function toAssessmentResultView(result: SavedAssessmentResult): AssessmentResultView {
  const { rawAnswers: _rawAnswers, ...view } = result;
  return view;
}
