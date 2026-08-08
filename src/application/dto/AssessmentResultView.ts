import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";
import { buildResultsPresentation, ResultsPresentation } from "@/application/services/ResultsPresenter";

/**
 * Presentation-safe view of a scored assessment result.
 *
 * Deliberately omits `rawAnswers` — the public assessment-result
 * endpoints (POST /api/assessments, GET /api/assessments/:id) must
 * never expose a respondent's individual raw answers, only the
 * aggregated, scored output. Raw answers stay internal, persisted for
 * audit/debugging, and are only ever read directly from the database.
 *
 * Adds the read-time-only Results page sections (score interpretation,
 * what's working) — see ResultsPresenter for why those are computed
 * here instead of persisted.
 */
export type AssessmentResultView = Omit<SavedAssessmentResult, "rawAnswers"> & ResultsPresentation;

export function toAssessmentResultView(
  result: SavedAssessmentResult,
  config: ScoringConfig
): AssessmentResultView {
  const { rawAnswers: _rawAnswers, ...view } = result;
  const presentation = buildResultsPresentation(result.overallScore, result.categoryScores, config);
  return { ...view, ...presentation };
}
