import { Insight } from "../value-objects/Insight";

/**
 * Domain entity: scored outcome of a completed Business Health Check.
 * Produced by the canonical scoring engine (application/infrastructure
 * layer), consumed by the UI and the Report Engine. Contains no
 * scoring logic itself — it is the pure result shape.
 *
 * Web and PDF rendering both consume this exact shape (see
 * ConfigurableScoringEngine + GenerateReport/PdfReportEngine), so the
 * two surfaces can never disagree.
 */

/** Evidence quality for a single dimension, independent of its score. */
export type DataSufficiency = "insufficient" | "partial" | "sufficient";

/**
 * Plain-language performance band for a scoreable (non-insufficient)
 * category, derived from its /20 score against
 * ScoringConfig.categoryStatusThresholds. Named constants, not magic
 * numbers — see src/domain/policies/PerformanceBands.ts for the
 * negative/positive grouping used by result-selection.
 *
 * "Insufficient data" is a distinct state from all four bands: it
 * means the respondent answered zero of this category's questions (no
 * evidence at all), not that the category was measured and found
 * weak. A dimension in this status can never be a strength,
 * constraint, opportunity, or priority.
 */
export type CategoryStatus = "Strength" | "Solid" | "Developing" | "Constraint" | "Insufficient data";

export interface CategoryScore {
  categoryId: string;
  categoryName: string;
  /**
   * 0-20, normalized. The Business Minded Framework v1 is locked to
   * five equally-weighted categories, so this is simply this
   * category's fixed 20-point share of the 100-point overall score.
   * 0 when status is "Insufficient data" (no evidence, not a measured
   * zero).
   */
  score: number;
  status: CategoryStatus;
  /** How many of this category's questions were actually answered. */
  answeredCount: number;
  /** How many questions this category has in total. */
  applicableCount: number;
  /**
   * True when 0 < answeredCount < applicableCount — the category IS
   * scoreable (uses the answer(s) it has), but the UI must not imply
   * the same confidence as a fully-answered category. See
   * CategoryScoreList for how this is surfaced.
   */
  reducedConfidence: boolean;
}

/**
 * One of the "Top Priorities" shown on the Results page. Every
 * scoreable (non-insufficient) dimension is priority-eligible —
 * recommendation copy varies by band (a Strength dimension gets
 * protect/measure/delegate copy, a Constraint dimension gets remedial
 * copy — see RecommendationEngine) so a perfect-score business and a
 * zero-score business never receive the same action plan.
 */
export interface PriorityItem {
  categoryId: string;
  categoryName: string;
  status: CategoryStatus;
  action: string;
  whyItMatters: string;
  timeframe: string;
}

/**
 * How the headline "Business Minded Score" is displayed. Unanswered
 * dimensions are never silently counted as zero: when fewer than
 * MIN_SCOREABLE_DIMENSIONS_FOR_HEADLINE (see PerformanceBands.ts) of
 * the five dimensions have any evidence, the numeric score is
 * suppressed entirely rather than showing a misleadingly low number
 * built from phantom zeros. A genuinely complete assessment (10/10
 * answered) always yields suppressed=false with the exact same math
 * as before (all-low -> 0, all-high -> 100).
 */
export interface ScoreDisplay {
  value: number | null;
  suppressed: boolean;
  answeredQuestionCount: number;
  totalQuestionCount: number;
  scoreableDimensionCount: number;
  totalDimensionCount: number;
}

/**
 * Explicit tie state so the UI never silently picks an arbitrary first
 * array item when every eligible category lands on the same score.
 * One value per performance band (see PerformanceBands.ts) plus
 * "none" — every tie is precisely attributable to the band every
 * scoreable dimension shares, so both the section heading and the
 * introductory paragraph can describe the ACTUAL band tied on
 * (foundational risk vs. developing vs. solid vs. strength) instead of
 * a single generic "balanced profile" message that reads the same at
 * a tied 8/20 as it does at a tied 17/20.
 *  - "all-low-tied": every scoreable dimension is tied in the
 *    Constraint band. No invented strength; a balanced-risk narrative
 *    replaces a single "biggest constraint" card.
 *  - "developing-tied": every scoreable dimension is tied in the
 *    Developing band. No dimension is more urgent than another; the
 *    tie is disclosed rather than claiming false precision about a
 *    unique constraint.
 *  - "solid-tied": every scoreable dimension is tied in the Solid
 *    band. No dimension is clearly ahead of or behind the others.
 *  - "all-high-tied": every scoreable dimension is tied in the
 *    Strength band. No "Biggest Constraint" shown; a balanced-strength
 *    narrative replaces a single "what's working" card.
 *  - "none": no tie — normal single-dimension role selection applies.
 */
export type TieState = "none" | "all-low-tied" | "developing-tied" | "solid-tied" | "all-high-tied";

/**
 * Result-selection output. Each of strength/constraint/opportunity is
 * independently nullable (a role is omitted, never fabricated, when
 * no dimension qualifies) and — enforced in code and tests — no
 * dimension ever occupies more than one of these three roles.
 */
export interface ResultRoles {
  strength: Insight | null;
  constraint: Insight | null;
  opportunity: Insight | null;
  tieState: TieState;
  /** Present only when tieState !== "none" — user-facing disclosure text. */
  tieMessage: string | null;
}

export interface AssessmentScoreResult {
  categoryScores: CategoryScore[];
  scoreDisplay: ScoreDisplay;
  scoreInterpretation: string;
  roles: ResultRoles;
  /**
   * Ranked by band severity (Constraint > Developing > Solid >
   * Strength) then score ascending, framework order as a final
   * tiebreak. Length never exceeds the number of scoreable dimensions
   * — see RequiredCategories / PerformanceBands.
   */
  topPriorities: PriorityItem[];
  /**
   * Evidence completeness (fraction of the 10 questions answered),
   * unrelated to how similar/different the category scores are.
   */
  confidenceLevel: "Low" | "Medium" | "High";
}

export type ConfidenceLevel = AssessmentScoreResult["confidenceLevel"];
