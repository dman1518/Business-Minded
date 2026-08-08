import { QuestionSet } from "@/domain/entities/Question";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";
import { REQUIRED_CATEGORY_IDS } from "@/domain/policies/RequiredCategories";

/**
 * Minimal, hand-computable fixtures for the locked Business Minded
 * Framework v1: 5 equally-weighted categories, 2 questions each,
 * a 1-5 answer scale, and round-number thresholds. Used by both the
 * scoring-engine and config-validation test suites so every test
 * starts from a known-valid baseline and mutates one thing at a time.
 */
export function buildValidQuestionSet(): QuestionSet {
  return {
    categories: REQUIRED_CATEGORY_IDS.map((id) => ({
      id,
      name: id[0].toUpperCase() + id.slice(1),
      description: `${id} description`,
    })),
    questions: REQUIRED_CATEGORY_IDS.flatMap((categoryId, categoryIndex) => [
      {
        id: `${categoryId}_1`,
        categoryId,
        order: categoryIndex * 2 + 1,
        type: "single-select" as const,
        text: `${categoryId} question 1`,
        options: [1, 2, 3, 4, 5].map((value) => ({ value, label: `Option ${value}` })),
      },
      {
        id: `${categoryId}_2`,
        categoryId,
        order: categoryIndex * 2 + 2,
        type: "single-select" as const,
        text: `${categoryId} question 2`,
        options: [1, 2, 3, 4, 5].map((value) => ({ value, label: `Option ${value}` })),
      },
    ]),
  };
}

export function buildValidScoringConfig(): ScoringConfig {
  const categoryWeights: Record<string, number> = {};
  const categoryInsights: ScoringConfig["categoryInsights"] = {};

  for (const id of REQUIRED_CATEGORY_IDS) {
    categoryWeights[id] = 0.2;
    categoryInsights[id] = {
      opportunityHeadline: `${id} opportunity headline`,
      opportunityDescription: `${id} opportunity description`,
      constraintHeadline: `${id} constraint headline`,
      constraintDescription: `${id} constraint description`,
      strengthHeadline: `${id} strength headline`,
      strengthDescription: `${id} strength description`,
      priorityAction: `${id} priority action`,
      priorityWhyItMatters: `${id} priority why`,
      priorityTimeframe: `${id} priority timeframe`,
    };
  }

  return {
    categoryWeights,
    scaleMin: 1,
    scaleMax: 5,
    categoryInsights,
    confidenceThresholds: [
      { minCompleteness: 0.9, level: "High" },
      { minCompleteness: 0.6, level: "Medium" },
      { minCompleteness: 0, level: "Low" },
    ],
    categoryStatusThresholds: [
      { minScore: 16, status: "Strength" },
      { minScore: 10, status: "Developing" },
      { minScore: 0, status: "Constraint" },
    ],
    scoreInterpretationThresholds: [
      { minScore: 50, text: "Good, at {score}." },
      { minScore: 0, text: "Needs work, at {score}." },
    ],
    topPriorityCount: 3,
  };
}
