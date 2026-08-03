-- CreateTable
CREATE TABLE "assessment_results" (
    "id" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "categoryScores" JSONB NOT NULL,
    "biggestOpportunity" JSONB NOT NULL,
    "biggestConstraint" JSONB NOT NULL,
    "topPriorities" JSONB NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "rawAnswers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "assessmentResultId" TEXT NOT NULL,
    "consentTimestamp" TIMESTAMP(3) NOT NULL,
    "consentPolicyVersion" TEXT NOT NULL,
    "reportGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_assessmentResultId_key" ON "leads"("assessmentResultId");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assessmentResultId_fkey" FOREIGN KEY ("assessmentResultId") REFERENCES "assessment_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
