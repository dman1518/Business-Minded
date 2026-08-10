/**
 * Governs when the Results page / PDF may use comparative language
 * ("Biggest Constraint", "What's Working", "Biggest Opportunity", or
 * a sentence like "This was your lowest-scoring dimension") versus
 * hedged, single-source language ("Preliminary Focus Area").
 *
 * A comparison ("biggest", "lowest", "strongest") is only meaningful
 * when there is more than one distinct dimension with evidence to
 * compare against. With exactly one eligible (scoreable, non-
 * "Insufficient data") dimension, calling it "the biggest constraint"
 * implies a comparison that never happened — the respondent only gave
 * us evidence for one part of the framework.
 *
 * This is intentionally a SEPARATE, lower threshold than
 * MIN_SCOREABLE_DIMENSIONS_FOR_HEADLINE (3) in PerformanceBands.ts,
 * which governs whether the numeric /100 headline score is shown at
 * all. A result can have its headline suppressed (fewer than 3
 * eligible dimensions) while still having enough (2) eligible
 * dimensions to legitimately compare one against the other in the
 * role cards below it — these are two different questions ("is there
 * enough of the whole framework measured to show one summary number?"
 * vs. "is there enough measured to say X is bigger than Y?").
 */
export const MIN_ELIGIBLE_DIMENSIONS_FOR_COMPARISON = 2;

export type InsightRole = "strength" | "constraint" | "opportunity";

/**
 * Whether roles.strength/constraint/opportunity in this result may be
 * labeled and described using comparative language, derived purely
 * from how many distinct dimensions had any evidence at all — never
 * from the numeric score itself.
 */
export function supportsComparativeLanguage(eligibleDimensionCount: number): boolean {
  return eligibleDimensionCount >= MIN_ELIGIBLE_DIMENSIONS_FOR_COMPARISON;
}

/**
 * Canonical label for a role card, shared by the web results page and
 * the PDF report so the two can never disagree about what to call a
 * role. Falls back to "Preliminary Focus Area" for every role when
 * there isn't enough distinct evidence to support a comparison —
 * regardless of whether that single dimension happened to land as a
 * strength or a constraint, since the problem is the comparison
 * itself, not which direction it points.
 */
export function insightRoleLabel(role: InsightRole, eligibleDimensionCount: number): string {
  if (!supportsComparativeLanguage(eligibleDimensionCount)) {
    return "Preliminary Focus Area";
  }

  switch (role) {
    case "strength":
      return "What's Working";
    case "constraint":
      return "Biggest Constraint";
    case "opportunity":
      return "Biggest Opportunity";
  }
}
