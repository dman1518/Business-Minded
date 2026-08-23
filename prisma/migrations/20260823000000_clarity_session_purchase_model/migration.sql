-- Business Clarity Session (paid offer) data model.
-- Adds three tables: clarity_purchases, clarity_intakes,
-- clarity_webhook_events. Purely additive (no existing table altered).
-- Safe to apply without downtime or backfill.

-- CreateTable
CREATE TABLE "clarity_purchases" (
    "id" TEXT NOT NULL,
    "assessmentResultId" TEXT,
    "leadId" TEXT,
    "clientRequestId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "offerVersion" TEXT NOT NULL,
    "founderPricingApplied" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'checkout_created',
    "sourceCampaign" JSONB,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "intakeStatus" TEXT NOT NULL DEFAULT 'not_started',
    "schedulingStatus" TEXT NOT NULL DEFAULT 'not_started',
    "scheduledAt" TIMESTAMP(3),
    "planDeliveredAt" TIMESTAMP(3),
    "followUpDueAt" TIMESTAMP(3),
    "followUpDoneAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clarity_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarity_intakes" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "consentTimestamp" TIMESTAMP(3),
    "consentPolicyVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clarity_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarity_webhook_events" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clarity_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clarity_purchases_clientRequestId_key" ON "clarity_purchases"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "clarity_purchases_stripeCheckoutSessionId_key" ON "clarity_purchases"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "clarity_purchases_stripePaymentIntentId_key" ON "clarity_purchases"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "clarity_purchases_status_idx" ON "clarity_purchases"("status");

-- CreateIndex
CREATE INDEX "clarity_purchases_assessmentResultId_idx" ON "clarity_purchases"("assessmentResultId");

-- CreateIndex
CREATE INDEX "clarity_purchases_leadId_idx" ON "clarity_purchases"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "clarity_intakes_purchaseId_key" ON "clarity_intakes"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "clarity_webhook_events_stripeEventId_key" ON "clarity_webhook_events"("stripeEventId");

-- AddForeignKey
ALTER TABLE "clarity_purchases" ADD CONSTRAINT "clarity_purchases_assessmentResultId_fkey" FOREIGN KEY ("assessmentResultId") REFERENCES "assessment_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarity_purchases" ADD CONSTRAINT "clarity_purchases_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarity_intakes" ADD CONSTRAINT "clarity_intakes_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "clarity_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
