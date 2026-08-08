import { CategoryScore } from "@/domain/entities/Score";
import { Insight } from "@/domain/value-objects/Insight";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";

/**
 * Presentation-only fields for the Results page that are deliberately
 * NOT persisted to the database: both are pure functions of data that
 * IS already persisted (overallScore, categoryScores) plus the current
 * scoring config, so they can always be recomputed at read time. This
 * means copy changes in scoring-rules.json apply retroactively to
 * every past result without a migration or backfill, and it means
 * adding this section required no schema change.
 */
export interface ResultsPresentation {
  scoreInterpretation: string;
  whatsWorking: Insight;
}

const NO_STRENGTH_YET: Insight = {
  categoryId: "",
  categoryName: "",
  headline: "Not enough answers yet to identify a strength",
  description:
    "Every category was skipped, so there isn't a scored strength to highlight. Retake the assessment and answer at least one question per dimension to see what's working.",
};

export function buildResultsPresentation(
  overallScore: number,
  categoryScores: CategoryScore[],
  config: ScoringConfig
): ResultsPresentation {
  return {
    scoreInterpretation: buildScoreInterpretation(overallScore, config),
    whatsWorking: buildWhatsWorking(categoryScores, config),
  };
}

function buildScoreInterpretation(overallScore: number, config: ScoringConfig): string {
  const sorted = [...config.scoreInterpretationThresholds].sort((a, b) => b.minScore - a.minScore);
  const match = sorted.find((t) => overallScore >= t.minScore);

  if (!match) {
    // Unreachable if config was validated (a minScore: 0 entry is
    // required), but fail loudly rather than guess if it happens.
    throw new Error("No scoreInterpretationThresholds entry matched — invalid config.");
  }

  return match.text.replace(/\{score\}/g, String(overallScore));
}

function buildWhatsWorking(categoryScores: CategoryScore[], config: ScoringConfig): Insight {
  const answered = categoryScores.filter((c) => c.status !== "Insufficient data");
  if (answered.length === 0) {
    return NO_STRENGTH_YET;
  }

  const strongest = [...answered].sort((a, b) => b.score - a.score)[0];
  const copy = config.categoryInsights[strongest.categoryId];

  return {
    categoryId: strongest.categoryId,
    categoryName: strongest.categoryName,
    headline: copy.strengthHeadline,
    description: `${copy.strengthDescription} This was your strongest dimension, scoring ${strongest.score}/20.`,
  };
}
