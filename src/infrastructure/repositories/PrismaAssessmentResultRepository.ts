import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";
import { AssessmentScoreResult } from "@/domain/entities/Score";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { prisma } from "@/infrastructure/db/prisma";

/**
 * Adapter: persists AssessmentScoreResult via Prisma/Postgres.
 */
export class PrismaAssessmentResultRepository implements AssessmentResultRepository {
  async save(
    result: AssessmentScoreResult,
    rawAnswers: Record<string, number>
  ): Promise<SavedAssessmentResult> {
    const saved = await prisma.assessmentResult.create({
      data: {
        overallScore: result.overallScore,
        categoryScores: result.categoryScores as unknown as object,
        biggestOpportunity: result.biggestOpportunity as unknown as object,
        biggestConstraint: result.biggestConstraint as unknown as object,
        topPriorities: result.topPriorities as unknown as object,
        confidenceLevel: result.confidenceLevel,
        rawAnswers: rawAnswers as unknown as object,
      },
    });

    return this.toDomain(saved, result, rawAnswers);
  }

  async findById(id: string): Promise<SavedAssessmentResult | null> {
    const record = await prisma.assessmentResult.findUnique({ where: { id } });
    if (!record) return null;

    return {
      id: record.id,
      overallScore: record.overallScore,
      categoryScores: record.categoryScores as unknown as SavedAssessmentResult["categoryScores"],
      biggestOpportunity: record.biggestOpportunity as unknown as SavedAssessmentResult["biggestOpportunity"],
      biggestConstraint: record.biggestConstraint as unknown as SavedAssessmentResult["biggestConstraint"],
      topPriorities: record.topPriorities as unknown as SavedAssessmentResult["topPriorities"],
      confidenceLevel: record.confidenceLevel as SavedAssessmentResult["confidenceLevel"],
      rawAnswers: record.rawAnswers as unknown as Record<string, number>,
      createdAt: record.createdAt,
    };
  }

  private toDomain(
    record: { id: string; createdAt: Date },
    result: AssessmentScoreResult,
    rawAnswers: Record<string, number>
  ): SavedAssessmentResult {
    return {
      ...result,
      id: record.id,
      rawAnswers,
      createdAt: record.createdAt,
    };
  }

  private toDomain(
    record: { id: string; createdAt: Date },
    result: AssessmentScoreResult,
    rawAnswers: Record<string, number>
  ): SavedAssessmentResult {
    return {
      ...result,
      id: record.id,
      rawAnswers,
      createdAt: record.createdAt,
    };
  }
}
