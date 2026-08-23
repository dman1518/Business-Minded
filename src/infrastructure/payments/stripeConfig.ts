import Stripe from "stripe";

/**
 * Lazy, safe accessors for Stripe configuration.
 *
 * Deliberately does NOT throw at module load / server startup when
 * unconfigured — Stripe env vars are legitimately absent until the
 * product owner adds them (see `.env.example`), and the rest of the
 * app (free assessment, report, etc.) must keep working regardless.
 * Callers that actually need Stripe (the checkout route) check
 * `isStripeConfigured()` first and return a clear "payments
 * temporarily unavailable" response rather than crashing or, worse,
 * silently pretending a payment succeeded. See the task brief's
 * explicit instruction: "never simulate successful payment behavior
 * when a real integration is missing."
 */

let cachedClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

/** Throws if called without STRIPE_SECRET_KEY set — callers must check isStripeConfigured() first. */
export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  if (!cachedClient) {
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-07-29.dahlia",
    });
  }
  return cachedClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }
  return secret;
}
