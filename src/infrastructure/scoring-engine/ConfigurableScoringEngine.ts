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
 * thresholds) is read from `ScoringConfig` — nothing is hardcoded.
 * This class only implements the *procedure*: normalize -> weight ->
 * rank -> narrate.
 *
 * Rules encoded (documented as assumptions in the README):
 *  - Each category's score is the mean of its answered questions,
 *    normalized from [scaleMin, scaleMax] to [0, 100].
 *  - The overall score is the weighted average of category scores,
 *    re-normalizing weights if a category has no answers.
 *  - "Biggest Constraint" = lowest-scoring category (the weakest link).
 *  - "Biggest Opportunity" = next-lowest-scoring category (the category
 *    with the most upside after the constraint).
 *  - "Top Priorities" = the `topPriorityCount` lowest-scoring
 *    categories' configured recommendations.
 *  - "Confidence Level" = derived from how tightly clustered category
 *    scores are (standard deviation) against configured thresholds —
 *    a consistent profile across categories is treated as a clearer,
 *    higher-confidence signal than one with wildly uneven categories.
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
      effectiveWeights[category.id] = config.categoryWeights[category.id] ?? 0;
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
      .map((c) => config.categoryInsights[c.categoryId]?.recommendation)
      .filter((r): r is string => Boolean(r));

    const confidenceLevel = this.deriveConfidence(categoryScores, config);

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
    const totalWeight = categoryScores.reduce(
      (sum, c) => sum + (weights[c.categoryId] ?? 0),
      0
    );

    if (totalWeight === 0) {
      // Defensive fallback: no configured weights — treat all as equal.
      return categoryScores.reduce((sum, c) => sum + c.score, 0) / categoryScores.length;
    }

    return categoryScores.reduce(
      (sum, c) => sum + c.score * ((weights[c.categoryId] ?? 0) / totalWeight),
      0
    );
  }

  private buildInsight(
    categoryScore: CategoryScore,
    config: ScoringConfig,
    kind: "opportunity" | "constraint"
  ): Insight {
    const copy = config.categoryInsights[categoryScore.categoryId];
    return {
      categoryId: categoryScore.categoryId,
      categoryName: categoryScore.categoryName,
      headline:
        kind === "opportunity"
          ? copy?.opportunityHeadline ?? categoryScore.categoryName
          : copy?.constraintHeadline ?? categoryScore.categoryName,
      description:
        kind === "opportunity"
          ? copy?.opportunityDescription ?? ""
          : copy?.constraintDescription ?? "",
    };
  }

  private deriveConfidence(
    categoryScores: CategoryScore[],
    config: ScoringConfig
  ): ConfidenceLevel {
    const mean =
      categoryScores.reduce((sum, c) => sum + c.score, 0) / categoryScores.length;
    const variance =
      categoryScores.reduce((sum, c) => sum + (c.score - mean) ** 2, 0) /
      categoryScores.length;
    const stdDev = Math.sqrt(variance);

    const sortedThresholds = [...config.confidenceThresholds].sort(
      (a, b) => a.maxStdDev - b.maxStdDev
    );
    const match = sortedThresholds.find((t) => stdDev <= t.maxStdDev);
    return match?.level ?? "Medium";
  }
}
