import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";

/**
 * Presentation-safe view of a scored assessment result.
 *
 * Deliberately omits `rawAnswers` — the public assessment-result
 * endpoints (POST /api/assessments, GET /api/assessments/:id) must
 * never expose a respondent's individual raw answers, only the
 * aggregated, scored output. Raw answers stay internal, persisted for
 * audit/debugging, and are only ever read directly from the database.
 *
 * Every other field (categoryScores, scoreDisplay, scoreInterpretation,
 * roles, topPriorities, confidenceLevel) comes straight from the
 * canonical AssessmentScoreResult computed by the scoring engine — this
 * type does no additional derivation of its own, which is what
 * guarantees the web page and the PDF (see PdfReportEngine) can never
 * disagree: both are built from this exact same stored/recomputed
 * result object, not two independent presentation layers.
 */
export type AssessmentResultView = Omit<SavedAssessmentResult, "rawAnswers">;

export function toAssessmentResultView(result: SavedAssessmentResult): AssessmentResultView {
  const { rawAnswers: _rawAnswers, ...view } = result;
  return view;
}
