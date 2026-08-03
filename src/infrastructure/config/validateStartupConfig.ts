import { QuestionSet } from "@/domain/entities/Question";
import { ScoringConfig, CategoryInsightConfig } from "@/domain/repositories/ScoringConfigRepository";
import { REQUIRED_CATEGORY_IDS, REQUIRED_CATEGORY_WEIGHT } from "@/domain/policies/RequiredCategories";

const REQUIRED_INSIGHT_FIELDS: (keyof CategoryInsightConfig)[] = [
  "opportunityHeadline",
  "opportunityDescription",
  "constraintHeadline",
  "constraintDescription",
  "recommendation",
];

const WEIGHT_EPSILON = 0.001;

/**
 * Validates the question set and scoring config together against the
 * locked Business Minded Framework v1 policy. Intended to run:
 *  - at build time, via `npm run validate:config` (wired as `prebuild`), and
 *  - at server startup, via an eager call in the composition root (container.ts),
 * so a broken production configuration fails loudly instead of silently
 * falling back to zero weights, equal weights, or empty copy.
 *
 * Throws a single Error listing every problem found (not just the first),
 * so a misconfiguration can be fixed in one pass.
 */
export function validateStartupConfig(questionSet: QuestionSet, scoringConfig: ScoringConfig): void {
  const errors: string[] = [];

  validateCategories(questionSet, errors);
  validateWeights(scoringConfig, errors);
  validateQuestions(questionSet, errors);
  validateInsights(scoringConfig, errors);
  validateConfidenceThresholds(scoringConfig, errors);
  validateTopPriorityCount(scoringConfig, errors);
  validateScale(scoringConfig, errors);

  if (errors.length > 0) {
    throw new Error(
      `Invalid Business Minded configuration (${errors.length} issue${
        errors.length === 1 ? "" : "s"
      }):\n- ${errors.join("\n- ")}`
    );
  }
}

function validateCategories(questionSet: QuestionSet, errors: string[]): void {
  const categoryIds = new Set(questionSet.categories.map((c) => c.id));

  for (const required of REQUIRED_CATEGORY_IDS) {
    if (!categoryIds.has(required)) {
      errors.push(`Missing required category "${required}".`);
    }
  }

  for (const id of categoryIds) {
    if (!(REQUIRED_CATEGORY_IDS as readonly string[]).includes(id)) {
      errors.push(
        `Unexpected category "${id}" — the framework is locked to exactly: ${REQUIRED_CATEGORY_IDS.join(", ")}.`
      );
    }
  }
}

function validateWeights(scoringConfig: ScoringConfig, errors: string[]): void {
  for (const id of REQUIRED_CATEGORY_IDS) {
    const weight = scoringConfig.categoryWeights[id];
    if (typeof weight !== "number" || Number.isNaN(weight)) {
      errors.push(`Missing categoryWeights entry for "${id}".`);
      continue;
    }
    if (Math.abs(weight - REQUIRED_CATEGORY_WEIGHT) > WEIGHT_EPSILON) {
      errors.push(
        `Category "${id}" weight must be exactly ${REQUIRED_CATEGORY_WEIGHT} (20%), got ${weight}.`
      );
    }
  }

  const total = REQUIRED_CATEGORY_IDS.reduce(
    (sum, id) => sum + (scoringConfig.categoryWeights[id] ?? 0),
    0
  );
  if (Math.abs(total - 1) > WEIGHT_EPSILON) {
    errors.push(`Category weights must sum to 1.0, got ${total}.`);
  }
}

function validateQuestions(questionSet: QuestionSet, errors: string[]): void {
  const categoryIds = new Set(questionSet.categories.map((c) => c.id));
  const questionCountByCategory = new Map<string, number>();

  if (questionSet.questions.length === 0) {
    errors.push("Question set must contain at least one question.");
  }

  for (const question of questionSet.questions) {
    if (!categoryIds.has(question.categoryId)) {
      errors.push(`Question "${question.id}" references unknown category "${question.categoryId}".`);
      continue;
    }
    questionCountByCategory.set(
      question.categoryId,
      (questionCountByCategory.get(question.categoryId) ?? 0) + 1
    );
  }

  for (const id of REQUIRED_CATEGORY_IDS) {
    if (!questionCountByCategory.get(id)) {
      errors.push(`Category "${id}" has no questions.`);
    }
  }
}

function validateInsights(scoringConfig: ScoringConfig, errors: string[]): void {
  for (const id of REQUIRED_CATEGORY_IDS) {
    const insight = scoringConfig.categoryInsights[id];
    if (!insight) {
      errors.push(`Missing categoryInsights entry for "${id}".`);
      continue;
    }
    for (const field of REQUIRED_INSIGHT_FIELDS) {
      const value = insight[field];
      if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`Missing or empty "${field}" text for category "${id}".`);
      }
    }
  }
}

function validateConfidenceThresholds(scoringConfig: ScoringConfig, errors: string[]): void {
  const thresholds = scoringConfig.confidenceThresholds;

  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    errors.push("confidenceThresholds must be a non-empty array.");
    return;
  }

  const validLevels = new Set(["Low", "Medium", "High"]);
  let hasZeroFloor = false;

  for (const threshold of thresholds) {
    if (
      typeof threshold.minCompleteness !== "number" ||
      Number.isNaN(threshold.minCompleteness) ||
      threshold.minCompleteness < 0 ||
      threshold.minCompleteness > 1
    ) {
      errors.push(
        `Invalid confidenceThresholds.minCompleteness "${threshold.minCompleteness}" — must be a number between 0 and 1.`
      );
    } else if (threshold.minCompleteness === 0) {
      hasZeroFloor = true;
    }

    if (!validLevels.has(threshold.level)) {
      errors.push(`Invalid confidenceThresholds.level "${threshold.level}".`);
    }
  }

  if (!hasZeroFloor) {
    errors.push(
      "confidenceThresholds must include a catch-all entry with minCompleteness: 0, so every completeness value resolves to a level."
    );
  }
}

function validateTopPriorityCount(scoringConfig: ScoringConfig, errors: string[]): void {
  if (
    typeof scoringConfig.topPriorityCount !== "number" ||
    !Number.isInteger(scoringConfig.topPriorityCount) ||
    scoringConfig.topPriorityCount < 1
  ) {
    errors.push("topPriorityCount must be a positive integer.");
  }
}

function validateScale(scoringConfig: ScoringConfig, errors: string[]): void {
  if (
    typeof scoringConfig.scaleMin !== "number" ||
    typeof scoringConfig.scaleMax !== "number" ||
    scoringConfig.scaleMin >= scoringConfig.scaleMax
  ) {
    errors.push(
      `scaleMin/scaleMax must be numbers with scaleMin < scaleMax, got scaleMin=${scoringConfig.scaleMin}, scaleMax=${scoringConfig.scaleMax}.`
    );
  }
}
