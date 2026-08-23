/**
 * Port: creates and retrieves hosted checkout sessions for the
 * Business Clarity Session offer. Sprint implementation is backed by
 * Stripe Checkout; kept as a port so the application layer never
 * imports the Stripe SDK directly.
 */

export interface CreateCheckoutSessionInput {
  /** Used as the Stripe Idempotency-Key so a retried request can never create two Sessions. */
  idempotencyKey: string;
  amountMinorUnits: number;
  currency: string;
  productName: string;
  productDescription: string;
  successUrl: string;
  cancelUrl: string;
  /** Non-secret identifiers only — never PII. Written into Stripe Checkout Session metadata. */
  metadata: Record<string, string>;
}

export interface CreatedCheckoutSession {
  stripeCheckoutSessionId: string;
  url: string;
}

export type RetrievedCheckoutSessionStatus = "open" | "complete" | "expired";

export interface RetrievedCheckoutSession {
  status: RetrievedCheckoutSessionStatus;
  url: string | null;
  paymentIntentId: string | null;
  customerId: string | null;
}

export interface ClarityCheckoutGateway {
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreatedCheckoutSession>;
  retrieveCheckoutSession(stripeCheckoutSessionId: string): Promise<RetrievedCheckoutSession | null>;
}
