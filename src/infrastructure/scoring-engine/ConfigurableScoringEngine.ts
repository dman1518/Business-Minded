import { Answer } from "@/domain/entities/Answer";
import { QuestionSet } from "@/domain/entities/Question";
import {
  AssessmentScoreResult,
  CategoryScore,
  CategoryStatus,
  ConfidenceLevel,
  PriorityItem,
} from "@/domain/entities/Score";
import { Insight } from "@/domain/value-objects/Insight";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";
import { ScoringEngine } from "@/domain/repositories/ScoringEngine";
import { REQUIRED_CATEGORY_IDS, REQUIRED_CATEGORY_WEIGHT } from "@/domain/policies/RequiredCategories";

/**
 * Adapter: computes an AssessmentScoreResult from raw answers.
 *
 * Every business rule below (category weights, insight copy, status
 * thresholds, which category becomes the "constraint" vs. the
 * "opportunity", confidence thresholds) is read from `ScoringConfig`
 * — nothing is hardcoded here. Configuration is validated at startup
 * (see validateStartupConfig), so this class trusts it and does not
 * silently substitute fallback values (zero weights, equal weights,
 * empty copy) for anything invalid — a broken config is expected to
 * have already failed loudly before this code ever runs.
 *
 * Rules encoded (documented as assumptions in the README):
 *  - The framework is locked to exactly five equally-weighted
 *    categories (money, operations, growth, freedom, resilience —
 *    see RequiredCategories). categoryScores always has exactly five
 *    entries, in that fixed order, regardless of which questions were
 *    answered. Freedom is one of the five; there is no separate
 *    Freedom or Owner Dependence score.
 *  - Each category's score is the mean of its answered questions,
 *    normalized from [scaleMin, scaleMax] to [0, 100], then reduced to
 *    its fixed 20-point share (normalized * REQUIRED_CATEGORY_WEIGHT,
 *    rounded). The five category scores therefore always sum to
 *    exactly the overall score — no separate re-rounding step.
 *  - A category with zero answered questions scores 0 and is marked
 *    "Insufficient data" rather than being scored/statused via the
 *    normal thresholds — that status means "no evidence", not "this
 *    category was measured and found weak". Such categories are
 *    excluded from being chosen as the constraint, opportunity, or a
 *    top priority.
 *  - "Biggest Constraint" = lowest-scoring answered category.
 *  - "Biggest Opportunity" = next-lowest-scoring answered category.
 *  - "Top Priorities" = the `topPriorityCount` lowest-scoring answered
 *    categories' configured action/why/timeframe copy.
 *  - "Confidence Level" reflects EVIDENCE QUALITY, not business
 *    quality: it is the fraction of the assessment's questions that
 *    were actually answered (vs. skipped), compared against
 *    `config.confidenceThresholds`. It has nothing to do with how
 *    similar or different the category scores turn out to be.
 */
export class ConfigurableScoringEngine implements ScoringEngine {
  score(
    answers: Answer[],
    questionSet: QuestionSet,
    config: ScoringConfig
  ): AssessmentScoreResult {
    const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.value]));
    const questionsByCategory = this.groupQuestionsByCategory(questionSet);
    const categoryNameById = new Map(questionSet.categories.map((c) => [c.id, c.name]));

    const categoryScores: CategoryScore[] = REQUIRED_CATEGORY_IDS.map((categoryId) => {
      const categoryName = categoryNameById.get(categoryId) ?? categoryId;
      const questions = questionsByCategory.get(categoryId) ?? [];
      const values = questions
        .map((q) => answerByQuestionId.get(q.id))
        .filter((v): v is number => typeof v === "number");

      if (values.length === 0) {
        return { categoryId, categoryName, score: 0, status: "Insufficient data" };
      }

      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const normalized100 = this.normalize(mean, config.scaleMin, config.scaleMax);
      const score = Math.round(normalized100 * REQUIRED_CATEGORY_WEIGHT);

      return {
        categoryId,
        categoryName,
        score,
        status: this.deriveCategoryStatus(score, config),
      };
    });

    const answeredPool = categoryScores.filter((c) => c.status !== "Insufficient data");
    if (answeredPool.length === 0) {
      throw new Error("Cannot score an assessment with no answered questions.");
    }

    const overallScore = categoryScores.reduce((sum, c) => sum + c.score, 0);

    const ranked = [...answeredPool].sort((a, b) => a.score - b.score);
    const constraintCategory = ranked[0];
    const opportunityCategory = ranked[1] ?? ranked[0];

    const biggestConstraint = this.buildInsight(constraintCategory, config, "constraint");
    const biggestOpportunity = this.buildInsight(opportunityCategory, config, "opportunity");

    const topPriorities: PriorityItem[] = ranked
      .slice(0, Math.max(1, config.topPriorityCount))
      .map((c) => {
        const copy = config.categoryInsights[c.categoryId];
        return {
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          action: copy.priorityAction,
          whyItMatters: copy.priorityWhyItMatters,
          timeframe: copy.priorityTimeframe,
        };
      });

    const confidenceLevel = this.deriveConfidence(answers, questionSet, config);

    return {
      overallScore,
      categoryScores,
      biggestOpportunity,
      biggestConstraint,
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

  private buildInsight(
    categoryScore: CategoryScore,
    config: ScoringConfig,
    kind: "opportunity" | "constraint"
  ): Insight {
    const copy = config.categoryInsights[categoryScore.categoryId];
    if (!copy) {
      // Should be unreachable — validateStartupConfig guarantees every
      // required category has insight copy before the app can boot.
      throw new Error(
        `No categoryInsights configured for category "${categoryScore.categoryId}".`
      );
    }

    const headline = kind === "opportunity" ? copy.opportunityHeadline : copy.constraintHeadline;
    const baseDescription =
      kind === "opportunity" ? copy.opportunityDescription : copy.constraintDescription;

    // Cite the actual assessment signal in plain language, in addition
    // to the configured narrative copy, so the insight is evidence-
    // backed rather than generic template text.
    const evidenceSentence =
      kind === "constraint"
        ? ` This was your lowest-scoring dimension, at ${categoryScore.score}/20.`
        : ` This was your next-biggest area for improvement, at ${categoryScore.score}/20.`;

    return {
      categoryId: categoryScore.categoryId,
      categoryName: categoryScore.categoryName,
      headline,
      description: `${baseDescription}${evidenceSentence}`,
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
      // Unreachable if config was validated (a minCompleteness: 0 entry
      // is required), but fail loudly rather than guess if it happens.
      throw new Error("No confidence threshold matched — invalid confidenceThresholds config.");
    }

    return match.level;
  }
}
