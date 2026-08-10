/**
 * Thrown when an assessment has zero answered questions — there is no
 * evidence to score anything. This is an intentional, distinct
 * condition from a scoring failure: the API route maps it to a 422
 * with structured guidance, never a generic 500 "something went
 * wrong" — see src/app/api/assessments/route.ts.
 */
export class InsufficientDataError extends Error {
  constructor() {
    super("At least one answered question is required to calculate a result.");
    this.name = "InsufficientDataError";
  }
}
