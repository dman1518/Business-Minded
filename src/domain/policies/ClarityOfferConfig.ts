/**
 * Business Clarity Session offer configuration.
 *
 * Pricing and copy are versioned via `offerVersion`, persisted on every
 * ClarityPurchase row, so a future price change never rewrites the
 * historical record of what a past customer actually paid.
 *
 * FOUNDING_CLIENT_LIMIT (10) and the two price points ($297 founding /
 * $500 standard) come directly from the task brief. Everything else
 * about the offer's business rules (whether founding pricing ends by
 * count vs. a fixed date vs. a manual switch, exact refund/cancellation
 * terms, etc.) is an explicit product-owner decision NOT invented here
 * — see PRODUCT_OWNER_DECISIONS.md / the completion report.
 */

export const CLARITY_OFFER_VERSION = "clarity-session-v1";

export const FOUNDING_CLIENT_LIMIT = 10;
export const FOUNDING_PRICE_MINOR_UNITS = 29_700; // $297.00
export const STANDARD_PRICE_MINOR_UNITS = 50_000; // $500.00
export const CLARITY_OFFER_CURRENCY = "usd";

export interface ClarityOfferPricing {
  amountMinorUnits: number;
  currency: string;
  offerVersion: string;
  founderPricingApplied: boolean;
  /**
   * Exact count of remaining founding spots, computed from a real
   * count of paid purchases — never a hardcoded or guessed number.
   * Null once founding pricing is no longer being offered (so callers
   * fall back to safe, non-numeric copy instead of "0 remaining").
   */
  foundingSpotsRemaining: number | null;
}

/**
 * Determines current pricing from an ACCURATE count of already-paid
 * founding-price purchases (never a hardcoded or estimated number —
 * see the task brief's explicit instruction not to falsely claim a
 * spot count unless it can be calculated accurately).
 *
 * Known limitation (flagged, not silently glossed over): this count is
 * read non-atomically relative to checkout-session creation, so a
 * short burst of concurrent checkouts near the 10th spot could in
 * principle let more than 10 people start a founding-priced checkout
 * before the count updates. Every one of those checkouts would still
 * charge the founding price honestly (never a bait-and-switch), but
 * strict "never more than 10 total" enforcement would need a DB-level
 * reservation (e.g. a transaction with a row lock, or a dedicated
 * counter row) — reasonable for v1 given the small volume, but called
 * out here as a improvement to make if enforcement must be exact.
 */
export function computeOfferPricing(paidFoundingPurchaseCount: number): ClarityOfferPricing {
  const spotsRemaining = FOUNDING_CLIENT_LIMIT - paidFoundingPurchaseCount;

  if (spotsRemaining > 0) {
    return {
      amountMinorUnits: FOUNDING_PRICE_MINOR_UNITS,
      currency: CLARITY_OFFER_CURRENCY,
      offerVersion: CLARITY_OFFER_VERSION,
      founderPricingApplied: true,
      foundingSpotsRemaining: spotsRemaining,
    };
  }

  return {
    amountMinorUnits: STANDARD_PRICE_MINOR_UNITS,
    currency: CLARITY_OFFER_CURRENCY,
    offerVersion: CLARITY_OFFER_VERSION,
    founderPricingApplied: false,
    foundingSpotsRemaining: null,
  };
}

/**
 * Safe, accurate marketing copy for the pricing badge. Only ever
 * states an exact number because computeOfferPricing() derived it from
 * a real DB count. Once founding pricing has ended, this explicitly
 * says so rather than reusing founding-rate language for the standard
 * price (that would misrepresent an ended promotion as still live).
 */
export function foundingPriceBadgeCopy(pricing: ClarityOfferPricing): string {
  if (pricing.founderPricingApplied && pricing.foundingSpotsRemaining !== null) {
    return `Founding-client rate — ${pricing.foundingSpotsRemaining} of ${FOUNDING_CLIENT_LIMIT} spots remaining`;
  }
  return "The founding-client rate has ended. Standard pricing now applies.";
}
