/**
 * Narrative + recommendation copy for one performance band within one
 * category. Every category defines all four bands, so recommendation
 * text always varies with the respondent's actual performance in that
 * dimension — a Strength-band business never sees Constraint-band
 * remedial copy, and vice versa.
 */
export interface BandCopy {
  /** Short headline, used whichever role (strength/constraint/opportunity) this band ends up filling. */
  headline: string;
  description: string;
  priorityAction: string;
  priorityWhyItMatters: string;
  priorityTimeframe: string;
}

/** Per-category copy, one BandCopy per performance band. */
export type CategoryInsightConfig = Record<"Constraint" | "Developing" | "Solid" | "Strength", BandCopy>;

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

/**
 * Maps a category's /20 score to a plain-language performance band.
 * Evaluated highest-minScore-first; the first threshold the score
 * meets or exceeds wins. Must include an entry with `minScore: 0` as a
 * catch-all. Never produces "Insufficient data" — the scoring engine
 * assigns that state directly when a category has no answers at all,
 * bypassing these thresholds entirely.
 */
export interface CategoryStatusThreshold {
  minScore: number;
  status: "Strength" | "Solid" | "Developing" | "Constraint";
}

/**
 * Maps an overall /100 score to a 2-3 sentence interpretation shown at
 * the top of the Results page. Evaluated highest-minScore-first; the
 * first threshold the score meets or exceeds wins. Must include an
 * entry with `minScore: 0` as a catch-all. `{score}` in `text` is
 * replaced with the respondent's actual overall score.
 */
export interface ScoreInterpretationThreshold {
  minScore: number;
  text: string;
}

export interface ScoringConfig {
  /** Must have an entry for every required category, each exactly 0.2, summing to 1. */
  categoryWeights: Record<string, number>;
  scaleMin: number;
  scaleMax: number;
  categoryInsights: Record<string, CategoryInsightConfig>;
  /** See ConfidenceThreshold — evaluated highest-completeness-first. */
  confidenceThresholds: ConfidenceThreshold[];
  /** See CategoryStatusThreshold — evaluated highest-score-first. */
  categoryStatusThresholds: CategoryStatusThreshold[];
  /** See ScoreInterpretationThreshold — evaluated highest-score-first. */
  scoreInterpretationThresholds: ScoreInterpretationThreshold[];
  /** Maximum number of categories that can feed into "Top Priorities" (actual count is capped by eligible-dimension count). */
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
