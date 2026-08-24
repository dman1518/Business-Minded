import { describe, expect, it } from "vitest";
import { SubmitClarityIntake } from "@/application/use-cases/SubmitClarityIntake";
import {
  ClarityPurchaseRepository,
  ClarityPurchaseFieldUpdates,
  CreateClarityPurchaseInput,
} from "@/domain/repositories/ClarityPurchaseRepository";
import { ClarityIntakeRepository, UpsertClarityIntakeInput } from "@/domain/repositories/ClarityIntakeRepository";
import { ClarityPurchase } from "@/domain/entities/ClarityPurchase";
import { ClarityIntake, ClarityIntakeAnswers } from "@/domain/entities/ClarityIntake";
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
    status: "intake_pending",
    sourceCampaign: null,
    paidAt: new Date("2026-01-01"),
    refundedAt: null,
    refundReason: null,
    intakeStatus: "not_started",
    schedulingStatus: "not_started",
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

/** In-memory fake mirroring the real Prisma adapter's contracts (state-machine-guarded updateStatus, etc.). */
function buildFakePurchaseRepository(initial: ClarityPurchase[]): ClarityPurchaseRepository & { get(id: string): ClarityPurchase | undefined } {
  const byId = new Map(initial.map((p) => [p.id, p]));
  return {
    get: (id) => byId.get(id),
    async createIfNotExists(input: CreateClarityPurchaseInput) {
      throw new Error("not used in this test: " + input.clientRequestId);
    },
    async findByClientRequestId(clientRequestId) {
      return [...byId.values()].find((p) => p.clientRequestId === clientRequestId) ?? null;
    },
    async findByStripeCheckoutSessionId(id) {
      return [...byId.values()].find((p) => p.stripeCheckoutSessionId === id) ?? null;
    },
    async findByStripePaymentIntentId(id) {
      return [...byId.values()].find((p) => p.stripePaymentIntentId === id) ?? null;
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
      return [...byId.values()].filter((p) => p.founderPricingApplied && p.paidAt).length;
    },
  };
}

function buildFakeIntakeRepository(): ClarityIntakeRepository & { upsertCallCount: number; lastInput?: UpsertClarityIntakeInput } {
  const state: { upsertCallCount: number; lastInput?: UpsertClarityIntakeInput; byPurchaseId: Map<string, ClarityIntake> } = {
    upsertCallCount: 0,
    byPurchaseId: new Map(),
  };
  return {
    get upsertCallCount() {
      return state.upsertCallCount;
    },
    get lastInput() {
      return state.lastInput;
    },
    async findByPurchaseId(purchaseId) {
      return state.byPurchaseId.get(purchaseId) ?? null;
    },
    async upsertSubmitted(input: UpsertClarityIntakeInput) {
      state.upsertCallCount += 1;
      state.lastInput = input;
      const saved: ClarityIntake = {
        id: "intake-1",
        purchaseId: input.purchaseId,
        answers: input.answers,
        status: "submitted",
        submittedAt: new Date("2026-01-01"),
        consentTimestamp: input.consentTimestamp,
        consentPolicyVersion: input.consentPolicyVersion,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      };
      state.byPurchaseId.set(input.purchaseId, saved);
      return saved;
    },
  };
}

function fakeAnswers(): ClarityIntakeAnswers {
  return {
    businessDescription: "We sell widgets.",
    primaryCustomer: "Small manufacturers.",
    approxAnnualRevenue: "$250K–$1M",
    teamSize: "2–5",
    mostUrgentProblem: "Too much owner dependence.",
    ninetyDayOutcome: "A repeatable sales process.",
    whatYouveAlreadyTried: "Nothing yet",
    metricsCurrentlyTracked: "None yet",
    implementationBlockers: "Nothing specific",
    approvalNeededFromOthers: false,
    isOwnerOrDecisionMaker: true,
    readyToActWithinThirtyDays: true,
    otherAttendees: null,
  };
}

describe("SubmitClarityIntake", () => {
  it("REQUIRED TEST: rejects intake for a purchase that hasn't reached intake_pending (payment not yet verified)", async () => {
    const purchaseRepository = buildFakePurchaseRepository([buildPurchase({ status: "checkout_created" })]);
    const intakeRepository = buildFakeIntakeRepository();
    const useCase = new SubmitClarityIntake(purchaseRepository, intakeRepository);

    const result = await useCase.execute({ purchaseId: "purchase-1", answers: fakeAnswers() });

    expect(result).toEqual({ kind: "not_paid" });
    expect(intakeRepository.upsertCallCount).toBe(0);
  });

  it("returns not_found for an unknown purchase id", async () => {
    const purchaseRepository = buildFakePurchaseRepository([]);
    const intakeRepository = buildFakeIntakeRepository();
    const useCase = new SubmitClarityIntake(purchaseRepository, intakeRepository);

    const result = await useCase.execute({ purchaseId: "does-not-exist", answers: fakeAnswers() });

    expect(result).toEqual({ kind: "not_found" });
  });

  it("REQUIRED TEST: on first submission, persists intakeStatus=complete and advances status to scheduling_pending", async () => {
    const purchaseRepository = buildFakePurchaseRepository([buildPurchase({ status: "intake_pending" })]);
    const intakeRepository = buildFakeIntakeRepository();
    const useCase = new SubmitClarityIntake(purchaseRepository, intakeRepository);

    const result = await useCase.execute({ purchaseId: "purchase-1", answers: fakeAnswers() });

    expect(result).toEqual({ kind: "submitted" });
    const purchase = purchaseRepository.get("purchase-1");
    expect(purchase?.intakeStatus).toBe("complete");
    expect(purchase?.status).toBe("scheduling_pending");
    expect(intakeRepository.upsertCallCount).toBe(1);
  });

  it("allows a resubmission (already past intake_pending) without moving status backwards", async () => {
    const purchaseRepository = buildFakePurchaseRepository([
      buildPurchase({ status: "scheduling_pending", intakeStatus: "complete" }),
    ]);
    const intakeRepository = buildFakeIntakeRepository();
    const useCase = new SubmitClarityIntake(purchaseRepository, intakeRepository);

    const result = await useCase.execute({ purchaseId: "purchase-1", answers: fakeAnswers() });

    expect(result).toEqual({ kind: "submitted" });
    expect(purchaseRepository.get("purchase-1")?.status).toBe("scheduling_pending");
    expect(intakeRepository.upsertCallCount).toBe(1);
  });
});
