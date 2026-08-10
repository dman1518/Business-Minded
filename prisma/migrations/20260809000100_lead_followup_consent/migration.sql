-- Adds a third, separate consent field: optional personalized
-- follow-up about a specific assessment's results, distinct from the
-- required report-delivery consent and the separate general marketing
-- consent that already existed. See src/domain/entities/Lead.ts.

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "resultsFollowUpConsentAt" TIMESTAMP(3);
