import {
  ClarityPurchaseRepository,
  CreateClarityPurchaseInput,
} from "@/domain/repositories/ClarityPurchaseRepository";
import { ClarityPurchase, SourceCampaign } from "@/domain/entities/ClarityPurchase";
import {
  ClarityPurchaseStatus,
  canTransition,
} from "@/domain/value-objects/ClarityPurchaseStatus";
import { prisma } from "@/infrastructure/db/prisma";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

type PrismaClarityPurchaseRecord = {
  id: string;
  assessmentResultId: string | null;
  leadId: string | null;
  clientRequestId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  amountMinorUnits: number;
  currency: string;
  offerVersion: string;
  founderPricingApplied: boolean;
  status: string;
  sourceCampaign: unknown;
  paidAt: Date | null;
  refundedAt: Date | null;
  refundReason: string | null;
  intakeStatus: string;
  schedulingStatus: string;
  scheduledAt: Date | null;
  planDeliveredAt: Date | null;
  followUpDueAt: Date | null;
  followUpDoneAt: Date | null;
  internalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Adapter: persists Business Clarity Session purchases via
 * Prisma/Postgres. See ClarityPurchaseRepository for the idempotency
 * and status-transition contracts this implementation must uphold.
 */
export class PrismaClarityPurchaseRepository implements ClarityPurchaseRepository {
  async createIfNotExists(input: CreateClarityPurchaseInput): Promise<ClarityPurchase> {
    try {
      const created = await prisma.clarityPurchase.create({
        data: {
          clientRequestId: input.clientRequestId,
          assessmentResultId: input.assessmentResultId,
          leadId: input.leadId,
          amountMinorUnits: input.amountMinorUnits,
          currency: input.currency,
          offerVersion: input.offerVersion,
          founderPricingApplied: input.founderPricingApplied,
          sourceCampaign: input.sourceCampaign ?? undefined,
        },
      });
      return this.toDomain(created);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        const existing = await this.findByClientRequestId(input.clientRequestId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async findByClientRequestId(clientRequestId: string): Promise<ClarityPurchase | null> {
    const record = await prisma.clarityPurchase.findUnique({ where: { clientRequestId } });
    return record ? this.toDomain(record) : null;
  }

  async findByStripeCheckoutSessionId(
    stripeCheckoutSessionId: string
  ): Promise<ClarityPurchase | null> {
    const record = await prisma.clarityPurchase.findUnique({
      where: { stripeCheckoutSessionId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByStripePaymentIntentId(
    stripePaymentIntentId: string
  ): Promise<ClarityPurchase | null> {
    const record = await prisma.clarityPurchase.findUnique({
      where: { stripePaymentIntentId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findById(id: string): Promise<ClarityPurchase | null> {
    const record = await prisma.clarityPurchase.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async attachStripeCheckoutSessionId(
    id: string,
    stripeCheckoutSessionId: string
  ): Promise<void> {
    await prisma.clarityPurchase.update({
      where: { id },
      data: { stripeCheckoutSessionId },
    });
  }

  async updateStatus(
    id: string,
    to: ClarityPurchaseStatus,
    extra?: Partial<{
      stripePaymentIntentId: string | null;
      stripeCustomerId: string | null;
      paidAt: Date | null;
      refundedAt: Date | null;
      refundReason: string | null;
      scheduledAt: Date | null;
      planDeliveredAt: Date | null;
      followUpDueAt: Date | null;
      followUpDoneAt: Date | null;
    }>
  ): Promise<boolean> {
    const current = await prisma.clarityPurchase.findUnique({ where: { id } });
    if (!current) return false;

    const from = current.status as ClarityPurchaseStatus;
    if (!canTransition(from, to)) return false;
    if (from === to) return true; // idempotent no-op for a replayed webhook

    await prisma.clarityPurchase.update({
      where: { id },
      data: { status: to, ...extra },
    });
    return true;
  }

  async listForFulfillment(): Promise<ClarityPurchase[]> {
    const records = await prisma.clarityPurchase.findMany({
      orderBy: { createdAt: "desc" },
    });
    return records.map((r: PrismaClarityPurchaseRecord) => this.toDomain(r));
  }

  async countPaidFoundingPurchases(): Promise<number> {
    return prisma.clarityPurchase.count({
      where: { founderPricingApplied: true, paidAt: { not: null } },
    });
  }

  private toDomain(record: PrismaClarityPurchaseRecord): ClarityPurchase {
    return {
      id: record.id,
      assessmentResultId: record.assessmentResultId,
      leadId: record.leadId,
      clientRequestId: record.clientRequestId,
      stripeCheckoutSessionId: record.stripeCheckoutSessionId,
      stripePaymentIntentId: record.stripePaymentIntentId,
      stripeCustomerId: record.stripeCustomerId,
      amountMinorUnits: record.amountMinorUnits,
      currency: record.currency,
      offerVersion: record.offerVersion,
      founderPricingApplied: record.founderPricingApplied,
      status: record.status as ClarityPurchaseStatus,
      sourceCampaign: (record.sourceCampaign as SourceCampaign | null) ?? null,
      paidAt: record.paidAt,
      refundedAt: record.refundedAt,
      refundReason: record.refundReason,
      intakeStatus: record.intakeStatus as ClarityPurchase["intakeStatus"],
      schedulingStatus: record.schedulingStatus as ClarityPurchase["schedulingStatus"],
      scheduledAt: record.scheduledAt,
      planDeliveredAt: record.planDeliveredAt,
      followUpDueAt: record.followUpDueAt,
      followUpDoneAt: record.followUpDoneAt,
      internalNotes: record.internalNotes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
