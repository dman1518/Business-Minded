import { Answer } from "@/domain/entities/Answer";
import { QuestionSet } from "@/domain/entities/Question";
import {
  AssessmentScoreResult,
  CategoryScore,
  CategoryStatus,
  ConfidenceLevel,
} from "@/domain/entities/Score";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";
import { ScoringEngine } from "@/domain/repositories/ScoringEngine";
import { REQUIRED_CATEGORY_IDS, REQUIRED_CATEGORY_WEIGHT } from "@/domain/policies/RequiredCategories";
import { MIN_SCOREABLE_DIMENSIONS_FOR_HEADLINE } from "@/domain/policies/PerformanceBands";
import { InsufficientDataError } from "@/domain/policies/InsufficientDataError";
import { selectResultRoles } from "@/domain/scoring/selectResultRoles";
import { buildScoreInterpretation } from "@/domain/scoring/buildScoreInterpretation";

/**
 * Adapter: computes an AssessmentScoreResult from raw answers.
 *
 * This is the single canonical scoring + result-selection module —
 * web results, PDF generation, and any future surface all consume its
 * output directly rather than re-deriving narrative sections
 * themselves (see AssessmentResultView and PdfReportEngine).
 *
 * Rules encoded (documented as assumptions in the README):
 *  - The framework is locked to exactly five equally-weighted
 *    categories (money, operations, growth, freedom, resilience —
 *    see RequiredCategories). categoryScores always has exactly five
 *    entries, in that fixed order, regardless of which questions were
 *    answered.
 *  - Each category's score is the mean of its ANSWERED questions
 *    (never padded with assumed values for skipped ones), normalized
 *    from [scaleMin, scaleMax] to [0, 100], then reduced to its fixed
 *    20-point share. A category with zero answered questions scores 0
 *    and is marked "Insufficient data" — that status means "no
 *    evidence", not "measured and found weak". A category with only
 *    SOME of its questions answered is still scored from what it has,
 *    but flagged `reducedConfidence` so the UI doesn't imply the same
 *    confidence as a fully-answered category.
 *  - The headline /100 score is suppressed (scoreDisplay.suppressed)
 *    whenever fewer than MIN_SCOREABLE_DIMENSIONS_FOR_HEADLINE of the
 *    five dimensions have any evidence — this is what stops "1 real
 *    answer + 9 skips" from rendering as a misleading low score built
 *    from phantom zeros. A genuinely complete assessment always shows
 *    a score with the exact prior math (all-low -> 0, all-high -> 100).
 *  - "What's Working" / "Biggest Constraint" / "Biggest Opportunity"
 *    and "Top Priorities" are produced by selectResultRoles, which
 *    enforces: a dimension occupies at most one of the three named
 *    roles, insufficient-data dimensions are never selected, a
 *    Strength dimension is never framed as a constraint, a Constraint
 *    dimension is never framed as a strength, priority count never
 *    exceeds the number of scoreable dimensions, and an explicit tie
 *    state is used instead of arbitrarily picking the first item when
 *    every scoreable dimension ties on score.
 *  - "Confidence Level" reflects EVIDENCE QUALITY (question
 *    completeness), never business quality or score similarity.
 */
