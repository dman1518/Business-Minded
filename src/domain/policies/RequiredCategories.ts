/**
 * The Business Minded Framework v1 is locked: exactly five equally
 * weighted dimensions make up the single Business Minded Score.
 * Freedom is one of the five — there is no separate Freedom or Owner
 * Dependence score.
 *
 * This module is the single source of truth for that policy. The
 * config validator (validateStartupConfig) and the scoring engine
 * both depend on it instead of re-declaring the category list.
 */
export const REQUIRED_CATEGORY_IDS = [
  "money",
  "operations",
  "growth",
  "freedom",
  "resilience",
] as const;

export type RequiredCategoryId = (typeof REQUIRED_CATEGORY_IDS)[number];

/** Every required category carries the same weight: 20% of the 100-point score. */
export const REQUIRED_CATEGORY_WEIGHT = 0.2;

export function isRequiredCategoryId(id: string): id is RequiredCategoryId {
  return (REQUIRED_CATEGORY_IDS as readonly string[]).includes(id);
}
