import { AssessmentScoreResult } from "../entities/Score";
import { SavedAssessmentResult } from "../entities/AssessmentResult";

/**
 * Port: persists and retrieves scored assessment results.
 * Sprint 1 implementation is backed by Postgres via Prisma.
 */
export interface AssessmentResultRepository {
  save(
    result: AssessmentScoreResult,
    rawAnswers: Record<string, number>
  ): Promise<SavedAssessmentResult>;
  findById(id: string): Promise<SavedAssessmentResult | null>;
}
