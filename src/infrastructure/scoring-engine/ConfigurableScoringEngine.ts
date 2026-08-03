import { Answer } from "@/domain/entities/Answer";
import { QuestionSet } from "@/domain/entities/Question";
import { AssessmentScoreResult, CategoryScore, ConfidenceLevel } from "@/domain/entities/Score";
import { Insight } from "@/domain/value-objects/Insight";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";
import { ScoringEngine } from "@/domain/repositories/ScoringEngine";

/**
 * Adapter: computes an AssessmentScoreResult from raw answers.
 *
 * Every business rule below (category weights, insight copy, which
 * category becomes the "constraint" vs. the "opportunity", confidence
 * thresholds) is read from `ScoringConfig` — nothing is hardcoded here.
 * Configuration is validated at startup (see validateStartupConfig), so
 * this class trusts it and does not silently substitute fallback values
 * (zero weights, equal weights, empty copy) for anything invalid — a
 * broken config is expected to have already failed loudly before this
 * code ever runs.
 *
 * Rules encoded (documented as assumptions in the README):
 *  - Each category's score is the mean of its answered questions,
 *    normalized from [scaleMin, scaleMax] to [0, 100].
 *  - The overall score is the weighted average of category scores,
 *    re-normalizing across whichever categories actually have answers
 *    (this is normal handling of a respondent skipping questions, not
 *    a config fallback).
 *  - "Biggest Constraint" = lowest-scoring category (the weakest link).
 *  - "Biggest Opportunity" = next-lowest-scoring category (the category
 *    with the most upside after the constraint).
 *  - "Top Priorities" = the `topPriorityCount` lowest-scoring
 *    categories' configured recommendations.
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

    const categoryScores: CategoryScore[] = [];
    const effectiveWeights: Record<string, number> = {};

    for (const category of questionSet.categories) {
      const questions = questionsByCategory.get(category.id) ?? [];
      const values = questions
        .map((q) => answerByQuestionId.get(q.id))
        .filter((v): v is number => typeof v === "number");

      if (values.length === 0) {
        continue; // No signal for this category — excluded from scoring.
      }

      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const normalized = this.normalize(mean, config.scaleMin, config.scaleMax);

      categoryScores.push({
        categoryId: category.id,
        categoryName: category.name,
        score: Math.round(normalized),
      });
      effectiveWeights[category.id] = config.categoryWeights[category.id];
    }

    if (categoryScores.length === 0) {
      throw new Error("Cannot score an assessment with no answered questions.");
    }

    const overallScore = Math.round(this.weightedAverage(categoryScores, effectiveWeights));

    const ranked = [...categoryScores].sort((a, b) => a.score - b.score);
    const constraintCategory = ranked[0];
    const opportunityCategory = ranked[1] ?? ranked[0];

    const biggestConstraint = this.buildInsight(constraintCategory, config, "constraint");
    const biggestOpportunity = this.buildInsight(opportunityCategory, config, "opportunity");

    const topPriorities = ranked
      .slice(0, Math.max(1, config.topPriorityCount))
      .map((c) => config.categoryInsights[c.categoryId].recommendation);

    const confidenceLevel = this.deriveConfidence(answers, questionSet, config);

    return {
      overallScore,
      categoryScores: [...categoryScores].sort(
        (a, b) =>
          questionSet.categories.findIndex((c) => c.id === a.categoryId) -
          questionSet.categories.findIndex((c) => c.id === b.categoryId)
      ),
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

  private weightedAverage(
    categoryScores: CategoryScore[],
    weights: Record<string, number>
  ): number {
    // Re-normalize across only the categories that received at least one
    // answer. Every required category carries the same configured weight
    // (validated at startup), so this simply redistributes weight away
    // from categories the respondent skipped entirely — it is not a
    // fallback for missing/invalid configuration.
    const totalWeight = categoryScores.reduce((sum, c) => sum + weights[c.categoryId], 0);

    return categoryScores.reduce(
      (sum, c) => sum + c.score * (weights[c.categoryId] / totalWeight),
      0
    );
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

    return {
      categoryId: categoryScore.categoryId,
      categoryName: categoryScore.categoryName,
      headline: kind === "opportunity" ? copy.opportunityHeadline : copy.constraintHeadline,
      description:
        kind === "opportunity" ? copy.opportunityDescription : copy.constraintDescription,
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
