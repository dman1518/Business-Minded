import {
  ClarityCheckoutGateway,
  CreateCheckoutSessionInput,
  CreatedCheckoutSession,
  RetrievedCheckoutSession,
} from "@/domain/repositories/ClarityCheckoutGateway";
import { getStripeClient } from "@/infrastructure/payments/stripeConfig";

/**
 * Adapter: Stripe Checkout implementation of ClarityCheckoutGateway.
 *
 * Uses inline `price_data` (a server-computed amount/currency/product
 * name passed directly into `checkout.sessions.create`) rather than a
 * pre-created Stripe Price object. This sandbox has no network access
 * to create test-mode Stripe objects ahead of time, and inline
 * price_data is fully server-authoritative and works identically in
 * test and live mode without any pre-provisioning step — the browser
 * never supplies or influences the amount charged.
 */
export class StripeCheckoutGateway implements ClarityCheckoutGateway {
  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreatedCheckoutSession> {
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency,
              unit_amount: input.amountMinorUnits,
              product_data: {
                name: input.productName,
                description: input.productDescription,
              },
            },
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
        // Also stamped onto the resulting PaymentIntent so refund/
        // dispute tooling in the Stripe Dashboard shows the same
        // identifiers without needing to look up the Checkout Session.
        payment_intent_data: {
          metadata: input.metadata,
        },
      },
      { idempotencyKey: input.idempotencyKey }
    );

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout Session URL.");
    }

    return { stripeCheckoutSessionId: session.id, url: session.url };
  }

  async retrieveCheckoutSession(
    stripeCheckoutSessionId: string
  ): Promise<RetrievedCheckoutSession | null> {
    const stripe = getStripeClient();
    try {
      const session = await stripe.checkout.sessions.retrieve(stripeCheckoutSessionId);
      const status: RetrievedCheckoutSession["status"] =
        session.status === "complete" ? "complete" : session.status === "expired" ? "expired" : "open";

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      const customerId =
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);

      return { status, url: session.url, paymentIntentId, customerId };
    } catch {
      return null;
    }
  }
}
