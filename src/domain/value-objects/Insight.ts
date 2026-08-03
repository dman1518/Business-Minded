/**
 * Value object: Insight.
 * A narrative callout tied to a category — used for "Biggest Opportunity"
 * and "Biggest Constraint" on the Results page. Immutable, no identity.
 */
export interface Insight {
  categoryId: string;
  categoryName: string;
  headline: string;
  description: string;
}
