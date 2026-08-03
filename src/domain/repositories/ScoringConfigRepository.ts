/** Per-category narrative copy used to build Results-page insights. */
export interface CategoryInsightConfig {
  opportunityHeadline: string;
  opportunityDescription: string;
  constraintHeadline: string;
  constraintDescription: string;
  /** Recommendation shown when this category lands in the "Top Priorities" list. */
  recommendation: string;
}

/** Confidence is derived from how tightly clustered category scores are. */
export interface ConfidenceThreshold {
  /** If the standard deviation of category scores is <= this, use `level`. */
  maxStdDev: number;
  level: "Low" | "Medium" | "High";
}

export interface ScoringConfig {
  /** Must sum to 1. Keyed by categoryId. */
  categoryWeights: Record<string, number>;
  scaleMin: number;
  scaleMax: number;
  categoryInsights: Record<string, CategoryInsightConfig>;
  /** Evaluated in array order; first match wins. Should end with a catch-all (Infinity). */
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
