import { CategoryStatus } from "@/domain/entities/Score";

/**
 * Scoreable performance bands (excludes "Insufficient data", which is
 * a sufficiency state, not a performance band). Grouped into
 * "negative" (weak — eligible for constraint/remedial priorities) and
 * "positive" (healthy — eligible for strength/protective priorities)
 * halves, used throughout result-selection so a 20/20 dimension can
 * never be framed as a constraint and a 0/20 dimension can never be
 * framed as a strength.
 */
export type ScoreableStatus = Exclude<CategoryStatus, "Insufficient data">;

export const NEGATIVE_BANDS: readonly ScoreableStatus[] = ["Constraint", "Developing"];
export const POSITIVE_BANDS: readonly ScoreableStatus[] = ["Solid", "Strength"];

/** Severity order, worst first — used to rank Top Priorities. */
export const BAND_SEVERITY_ORDER: readonly ScoreableStatus[] = [
  "Constraint",
  "Developing",
  "Solid",
  "Strength",
];

export function isNegativeBand(status: CategoryStatus): status is "Constraint" | "Developing" {
  return (NEGATIVE_BANDS as readonly CategoryStatus[]).includes(status);
}

export function isPositiveBand(status: CategoryStatus): status is "Solid" | "Strength" {
  return (POSITIVE_BANDS as readonly CategoryStatus[]).includes(status);
}

/**
 * Minimum number of the five dimensions that must have at least
 * partial evidence (1+ of their questions answered) before the
 * headline /100 "Business Minded Score" is shown at all. Below this,
 * too little of the framework has been measured for a single number
 * to be meaningful, so the score is suppressed in favor of an explicit
 * "Based on X of 10 answers" state rather than silently treating the
 * unmeasured dimensions as zero.
 *
 * A genuinely complete assessment (5 of 5 dimensions scoreable) always
 * shows a score; this threshold only affects partial submissions.
 * Adjustable — tests lock the chosen value.
 */
export const MIN_SCOREABLE_DIMENSIONS_FOR_HEADLINE = 3;

/** Fixed framework order, used as the deterministic tiebreak whenever
 * two dimensions are otherwise equal (same score, same band) — e.g.
 * sequencing priorities during a tie, so results never depend on
 * incidental array/object ordering. */
export const FRAMEWORK_ORDER = ["money", "operations", "growth", "freedom", "resilience"] as const;

export function frameworkOrderIndex(categoryId: string): number {
  const index = (FRAMEWORK_ORDER as readonly string[]).indexOf(categoryId);
  return index === -1 ? FRAMEWORK_ORDER.length : index;
}
