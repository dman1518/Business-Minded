import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";
import { AssessmentScoreResult } from "@/domain/entities/Score";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { Segmentation } from "@/domain/value-objects/Segmentation";
import { QuestionRepository } from "@/domain/repositories/QuestionRepository";
import { ScoringConfigRepository } from "@/domain/repositories/ScoringConfigRepository";
import { ScoringEngine } from "@/domain/repositories/ScoringEngine";
import { CURRENT_SCORING_VERSION } from "@/domain/policies/ScoringVersion";
import { prisma } from "@/infrastructure/db/prisma";

type LegacyResultRecord = {
  id: string;
  createdAt: Date;
  resultModel: unknown;
  scoringVersion: string | null;
  overallScore: number | null;
  categoryScores: unknown;
  biggestOpportunity: unknown;
  biggestConstraint: unknown;
  topPriorities: unknown;
  confidenceLevel: string | null;
  rawAnswers: unknown;
  segmentation: unknown;
};

/**
 * Adapter: persists AssessmentScoreResult via Prisma/Postgres.
 *
 * Every new write stores the FULL canonical AssessmentScoreResult as
 * one versioned JSON blob (`resultModel` + `scoringVersion`) rather
 * than spreading it across per-field columns — this is what guarantees
 * the web results page and PDF generation can never drift apart: both
 * read this exact same object (see GenerateReport / AssessmentResultView).
 *
 * Rows written before this repository existed have a null
 * `resultModel`. Rather than a destructive one-time backfill migration
 * (which this sandbox cannot run against production anyway — see
 * README), those rows are recomputed on read from their already-stored
 * `rawAnswers` using the CURRENT scoring engine + config. This has a
 * useful side effect: the four production scoring bugs this task fixes
 * are corrected retroactively for any already-persisted result, not
 * just new submissions, the moment this deploys.
 */
export class PrismaAssessmentResultRepository implements AssessmentResultRepository {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly scoringConfigRepository: ScoringConfigRepository,
    private readonly scoringEngine: ScoringEngine
  ) {}

  async save(
    result: AssessmentScoreResult,
    rawAnswers: Record<string, number>,
    segmentation?: Segmentation
  ): Promise<SavedAssessmentResult> {
    const saved = await prisma.assessmentResult.create({
      data: {
        resultModel: result as unknown as object,
        scoringVersion: CURRENT_SCORING_VERSION,
        rawAnswers: rawAnswers as unknown as object,
        segmentation: segmentation ? (segmentation as unknown as object) : undefined,
      },
    });

    return {
      ...result,
      id: saved.id,
      rawAnswers,
      segmentation,
      createdAt: saved.createdAt,
    };
  }

  async findById(id: string): Promise<SavedAssessmentResult | null> {
    const record = (await prisma.assessmentResult.findUnique({ where: { id } })) as LegacyResultRecord | null;
    if (!record) return null;

    const rawAnswers = record.rawAnswers as unknown as Record<string, number>;
    const segmentation = (record.segmentation as unknown as Segmentation | null) ?? undefined;

    const result = record.resultModel
      ? (record.resultModel as unknown as AssessmentScoreResult)
      : await this.recomputeLegacyResult(rawAnswers);

    return {
      ...result,
      id: record.id,
      rawAnswers,
      segmentation,
      createdAt: record.createdAt,
    };
  }

  /**
   * Recomputes a full canonical result for a legacy row (one written
   * before resultModel existed) purely from its persisted rawAnswers.
   * Deliberately does NOT write the recomputed value back to the row
   * on every read — that would turn a read into a write on the hot
   * path and risk masking concurrent-write issues. A future
   * maintenance script can persist this recomputation permanently
   * (see docs note in README) if the legacy read-time cost matters.
   */
  private async recomputeLegacyResult(rawAnswers: Record<string, number>): Promise<AssessmentScoreResult> {
    const [questionSet, config] = await Promise.all([
      this.questionRepository.getQuestionSet(),
      this.scoringConfigRepository.getConfig(),
    ]);

    const answers = Object.entries(rawAnswers).map(([questionId, value]) => ({ questionId, value }));
    return this.scoringEngine.score(answers, questionSet, config);
  }
}
