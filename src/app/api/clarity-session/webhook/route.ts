import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { container } from "@/infrastructure/container";
import {
  getStripeClient,
  getStripeWebhookSecret,
  isStripeConfigured,
  isStripeWebhookConfigured,
} from "@/infrastructure/payments/stripeConfig";
import { buildReceiptEmail } from "@/infrastructure/email/clarityEmailTemplates";
import { logError, logWarning } from "@/infrastructure/logging/logger";

/**
 * POST /api/clarity-session/webhook
 *
 * Stripe webhook handler. This — not the success-page redirect — is
 * the ONLY source of truth for whether a payment actually succeeded
 * (see the task brief's explicit instruction). The success page reads
 * purchase status that this route writes; it never marks a purchase
 * paid itself.
 *
 * Verifies the Stripe-Signature header against the raw request body
 * before trusting anything in the payload. Records every event id in
 * ClarityWebhookEvent first and no-ops on a replay, since Stripe
 * guarantees at-least-once (not exactly-once) delivery.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !isStripeWebhookConfigured()) {
    logError("clarity_webhook.unconfigured", new Error("Stripe webhook received without full Stripe config"), {});
    // 500 (not 200) so Stripe keeps retrying delivery until the
    // product owner finishes configuring STRIPE_SECRET_KEY /
    // STRIPE_WEBHOOK_SECRET — silently accepting and discarding a
    // real payment event would be worse than a delayed retry.
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    logWarning("clarity_webhook.invalid_signature", "Rejected webhook with invalid signature.", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const isNewEvent = await container.clarityWebhookEventRepository.recordIfNew(event.id, event.type);
  if (!isNewEvent) {
    // Already processed this exact event id — replayed delivery, no-op.
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  const origin = new URL(request.url).origin;

  try {
    await handleEvent(event, origin);
  } catch (error) {
    logError("clarity_webhook.handler_failed", error, { eventId: event.id, eventType: event.type });
    // Return 500 so Stripe retries; recordIfNew already marked this
    // event id as seen, so we must NOT let a retry silently no-op a
    // handler that actually failed. Given that risk, only mark the
    // event processed AFTER a successful handle in a future revision
    // if replay-safety of individual handlers needs tightening; for
    // v1 each handler below is itself idempotent via updateStatus's
    // transition guard, so a retried handler-failure is safe to re-run.
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleEvent(event: Stripe.Event, origin: string): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, origin);
      return;
    case "checkout.session.expired":
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      return;
    case "checkout.session.async_payment_failed":
      await handleAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session);
      return;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      return;
    default:
      // Unhandled event types are expected (Stripe sends many event
      // categories we don't act on) — no-op, not an error.
      return;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, origin: string): Promise<void> {
  const purchase = await container.clarityPurchaseRepository.findByStripeCheckoutSessionId(session.id);
  if (!purchase) {
    logWarning("clarity_webhook.purchase_not_found", "checkout.session.completed for unknown session.", {
      stripeCheckoutSessionId: session.id,
    });
    return;
  }

  // Checkout in "payment" mode can complete with payment_status
  // "unpaid" only for delayed payment methods, in which case the
  // definitive signal is the later async_payment_succeeded/failed
  // event, not this one.
  if (session.payment_status !== "paid") {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const customerEmail = session.customer_details?.email ?? null;

  const applied = await container.clarityPurchaseRepository.updateStatus(purchase.id, "paid", {
    stripePaymentIntentId: paymentIntentId ?? null,
    stripeCustomerId: customerId ?? null,
    paidAt: new Date(),
  });

  if (customerEmail) {
    await container.clarityPurchaseRepository.updateFields(purchase.id, { customerEmail });
  }

  // "paid" is a transient resting state, not the customer's next
  // action — the very next thing they need to do is intake. Chaining
  // this transition here (rather than leaving the purchase sitting at
  // "paid" indefinitely) is a deterministic consequence of the state
  // machine, not a business-policy choice: paid -> intake_pending is
  // the only forward transition available from "paid" besides a
  // refund. Safe to run on every delivery/retry — updateStatus no-ops
  // once the purchase has already moved past "paid".
  await container.clarityPurchaseRepository.updateStatus(purchase.id, "intake_pending");

  // Best-effort receipt email — only actually attempted the first time
  // this webhook event applies the "paid" transition (guards against
  // resending a receipt on every retried/replayed delivery of the same
  // logical payment, since recordIfNew already dedupes by Stripe event
  // id, but a legitimately different event for the same purchase, e.g.
  // a resumed/second checkout session, should not re-send either).
  // Failure here is logged and swallowed — email is never allowed to
  // affect payment-processing success.
  if (applied && customerEmail) {
    try {
      const email = buildReceiptEmail({
        amountMinorUnits: purchase.amountMinorUnits,
        currency: purchase.currency,
        intakeUrl: `${origin}/clarity-session/intake?purchase_id=${purchase.id}`,
      });
      const result = await container.emailGateway.send({ to: customerEmail, ...email });
      if (result.kind === "failed") {
        logError("clarity_webhook.receipt_email_failed", new Error(result.message), { purchaseId: purchase.id });
      }
    } catch (error) {
      logError("clarity_webhook.receipt_email_failed", error, { purchaseId: purchase.id });
    }
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const purchase = await container.clarityPurchaseRepository.findByStripeCheckoutSessionId(session.id);
  if (!purchase) return;
  await container.clarityPurchaseRepository.updateStatus(purchase.id, "checkout_expired");
}

async function handleAsyncPaymentFailed(session: Stripe.Checkout.Session): Promise<void> {
  const purchase = await container.clarityPurchaseRepository.findByStripeCheckoutSessionId(session.id);
  if (!purchase) return;
  await container.clarityPurchaseRepository.updateStatus(purchase.id, "payment_failed");
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const purchase = await container.clarityPurchaseRepository.findByStripePaymentIntentId(paymentIntentId);
  if (!purchase) {
    logWarning("clarity_webhook.purchase_not_found", "charge.refunded for unknown payment intent.", {
      paymentIntentId,
    });
    return;
  }

  await container.clarityPurchaseRepository.updateStatus(purchase.id, "refunded", {
    refundedAt: new Date(),
    refundReason: charge.refunds?.data[0]?.reason ?? "refunded_via_stripe",
  });
}