export class ConfigurableScoringEngine implements ScoringEngine {
  score(
    answers: Answer[],
    questionSet: QuestionSet,
    config: ScoringConfig
  ): AssessmentScoreResult {
    if (answers.length === 0) {
      throw new InsufficientDataError();
    }

    const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.value]));
    const questionsByCategory = this.groupQuestionsByCategory(questionSet);
    const categoryNameById = new Map(questionSet.categories.map((c) => [c.id, c.name]));

    const categoryScores: CategoryScore[] = REQUIRED_CATEGORY_IDS.map((categoryId) => {
      const categoryName = categoryNameById.get(categoryId) ?? categoryId;
      const questions = questionsByCategory.get(categoryId) ?? [];
      const applicableCount = questions.length;
      const values = questions
        .map((q) => answerByQuestionId.get(q.id))
        .filter((v): v is number => typeof v === "number");
      const answeredCount = values.length;

      if (answeredCount === 0) {
        return {
          categoryId,
          categoryName,
          score: 0,
          status: "Insufficient data",
          answeredCount,
          applicableCount,
          reducedConfidence: false,
        };
      }

      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const normalized100 = this.normalize(mean, config.scaleMin, config.scaleMax);
      const score = Math.round(normalized100 * REQUIRED_CATEGORY_WEIGHT);

      return {
        categoryId,
        categoryName,
        score,
        status: this.deriveCategoryStatus(score, config),
        answeredCount,
        applicableCount,
        reducedConfidence: answeredCount < applicableCount,
      };
    });

    const scoreDisplay = this.buildScoreDisplay(categoryScores, answers.length, questionSet.questions.length);
    const { roles, topPriorities } = selectResultRoles(categoryScores, config);
    const confidenceLevel = this.deriveConfidence(answers, questionSet, config);

    // scoreInterpretation is derived from the SAME canonical roles /
    // scoreDisplay / confidenceLevel computed above — never from the
    // raw score alone — so it can never contradict the tie state or
    // role selection shown beneath it. See buildScoreInterpretation.
    const scoreInterpretation = buildScoreInterpretation(scoreDisplay, roles, confidenceLevel, config);

    return {
      categoryScores,
      scoreDisplay,
      scoreInterpretation,
      roles,
      topPriorities,
      confidenceLevel,
    };
  }

  private groupQuestionsByCategory(questionSet: QuestionSet) {
    const map = new Map<string, QuestionSet["questions"]>();
    for (const question of questionSet.questions) {
      const list = map.get(question.categoryId) ?? [];
      list.push(question);
      map.set(question.categoryId, list);
    }
    return map;
  }

  private normalize(value: number, min: number, max: number): number {
    if (max === min) return 0;
    const clamped = Math.min(Math.max(value, min), max);
    return ((clamped - min) / (max - min)) * 100;
  }

  private deriveCategoryStatus(score: number, config: ScoringConfig): CategoryStatus {
    const sorted = [...config.categoryStatusThresholds].sort((a, b) => b.minScore - a.minScore);
    const match = sorted.find((t) => score >= t.minScore);

    if (!match) {
      // Unreachable if config was validated (a minScore: 0 entry is
      // required), but fail loudly rather than guess if it happens.
      throw new Error("No categoryStatusThresholds entry matched — invalid config.");
    }

    return match.status;
  }

  /**
   * The headline score is only ever computed from dimensions with
   * evidence (answeredCount > 0) — an "Insufficient data" dimension
   * contributes nothing to the sum, not a phantom zero. When fewer
   * than MIN_SCOREABLE_DIMENSIONS_FOR_HEADLINE dimensions have
   * evidence, the score is suppressed entirely rather than showing a
   * partial sum that could be misread as a full /100 verdict.
   *
   * For a genuinely complete assessment (5 of 5 dimensions scoreable)
   * this sums to exactly the same total as summing all five
   * categoryScores directly, since every category already has
   * evidence — all-low remains exactly 0 and all-high remains exactly
   * 100.
   */
  private buildScoreDisplay(
    categoryScores: CategoryScore[],
    answeredQuestionCount: number,
    totalQuestionCount: number
  ) {
    const scoreable = categoryScores.filter((c) => c.status !== "Insufficient data");
    const suppressed = scoreable.length < MIN_SCOREABLE_DIMENSIONS_FOR_HEADLINE;

    return {
      value: suppressed ? null : scoreable.reduce((sum, c) => sum + c.score, 0),
      suppressed,
      answeredQuestionCount,
      totalQuestionCount,
      scoreableDimensionCount: scoreable.length,
      totalDimensionCount: categoryScores.length,
    };
  }

  /**
   * Confidence = evidence completeness, i.e. what fraction of the
   * assessment's questions were actually answered (a respondent may
   * skip a question with "I'm not sure"). It is deliberately unrelated
   * to the resulting category scores, so a low score never reads as
   * "low confidence" and a tightly clustered set of scores never reads
   * as "high confidence" — only how much evidence was collected does.
   *
   * Callers (SubmitAssessment -> validateAnswers) are expected to have
   * already rejected any answer with an unknown question id or a
   * duplicate questionId before this ever runs. This method still
   * filters defensively to answers whose questionId is a real,
   * known question — and dedupes via Set — so completeness can never
   * be inflated by extra/bogus/duplicate answers even if it is ever
   * called directly with unvalidated input.
   */
  private deriveConfidence(
    answers: Answer[],
    questionSet: QuestionSet,
    config: ScoringConfig
  ): ConfidenceLevel {
    const knownQuestionIds = new Set(questionSet.questions.map((q) => q.id));
    const totalQuestions = questionSet.questions.length;
    const answeredQuestions = new Set(
      answers.filter((a) => knownQuestionIds.has(a.questionId)).map((a) => a.questionId)
    ).size;
    const completeness = totalQuestions === 0 ? 0 : answeredQuestions / totalQuestions;

    const sortedThresholds = [...config.confidenceThresholds].sort(
      (a, b) => b.minCompleteness - a.minCompleteness
    );
    const match = sortedThresholds.find((t) => completeness >= t.minCompleteness);

    if (!match) {
      throw new Error("No confidence threshold matched — invalid confidenceThresholds config.");
    }

    return match.level;
  }
}
