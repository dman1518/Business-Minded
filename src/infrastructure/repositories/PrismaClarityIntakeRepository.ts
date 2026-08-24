import { Prisma } from "@prisma/client";
import {
  ClarityIntakeRepository,
  UpsertClarityIntakeInput,
} from "@/domain/repositories/ClarityIntakeRepository";
import { ClarityIntake, ClarityIntakeAnswers } from "@/domain/entities/ClarityIntake";
import { prisma } from "@/infrastructure/db/prisma";

type PrismaClarityIntakeRecord = {
  id: string;
  purchaseId: string;
  answers: unknown;
  status: string;
  submittedAt: Date | null;
  consentTimestamp: Date | null;
  consentPolicyVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaClarityIntakeRepository implements ClarityIntakeRepository {
  async findByPurchaseId(purchaseId: string): Promise<ClarityIntake | null> {
    const record = await prisma.clarityIntake.findUnique({ where: { purchaseId } });
    return record ? this.toDomain(record) : null;
  }

  async upsertSubmitted(input: UpsertClarityIntakeInput): Promise<ClarityIntake> {
    // Prisma's generated type for a Json column (InputJsonValue) requires
    // an index signature that our specific, Zod-validated ClarityIntakeAnswers
    // interface doesn't structurally have. The cast is safe: input.answers
    // has already passed SubmitClarityIntakeSchema validation, so it is
    // guaranteed to be a plain JSON-serializable object at this point.
    const answersJson = input.answers as unknown as Prisma.InputJsonValue;

    const record = await prisma.clarityIntake.upsert({
      where: { purchaseId: input.purchaseId },
      create: {
        purchaseId: input.purchaseId,
        answers: answersJson,
        status: "submitted",
        submittedAt: new Date(),
        consentTimestamp: input.consentTimestamp,
        consentPolicyVersion: input.consentPolicyVersion,
      },
      update: {
        answers: answersJson,
        status: "submitted",
        submittedAt: new Date(),
        consentTimestamp: input.consentTimestamp,
        consentPolicyVersion: input.consentPolicyVersion,
      },
    });
    return this.toDomain(record);
  }

  private toDomain(record: PrismaClarityIntakeRecord): ClarityIntake {
    return {
      id: record.id,
      purchaseId: record.purchaseId,
      answers: record.answers as ClarityIntakeAnswers,
      status: record.status as ClarityIntake["status"],
      submittedAt: record.submittedAt,
      consentTimestamp: record.consentTimestamp,
      consentPolicyVersion: record.consentPolicyVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
