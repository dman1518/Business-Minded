import { ResultRoles, ScoreDisplay, ConfidenceLevel } from "@/domain/entities/Score";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";

/**
 * Builds the introductory paragraph shown at the top of the Results
 * page (and, identically, at the top of the PDF) — see
 * ConfigurableScoringEngine, which is the only caller.
 *
 * This is deliberately split into two independent pieces that are
 * composed together, NOT a single lookup table keyed by score:
 *
 *  1. An "opening" sentence whose TONE varies with the numeric score
 *     (scoreInterpretationThresholds, config-driven — this is the only
 *     place the raw score value is allowed to influence wording, and
 *     it applies uniformly across the whole 0-100 range, not as a
 *     special case for 0 or 100).
 *  2. A "structural" closing sentence derived ENTIRELY from the
 *     canonical result-selection output (roles.tieState and which of
 *     roles.strength/constraint/opportunity are actually populated) —
 *     never from the score. This is what stops the introduction from
 *     claiming "the single biggest constraint identified below" when
 *     the result is actually a tie, or "the single dimension with the
 *     most room to grow" when every dimension tied at the top.
 *
 * A result whose headline score is suppressed, or whose overall
 * confidence is below "High", gets its own hedged text instead —
 * again derived from canonical fields (scoreDisplay.suppressed,
 * confidenceLevel), never from a score threshold.
 */
export function buildScoreInterpretation(
  scoreDisplay: ScoreDisplay,
  roles: ResultRoles,
  confidenceLevel: ConfidenceLevel,
  config: ScoringConfig
): string {
  if (scoreDisplay.suppressed) {
    return "We don't have enough answers yet to calculate a reliable Business Minded Score. Answer more questions — or retake the assessment — to see your full result.";
  }

  const score = scoreDisplay.value as number;
  const opening = buildOpeningTone(score, config);
  const structure = buildStructuralClause(roles);
  const hedge = confidenceLevel !== "High" ? ` ${LOW_CONFIDENCE_HEDGE}` : "";

  return `${opening} ${structure}${hedge}`;
}

/** Score-driven tone only — applies across the full 0-100 range via config, never a 0/100 special case. */
function buildOpeningTone(score: number, config: ScoringConfig): string {
  const sorted = [...config.scoreInterpretationThresholds].sort((a, b) => b.minScore - a.minScore);
  const match = sorted.find((t) => score >= t.minScore);

  if (!match) {
    throw new Error("No scoreInterpretationThresholds entry matched — invalid config.");
  }

  return match.text.replace(/\{score\}/g, String(score));
}

/**
 * Result-state-driven closing sentence — the piece that must never
 * contradict the tie state or role selection below it. Every branch
 * here corresponds 1:1 to a reachable canonical result state; see
 * __tests__/buildScoreInterpretation.test.ts for the exhaustive list.
 */
function buildStructuralClause(roles: ResultRoles): string {
  switch (roles.tieState) {
    case "all-low-tied":
      return "Your answers indicate broad exposure across the measured dimensions rather than one isolated constraint. The priorities below provide a practical sequence for strengthening the foundation.";
    case "developing-tied":
      return "Every measured dimension landed at a similar developing level, so there isn't one area that's more urgent than the others. The priorities below work through the full picture in sequence.";
    case "solid-tied":
      return "Every measured dimension landed at a similarly solid level — no single area is clearly ahead of or behind the rest. The priorities below help you push each one further.";
    case "all-high-tied":
      return "Your answers indicate a consistently strong profile across every measured dimension. The priorities below focus on protecting, testing, and compounding that position rather than correcting a specific weakness.";
    case "none":
      return buildNonTiedStructuralClause(roles);
  }
}

function buildNonTiedStructuralClause(roles: ResultRoles): string {
  if (roles.constraint && roles.opportunity) {
    return "Addressing the constraint identified below is likely to have the most immediate impact, with the opportunity below as a logical next step.";
  }

  if (roles.constraint && !roles.opportunity) {
    return "Addressing the constraint identified below is likely to have the most immediate impact on both business value and your freedom.";
  }

  if (!roles.constraint && roles.opportunity) {
    return "No single dimension stands out as an urgent constraint — the opportunity identified below is the clearest place to focus next.";
  }

  if (roles.strength && !roles.constraint && !roles.opportunity) {
    return `${roles.strength.categoryName} stands out as your strongest measured area, and no single dimension is urgent enough to call out as a constraint — the priorities below focus on building on that strength.`;
  }

  // Defensive fallback: not reachable from selectResultRoles today (a
  // non-tied result with at least one scoreable dimension always
  // populates at least one role), but kept explicit rather than
  // throwing so an unanticipated future result-selection change fails
  // safe with a neutral sentence instead of a contradictory one.
  return "The priorities below are sequenced from the dimensions we were able to measure.";
}

const LOW_CONFIDENCE_HEDGE =
  "This read is based on a partial set of answers — complete the rest of the assessment for a fully confident result.";
