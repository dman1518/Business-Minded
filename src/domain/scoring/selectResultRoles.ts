import { CategoryScore, PriorityItem, ResultRoles, TieState } from "@/domain/entities/Score";
import { Insight } from "@/domain/value-objects/Insight";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";
import {
  isNegativeBand,
  isPositiveBand,
  BAND_SEVERITY_ORDER,
  frameworkOrderIndex,
  ScoreableStatus,
} from "@/domain/policies/PerformanceBands";
import { supportsComparativeLanguage } from "@/domain/policies/ComparativeLanguage";

export interface ResultSelection {
  roles: ResultRoles;
  topPriorities: PriorityItem[];
}

/**
 * Canonical result-selection: turns per-category scores into the
 * Results page's "what's working / biggest constraint / biggest
 * opportunity / top priorities" sections.
 *
 * Enforced invariants (see tests in __tests__/selectResultRoles.test.ts):
 *  - A dimension occupies at most one of strength/constraint/opportunity.
 *  - "Insufficient data" dimensions are never selected for any role or priority.
 *  - A Strength-band (18-20) dimension is never framed as the constraint.
 *  - A Constraint-band (0-7) dimension is never framed as the strength.
 *  - Priority count never exceeds the number of scoreable dimensions.
 *  - When every scoreable dimension ties on score, an explicit tie
 *    state is returned instead of arbitrarily picking the first array
 *    item.
 */
export function selectResultRoles(
  categoryScores: CategoryScore[],
  config: ScoringConfig
): ResultSelection {
  const scoreable = categoryScores.filter((c) => c.status !== "Insufficient data");

  if (scoreable.length === 0) {
    return {
      roles: { strength: null, constraint: null, opportunity: null, tieState: "none", tieMessage: null },
      topPriorities: [],
    };
  }

  const allTied = scoreable.length > 1 && scoreable.every((c) => c.score === scoreable[0].score);

  if (allTied) {
    return buildTiedResult(scoreable, config);
  }

  return buildRankedResult(scoreable, config);
}

function buildTiedResult(scoreable: CategoryScore[], config: ScoringConfig): ResultSelection {
  const band = scoreable[0].status as ScoreableStatus;
  let tieState: TieState;
  let tieMessage: string;

  if (band === "Constraint") {
    tieState = "all-low-tied";
    tieMessage =
      "Every dimension we could measure landed in the same range, indicating broad risk rather than one isolated weak spot. There's no single constraint to call out — the priorities below cover the full picture, sequenced in a standard order.";
  } else if (band === "Developing") {
    tieState = "developing-tied";
    tieMessage =
      "Every dimension we could measure landed at the same developing level — none is more urgent than another, so there's no single constraint to call out. The priorities below work through the full picture in a standard order.";
  } else if (band === "Solid") {
    tieState = "solid-tied";
    tieMessage =
      "Every dimension we could measure landed at the same solid level — none is clearly ahead of or behind the others, so there's no single constraint or standout to call out. The priorities below help you push each one further, in a standard order.";
  } else {
    tieState = "all-high-tied";
    tieMessage =
      "Every dimension we could measure is a strength — there's no single constraint to highlight. The priorities below focus on protecting, measuring, and compounding that position rather than beginner remediation.";
  }

  const ranked = [...scoreable].sort(
    (a, b) => frameworkOrderIndex(a.categoryId) - frameworkOrderIndex(b.categoryId)
  );
  const topPriorities = buildPriorities(ranked, config, config.topPriorityCount);

  return {
    roles: { strength: null, constraint: null, opportunity: null, tieState, tieMessage },
    topPriorities,
  };
}

