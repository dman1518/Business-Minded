import { ClarityPurchaseRepository } from "@/domain/repositories/ClarityPurchaseRepository";
import { ClarityCheckoutGateway } from "@/domain/repositories/ClarityCheckoutGateway";
import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";
import { LeadRepository } from "@/domain/repositories/LeadRepository";
import { computeOfferPricing } from "@/domain/policies/ClarityOfferConfig";

export interface CreateClarityCheckoutInput {
  clientRequestId: string;
  assessmentResultId?: string;
  sourceCampaign?: { source?: string; medium?: string; campaign?: string };
  successUrl: string;
  cancelUrl: string;
}

export type CreateClarityCheckoutResult =
  | { kind: "checkout_url"; url: string; purchaseId: string }
  | { kind: "already_paid"; purchaseId: string };

const PRODUCT_NAME = "Business Clarity Session";
const PRODUCT_DESCRIPTION =
  "Private 75-minute session, pre-session intake, written Business Clarity Plan within 24 hours, and one 15-minute follow-up check-in.";

/**
 * Use case: starts (or resumes) a Business Clarity Session checkout.
 *
 * Idempotency: `clientRequestId` is the single source of truth for
 * "is this the same attempt." A retried/double-submitted request with
 * the same clientRequestId never creates a second Stripe Checkout
 * Session or a second purchase row — see the three branches below.
 *
 * Never trusts a client-submitted price: pricing always comes from
 * computeOfferPricing(), which itself derives from a real DB count of
 * already-paid founding purchases.
 */
export class CreateClarityCheckoutSession {
  constructor(
    private readonly purchaseRepository: ClarityPurchaseRepository,
    private readonly checkoutGateway: ClarityCheckoutGateway,
    private readonly assessmentResultRepository: AssessmentResultRepository,
    private readonly leadRepository: LeadRepository
  ) {}

  async execute(input: CreateClarityCheckoutInput): Promise<CreateClarityCheckoutResult> {
    const existing = await this.purchaseRepository.findByClientRequestId(input.clientRequestId);

    if (existing) {
      if (this.isPaidOrLater(existing.status)) {
        return { kind: "already_paid", purchaseId: existing.id };
      }

      if (existing.status === "checkout_created" && existing.stripeCheckoutSessionId) {
        const retrieved = await this.checkoutGateway.retrieveCheckoutSession(
          existing.stripeCheckoutSessionId
        );
        if (retrieved && retrieved.status === "open" && retrieved.url) {
          // Same attempt, still open — resume it rather than creating
          // a second Stripe Checkout Session.
          return { kind: "checkout_url", url: retrieved.url, purchaseId: existing.id };
        }
        // Session is expired, complete-without-a-webhook-yet, or
        // unretrievable — fall through and start a fresh Stripe
        // Checkout Session against the SAME purchase row (never a new
        // DB row) so we don't lose the original clientRequestId link.
      }

      const url = await this.createStripeSessionForExistingPurchase(existing.id, input);
      return { kind: "checkout_url", url, purchaseId: existing.id };
    }

    // Resolve an assessment result / lead if provided, for
    // attribution and later intake prefill — but never require one:
    // a purchase can start from a direct link to /clarity-session.
    let leadId: string | null = null;
    if (input.assessmentResultId) {
      const result = await this.assessmentResultRepository.findById(input.assessmentResultId);
      if (result) {
        const lead = await this.leadRepository.findByAssessmentResultId(input.assessmentResultId);
        leadId = lead?.id ?? null;
      }
    }

    const foundingCount = await this.purchaseRepository.countPaidFoundingPurchases();
    const pricing = computeOfferPricing(foundingCount);

    const purchase = await this.purchaseRepository.createIfNotExists({
      clientRequestId: input.clientRequestId,
      assessmentResultId: input.assessmentResultId ?? null,
      leadId,
      amountMinorUnits: pricing.amountMinorUnits,
      currency: pricing.currency,
      offerVersion: pricing.offerVersion,
      founderPricingApplied: pricing.founderPricingApplied,
      sourceCampaign: input.sourceCampaign ?? null,
    });

    // createIfNotExists is itself idempotent (see PrismaClarityPurchaseRepository) —
    // if a concurrent request just created this row, treat identically
    // to the "existing" branch above.
    if (purchase.stripeCheckoutSessionId) {
      const retrieved = await this.checkoutGateway.retrieveCheckoutSession(
        purchase.stripeCheckoutSessionId
      );
      if (retrieved && retrieved.status === "open" && retrieved.url) {
        return { kind: "checkout_url", url: retrieved.url, purchaseId: purchase.id };
      }
    }

    const url = await this.createStripeSessionForExistingPurchase(purchase.id, input, purchase);
    return { kind: "checkout_url", url, purchaseId: purchase.id };
  }

  private isPaidOrLater(status: string): boolean {
    return ![
      "checkout_created",
      "checkout_cancelled",
      "checkout_expired",
      "payment_failed",
    ].includes(status);
  }

  private async createStripeSessionForExistingPurchase(
    purchaseId: string,
    input: CreateClarityCheckoutInput,
    knownPurchase?: Awaited<ReturnType<ClarityPurchaseRepository["findById"]>>
  ): Promise<string> {
    const purchase = knownPurchase ?? (await this.purchaseRepository.findById(purchaseId));
    if (!purchase) {
      throw new Error(`ClarityPurchase ${purchaseId} not found when creating Stripe session.`);
    }

    const metadata: Record<string, string> = {
      clarityPurchaseId: purchase.id,
      offerVersion: purchase.offerVersion,
    };
    if (purchase.assessmentResultId) metadata.assessmentResultId = purchase.assessmentResultId;
    if (purchase.leadId) metadata.leadId = purchase.leadId;

    const created = await this.checkoutGateway.createCheckoutSession({
      // Include the prior Stripe session id (if any) in the
      // idempotency key so a genuine double-click/network retry
      // before we've persisted a new session id is deduplicated by
      // Stripe, while a LATER retry (e.g. the previous session
      // expired and the customer clicked "book" again) gets a
      // fresh key and a fresh session rather than replaying Stripe's
      // cached (now-stale) response for up to 24h.
      idempotencyKey: purchase.stripeCheckoutSessionId
        ? `${input.clientRequestId}:after:${purchase.stripeCheckoutSessionId}`
        : input.clientRequestId,
      amountMinorUnits: purchase.amountMinorUnits,
      currency: purchase.currency,
      productName: PRODUCT_NAME,
      productDescription: PRODUCT_DESCRIPTION,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata,
    });

    await this.purchaseRepository.attachStripeCheckoutSessionId(
      purchase.id,
      created.stripeCheckoutSessionId
    );
    if (purchase.status !== "checkout_created") {
      await this.purchaseRepository.updateStatus(purchase.id, "checkout_created");
    }

    return created.url;
  }
}
