-- Canonical, versioned scoring result model.
--
-- Adds resultModel/scoringVersion as the new single source of truth for
-- an assessment's scored outcome (consumed identically by the web
-- results page and PDF generation). The prior per-field columns
-- (overallScore, categoryScores, biggestOpportunity, biggestConstraint,
-- topPriorities, confidenceLevel) are relaxed to nullable and kept as a
-- read-only legacy audit trail rather than dropped, so no existing row
-- is destroyed or made unreadable by this migration. New code never
-- writes to the legacy columns; rows written before this migration are
-- recomputed from rawAnswers at read time using the current scoring
-- engine (see PrismaAssessmentResultRepository), which also means the
-- corrected scoring logic applies retroactively to historical results
-- without a separate backfill job.

-- AlterTable
ALTER TABLE "assessment_results" ADD COLUMN "resultModel" JSONB;
ALTER TABLE "assessment_results" ADD COLUMN "scoringVersion" TEXT;
ALTER TABLE "assessment_results" ALTER COLUMN "overallScore" DROP NOT NULL;
ALTER TABLE "assessment_results" ALTER COLUMN "categoryScores" DROP NOT NULL;
ALTER TABLE "assessment_results" ALTER COLUMN "biggestOpportunity" DROP NOT NULL;
ALTER TABLE "assessment_results" ALTER COLUMN "biggestConstraint" DROP NOT NULL;
ALTER TABLE "assessment_results" ALTER COLUMN "topPriorities" DROP NOT NULL;
ALTER TABLE "assessment_results" ALTER COLUMN "confidenceLevel" DROP NOT NULL;
