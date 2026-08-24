import { describe, expect, it } from "vitest";
import { UpdateClarityFulfillment } from "@/application/use-cases/UpdateClarityFulfillment";
import {
  ClarityPurchaseRepository,
  ClarityPurchaseFieldUpdates,
  CreateClarityPurchaseInput,
} from "@/domain/repositories/ClarityPurchaseRepository";
import { ClarityPurchase } from "@/domain/entities/ClarityPurchase";
import { ClarityPurchaseStatus, canTransition } from "@/domain/value-objects/ClarityPurchaseStatus";

function buildPurchase(overrides: Partial<ClarityPurchase> = {}): ClarityPurchase {
  return {
    id: "purchase-1",
    assessmentResultId: null,
    leadId: null,
    clientRequestId: "client-1",
    stripeCheckoutSessionId: "cs_1",
    stripePaymentIntentId: null,
    stripeCustomerId: null,
    customerEmail: "customer@example.com",
    amountMinorUnits: 29_700,
    currency: "usd",
    offerVersion: "clarity-session-v1",
    founderPricingApplied: true,
    status: "scheduling_pending",
    sourceCampaign: null,
    paidAt: new Date("2026-01-01"),
    refundedAt: null,
    refundReason: null,
    intakeStatus: "complete",
    schedulingStatus: "link_sent",
    scheduledAt: null,
    planDeliveredAt: null,
    followUpDueAt: null,
    followUpDoneAt: null,
    internalNotes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function buildFakePurchaseRepository(
  initial: ClarityPurchase[]
): ClarityPurchaseRepository & { get(id: string): ClarityPurchase | undefined } {
  const byId = new Map(initial.map((p) => [p.id, p]));
  return {
    get: (id) => byId.get(id),
    async createIfNotExists(input: CreateClarityPurchaseInput) {
      throw new Error("not used in this test: " + input.clientRequestId);
    },
    async findByClientRequestId() {
      return null;
    },
    async findByStripeCheckoutSessionId() {
      return null;
    },
    async findByStripePaymentIntentId() {
      return null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async attachStripeCheckoutSessionId() {
      /* not used in this test */
    },
    async updateStatus(id, to: ClarityPurchaseStatus, extra) {
      const current = byId.get(id);
      if (!current) return false;
      if (!canTransition(current.status, to)) return false;
      if (current.status === to) return true;
      byId.set(id, { ...current, status: to, ...extra });
      return true;
    },
    async updateFields(id, fields: ClarityPurchaseFieldUpdates) {
      const current = byId.get(id);
      if (!current) return;
      byId.set(id, { ...current, ...fields });
    },
    async listForFulfillment() {
      return [...byId.values()];
    },
    async countPaidFoundingPurchases() {
      return 0;
    },
  };
}

describe("UpdateClarityFulfillment", () => {
  it("marks a purchase scheduled, sets scheduledAt and schedulingStatus", async () => {
    const repository = buildFakePurchaseRepository([buildPurchase({ status: "scheduling_pending" })]);
    const useCase = new UpdateClarityFulfillment(repository);

    const result = await useCase.execute("purchase-1", {
      kind: "set_status",
      to: "scheduled",
      scheduledAt: "2026-02-01T15:00:00.000Z",
    });

    expect(result).toEqual({ ok: true });
    const purchase = repository.get("purchase-1");
    expect(purchase?.status).toBe("scheduled");
    expect(purchase?.schedulingStatus).toBe("scheduled");
    expect(purchase?.scheduledAt?.toISOString()).toBe("2026-02-01T15:00:00.000Z");
  });

  it("REQUIRED TEST: refuses an out-of-order admin action the state machine doesn't allow", async () => {
    const repository = buildFakePurchaseRepository([buildPurchase({ status: "scheduling_pending" })]);
    const useCase = new UpdateClarityFulfillment(repository);

    // Can't jump straight to "delivered" without going through "scheduled" first.
    const result = await useCase.execute("purchase-1", { kind: "set_status", to: "delivered" });

    expect(result.ok).toBe(false);
    expect(repository.get("purchase-1")?.status).toBe("scheduling_pending");
  });

  it("returns an error for an unknown purchase id rather than throwing", async () => {
    const repository = buildFakePurchaseRepository([]);
    const useCase = new UpdateClarityFulfillment(repository);

    const result = await useCase.execute("does-not-exist", { kind: "set_notes", notes: "hello" });

    expect(result).toEqual({ ok: false, error: "Purchase not found." });
  });

  it("updates internal notes without touching status", async () => {
    const repository = buildFakePurchaseRepository([buildPurchase({ status: "scheduled" })]);
    const useCase = new UpdateClarityFulfillment(repository);

    const result = await useCase.execute("purchase-1", { kind: "set_notes", notes: "Called, left voicemail." });

    expect(result).toEqual({ ok: true });
    const purchase = repository.get("purchase-1");
    expect(purchase?.internalNotes).toBe("Called, left voicemail.");
    expect(purchase?.status).toBe("scheduled");
  });

  it("walks the full manual chain: scheduled -> delivered -> followup_due -> completed", async () => {
    const repository = buildFakePurchaseRepository([buildPurchase({ status: "scheduled" })]);
    const useCase = new UpdateClarityFulfillment(repository);

    expect((await useCase.execute("purchase-1", { kind: "set_status", to: "delivered" })).ok).toBe(true);
    expect((await useCase.execute("purchase-1", { kind: "set_status", to: "followup_due", followUpDueAt: "2026-02-08T15:00:00.000Z" })).ok).toBe(true);
    expect((await useCase.execute("purchase-1", { kind: "set_status", to: "completed" })).ok).toBe(true);

    const purchase = repository.get("purchase-1");
    expect(purchase?.status).toBe("completed");
    expect(purchase?.planDeliveredAt).toBeInstanceOf(Date);
    expect(purchase?.followUpDoneAt).toBeInstanceOf(Date);
  });
});
