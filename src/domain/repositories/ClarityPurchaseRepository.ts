import { ClarityPurchase } from "@/domain/entities/ClarityPurchase";
import {
  ClarityPurchaseStatus,
  ClarityIntakeStatus,
  ClaritySchedulingStatus,
} from "@/domain/value-objects/ClarityPurchaseStatus";

export interface CreateClarityPurchaseInput {
  clientRequestId: string;
  assessmentResultId: string | null;
  leadId: string | null;
  amountMinorUnits: number;
  currency: string;
  offerVersion: string;
  founderPricingApplied: boolean;
  sourceCampaign: { source?: string; medium?: string; campaign?: string } | null;
}

export interface ClarityPurchaseFieldUpdates {
  intakeStatus?: ClarityIntakeStatus;
  schedulingStatus?: ClaritySchedulingStatus;
  internalNotes?: string | null;
  customerEmail?: string | null;
}

/**
 * Port: persists Business Clarity Session purchase attempts.
 *
 * `createIfNotExists` is the idempotency boundary for checkout-session
 * creation — a retried "Book my session" click (double-click, network
 * retry, browser back+forward) sends the same `clientRequestId` and
 * MUST return the existing row/Stripe Checkout URL rather than
 * creating a second Stripe Checkout Session or a second DB row.
 *
 * `updateStatus` enforces the allowed state-machine transitions from
 * ClarityPurchaseStatus so a replayed or out-of-order webhook can
 * never move a purchase backwards.
 *
 * `updateFields` is deliberately separate from `updateStatus`: it
 * writes auxiliary fields (intakeStatus, schedulingStatus,
 * internalNotes, customerEmail) that are NOT governed by the main
 * status state machine and can legitimately change independently of
 * (or slightly out of step with) a `status` transition — e.g. the
 * scheduling-link endpoint marks schedulingStatus "link_sent" the
 * moment it hands out a link, which is not itself a `status`
 * transition.
 */
export interface ClarityPurchaseRepository {
  createIfNotExists(input: CreateClarityPurchaseInput): Promise<ClarityPurchase>;
  findByClientRequestId(clientRequestId: string): Promise<ClarityPurchase | null>;
  findByStripeCheckoutSessionId(stripeCheckoutSessionId: string): Promise<ClarityPurchase | null>;
  findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<ClarityPurchase | null>;
  findById(id: string): Promise<ClarityPurchase | null>;
  attachStripeCheckoutSessionId(id: string, stripeCheckoutSessionId: string): Promise<void>;
  updateStatus(
    id: string,
    to: ClarityPurchaseStatus,
    extra?: Partial<
      Pick<
        ClarityPurchase,
        | "stripePaymentIntentId"
        | "stripeCustomerId"
        | "paidAt"
        | "refundedAt"
        | "refundReason"
        | "scheduledAt"
        | "planDeliveredAt"
        | "followUpDueAt"
        | "followUpDoneAt"
      >
    >
  ): Promise<boolean>;
  updateFields(id: string, fields: ClarityPurchaseFieldUpdates): Promise<void>;
  listForFulfillment(): Promise<ClarityPurchase[]>;
  /** Real, accurate count of purchases that both used founding pricing AND actually paid — the basis for computeOfferPricing(). */
  countPaidFoundingPurchases(): Promise<number>;
}
