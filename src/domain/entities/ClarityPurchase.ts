import { ClarityPurchaseStatus, ClarityIntakeStatus, ClaritySchedulingStatus } from "@/domain/value-objects/ClarityPurchaseStatus";

/** Non-PII marketing attribution captured at checkout time. */
export interface SourceCampaign {
  source?: string;
  medium?: string;
  campaign?: string;
}

export interface ClarityPurchase {
  id: string;
  assessmentResultId: string | null;
  leadId: string | null;
  clientRequestId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  /** Captured from Stripe Checkout's collected billing email once the webhook confirms payment. */
  customerEmail: string | null;
  amountMinorUnits: number;
  currency: string;
  offerVersion: string;
  founderPricingApplied: boolean;
  status: ClarityPurchaseStatus;
  sourceCampaign: SourceCampaign | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  refundReason: string | null;
  intakeStatus: ClarityIntakeStatus;
  schedulingStatus: ClaritySchedulingStatus;
  scheduledAt: Date | null;
  planDeliveredAt: Date | null;
  followUpDueAt: Date | null;
  followUpDoneAt: Date | null;
  internalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
