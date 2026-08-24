import { describe, expect, it } from "vitest";
import {
  canTransition,
  CLARITY_PURCHASE_STATUSES,
  ClarityPurchaseStatus,
} from "@/domain/value-objects/ClarityPurchaseStatus";

describe("canTransition", () => {
  it("allows the normal happy-path chain from checkout to completed", () => {
    const chain: ClarityPurchaseStatus[] = [
      "checkout_created",
      "paid",
      "intake_pending",
      "intake_complete",
      "scheduling_pending",
      "scheduled",
      "delivered",
      "followup_due",
      "completed",
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(canTransition(chain[i], chain[i + 1])).toBe(true);
    }
  });

  it("REQUIRED TEST: a stale checkout.session.completed cannot resurrect a refunded purchase as paid", () => {
    expect(canTransition("refunded", "paid")).toBe(false);
  });

  it("REQUIRED TEST: an out-of-order webhook cannot move a purchase backwards in the funnel", () => {
    expect(canTransition("intake_complete", "paid")).toBe(false);
    expect(canTransition("scheduled", "intake_pending")).toBe(false);
    expect(canTransition("completed", "scheduling_pending")).toBe(false);
  });

  it("treats a same-state transition as an idempotent no-op (replayed webhook)", () => {
    for (const status of CLARITY_PURCHASE_STATUSES) {
      expect(canTransition(status, status)).toBe(true);
    }
  });

  it("allows refund from every non-terminal, already-paid state", () => {
    const refundableFrom: ClarityPurchaseStatus[] = [
      "paid",
      "intake_pending",
      "intake_complete",
      "scheduling_pending",
      "scheduled",
      "delivered",
      "followup_due",
      "completed",
    ];
    for (const status of refundableFrom) {
      expect(canTransition(status, "refunded")).toBe(true);
    }
  });

  it("treats checkout_cancelled, checkout_expired, refunded, and cancelled as terminal (no outgoing transitions)", () => {
    const terminalStates: ClarityPurchaseStatus[] = ["checkout_cancelled", "checkout_expired", "refunded", "cancelled"];
    for (const from of terminalStates) {
      for (const to of CLARITY_PURCHASE_STATUSES) {
        if (to === from) continue;
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it("allows a failed payment to be retried via a fresh checkout", () => {
    expect(canTransition("payment_failed", "checkout_created")).toBe(true);
    expect(canTransition("payment_failed", "paid")).toBe(true);
  });

  it("only allows cancellation from the scheduled state", () => {
    expect(canTransition("scheduled", "cancelled")).toBe(true);
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canTransition("followup_due", "cancelled")).toBe(false);
  });
});
