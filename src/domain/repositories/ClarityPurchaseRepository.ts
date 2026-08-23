import { ClarityPurchase } from "@/domain/entities/ClarityPurchase";
import { ClarityPurchaseStatus } from "@/domain/value-objects/ClarityPurchaseStatus";

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
 */
export interface ClarityPurchaseRepository {
  createIfNotExists(input: CreateClarityPurchaseInput): Promise<ClarityPurchase>;
  findByClientRequestId(clientRequestId: string): Promise<ClarityPurchase | null>;
  findByStripeCheckoutSessionId(stripeCheckoutSessionId: string): Promise<ClarityPurchase | null>;
  findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<ClarityPurchase | null>;
  findById(id: string): Promise<ClarityPurchase | null>;
  attachStripeCheckoutSessionId(id: string, stripeCheckoutSessionId: string): Promise<void>;
  /**
   * Applies a status transition. Implementations MUST no-op (not
   * throw) when `to` is already the current status, and MUST reject
   * (return false, not throw) an out-of-order/disallowed transition so
   * webhook handlers can log-and-skip rather than 500. Returns true if
   * the transition was applied.
   */
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
  listForFulfillment(): Promise<ClarityPurchase[]>;
}
