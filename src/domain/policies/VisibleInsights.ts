import { Insight } from "@/domain/value-objects/Insight";
import { ResultRoles } from "@/domain/entities/Score";
import { InsightRole } from "@/domain/policies/ComparativeLanguage";

export interface VisibleInsightEntry {
  role: InsightRole;
  tone: "positive" | "negative";
  insight: Insight;
}

/**
 * Which of the three role cards (What's Working / Biggest Constraint /
 * Biggest Opportunity, or their "Preliminary Focus Area" equivalents)
 * should actually render on the Results page and in any other surface
 * that shows role cards.
 *
 * A role with no selected dimension (roles.strength/constraint/
 * opportunity === null) is omitted entirely rather than rendered as an
 * empty placeholder card. Before this existed, a sparse one-dimension
 * result rendered all three cards unconditionally -- the one filled
 * role plus two empty "not enough distinct data" placeholders, all
 * three sharing the same "Preliminary Focus Area" label (since a
 * single eligible dimension is below the comparative-language
 * threshold) -- producing three duplicate-looking headings for what
 * was really a single insight. See ComparativeLanguage.ts for the
 * label threshold itself; this function only controls which roles are
 * shown at all.
 *
 * Order is always strength, then constraint, then opportunity -- the
 * same fixed order the cards have always rendered in -- with absent
 * roles simply missing from the result rather than reordering what
 * remains.
 */
export function selectVisibleInsights(roles: ResultRoles): VisibleInsightEntry[] {
  const candidates: Array<{ role: InsightRole; tone: "positive" | "negative"; insight: Insight | null }> = [
    { role: "strength", tone: "positive", insight: roles.strength },
    { role: "constraint", tone: "negative", insight: roles.constraint },
    { role: "opportunity", tone: "positive", insight: roles.opportunity },
  ];

  return candidates.filter(
    (entry): entry is VisibleInsightEntry => entry.insight !== null
  );
}
