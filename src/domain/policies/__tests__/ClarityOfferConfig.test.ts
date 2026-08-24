import { describe, expect, it } from "vitest";
import {
  computeOfferPricing,
  foundingPriceBadgeCopy,
  FOUNDING_CLIENT_LIMIT,
  FOUNDING_PRICE_MINOR_UNITS,
  STANDARD_PRICE_MINOR_UNITS,
} from "@/domain/policies/ClarityOfferConfig";

describe("computeOfferPricing", () => {
  it("charges the founding price with 0 paid founding purchases so far", () => {
    const pricing = computeOfferPricing(0);
    expect(pricing.founderPricingApplied).toBe(true);
    expect(pricing.amountMinorUnits).toBe(FOUNDING_PRICE_MINOR_UNITS);
    expect(pricing.foundingSpotsRemaining).toBe(FOUNDING_CLIENT_LIMIT);
  });

  it("still charges the founding price on the very last spot (9 of 10 taken)", () => {
    const pricing = computeOfferPricing(FOUNDING_CLIENT_LIMIT - 1);
    expect(pricing.founderPricingApplied).toBe(true);
    expect(pricing.amountMinorUnits).toBe(FOUNDING_PRICE_MINOR_UNITS);
    expect(pricing.foundingSpotsRemaining).toBe(1);
  });

  it("REQUIRED TEST: switches to standard pricing exactly once the limit is reached", () => {
    const pricing = computeOfferPricing(FOUNDING_CLIENT_LIMIT);
    expect(pricing.founderPricingApplied).toBe(false);
    expect(pricing.amountMinorUnits).toBe(STANDARD_PRICE_MINOR_UNITS);
    expect(pricing.foundingSpotsRemaining).toBeNull();
  });

  it("charges standard pricing when the count has gone past the limit", () => {
    const pricing = computeOfferPricing(FOUNDING_CLIENT_LIMIT + 5);
    expect(pricing.founderPricingApplied).toBe(false);
    expect(pricing.amountMinorUnits).toBe(STANDARD_PRICE_MINOR_UNITS);
  });

  it("never returns a negative or zero foundingSpotsRemaining while founder pricing still applies", () => {
    for (let count = 0; count < FOUNDING_CLIENT_LIMIT; count++) {
      const pricing = computeOfferPricing(count);
      expect(pricing.foundingSpotsRemaining).toBeGreaterThan(0);
    }
  });
});

describe("foundingPriceBadgeCopy", () => {
  it("states an exact, real spot count while founding pricing is active", () => {
    const copy = foundingPriceBadgeCopy(computeOfferPricing(3));
    expect(copy).toContain("7");
    expect(copy).toContain(String(FOUNDING_CLIENT_LIMIT));
  });

  it("never claims a numeric spot count once founding pricing has ended", () => {
    const copy = foundingPriceBadgeCopy(computeOfferPricing(FOUNDING_CLIENT_LIMIT));
    expect(copy).not.toMatch(/\d+ of \d+/);
    expect(copy.toLowerCase()).toContain("ended");
  });
});
