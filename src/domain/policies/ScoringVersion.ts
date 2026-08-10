/**
 * Identifies which generation of scoring rules produced a given
 * AssessmentScoreResult. Bump this whenever a change to the scoring
 * engine, performance bands, or result-selection logic would change
 * the OUTPUT for the same answers — not for copy-only tweaks to
 * scoring-rules.json text.
 *
 * Persisted on every AssessmentResult row (see prisma/schema.prisma)
 * so historical results remain interpretable, and so a future rules
 * change can choose to recompute-on-read only for rows below the
 * current version rather than blindly recomputing everything.
 */
export const CURRENT_SCORING_VERSION = "v2";