function buildRankedResult(scoreable: CategoryScore[], config: ScoringConfig): ResultSelection {
  const negativeCandidates = scoreable
    .filter((c) => isNegativeBand(c.status))
    .sort(byScoreThenFrameworkOrder(true));
  const positiveCandidates = scoreable
    .filter((c) => isPositiveBand(c.status))
    .sort(byScoreThenFrameworkOrder(false));

  const constraintDim = negativeCandidates[0] ?? null;
  const strengthDim = positiveCandidates[0] ?? null;

  const opportunityCandidates = scoreable
    .filter((c) => c !== constraintDim && c !== strengthDim && c.status !== "Strength")
    .sort(byScoreThenFrameworkOrder(true));
  const opportunityDim = opportunityCandidates[0] ?? null;

  const roles: ResultRoles = {
    strength: strengthDim ? buildInsight(strengthDim, config, "strength", scoreable.length) : null,
    constraint: constraintDim ? buildInsight(constraintDim, config, "constraint", scoreable.length) : null,
    opportunity: opportunityDim ? buildInsight(opportunityDim, config, "opportunity", scoreable.length) : null,
    tieState: "none",
    tieMessage: null,
  };

  const priorityRanked = [...scoreable].sort((a, b) => {
    const severityDiff = BAND_SEVERITY_ORDER.indexOf(a.status as ScoreableStatus) -
      BAND_SEVERITY_ORDER.indexOf(b.status as ScoreableStatus);
    if (severityDiff !== 0) return severityDiff;
    if (a.score !== b.score) return a.score - b.score;
    return frameworkOrderIndex(a.categoryId) - frameworkOrderIndex(b.categoryId);
  });

  const topPriorities = buildPriorities(priorityRanked, config, config.topPriorityCount);

  return { roles, topPriorities };
}

function byScoreThenFrameworkOrder(ascending: boolean) {
  return (a: CategoryScore, b: CategoryScore) => {
    const diff = ascending ? a.score - b.score : b.score - a.score;
    if (diff !== 0) return diff;
    return frameworkOrderIndex(a.categoryId) - frameworkOrderIndex(b.categoryId);
  };
}

function buildPriorities(
  ranked: CategoryScore[],
  config: ScoringConfig,
  maxCount: number
): PriorityItem[] {
  // Never exceeds the number of scoreable (eligible) dimensions.
  return ranked.slice(0, Math.max(0, Math.min(maxCount, ranked.length))).map((c) => {
    const bandCopy = config.categoryInsights[c.categoryId][c.status as ScoreableStatus];
    return {
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      status: c.status,
      action: bandCopy.priorityAction,
      whyItMatters: bandCopy.priorityWhyItMatters,
      timeframe: bandCopy.priorityTimeframe,
    };
  });
}

function buildInsight(
  categoryScore: CategoryScore,
  config: ScoringConfig,
  role: "strength" | "constraint" | "opportunity",
  eligibleDimensionCount: number
): Insight {
  const bandCopy = config.categoryInsights[categoryScore.categoryId][categoryScore.status as ScoreableStatus];

  // A comparison ("lowest-scoring", "strongest", "next-biggest") is only
  // honest when there was at least one other eligible dimension to
  // compare against — see ComparativeLanguage.ts. With exactly one
  // eligible dimension (always the case that reaches this branch with
  // role "opportunity" impossible and role "strength"/"constraint" the
  // only one filled), we hedge instead of implying a comparison that
  // never happened.
  const evidenceSentence = supportsComparativeLanguage(eligibleDimensionCount)
    ? role === "constraint"
      ? ` This was your lowest-scoring dimension, at ${categoryScore.score}/20.`
      : role === "strength"
        ? ` This was your strongest dimension, scoring ${categoryScore.score}/20.`
        : ` This is your next-biggest area for improvement, at ${categoryScore.score}/20.`
    : ` Based on the limited answers available so far, this is a preliminary read (${categoryScore.score}/20) — complete more of the assessment before treating ${categoryScore.categoryName} as your primary business ${role === "strength" ? "strength" : "constraint"}.`;

  return {
    categoryId: categoryScore.categoryId,
    categoryName: categoryScore.categoryName,
    headline: bandCopy.headline,
    description: `${bandCopy.description}${evidenceSentence}`,
  };
}
