/** Per-category narrative copy used to build Results-page insights. */
export interface CategoryInsightConfig {
  opportunityHeadline: string;
  opportunityDescription: string;
  constraintHeadline: string;
  constraintDescription: string;
  /** Recommendation shown when this category lands in the "Top Priorities" list. */
  recommendation: string;
}

/**
 * Confidence represents evidence quality, not business quality: it is
 * derived from how complete the respondent's answers were, never from
 * how similar or different the resulting category scores are.
 */
export interface ConfidenceThreshold {
  /**
   * The minimum fraction of questions answered (0-1) required to reach
   * `level`. Thresholds are evaluated from highest to lowest; the
   * first one the actual completeness meets or exceeds wins. Must
   * include an entry with `minCompleteness: 0` as a catch-all.
   */
  minCompleteness: number;
  level: "Low" | "Medium" | "High";
}

export interface ScoringConfig {
  /** Must have an entry for every required category, each exactly 0.2, summing to 1. */
  categoryWeights: Record<string, number>;
  scaleMin: number;
  scaleMax: number;
  categoryInsights: Record<string, CategoryInsightConfig>;
  /** See ConfidenceThreshold — evaluated highest-completeness-first. */
  confidenceThresholds: ConfidenceThreshold[];
  /** How many categories feed into "Top Three Priorities". */
  topPriorityCount: number;
}

/**
 * Port: loads scoring rules/configuration.
 * Sprint 1 implementation reads from JSON — business logic (weights,
 * copy, thresholds) never lives in UI components.
 */
export interface ScoringConfigRepository {
  getConfig(): Promise<ScoringConfig>;
}
