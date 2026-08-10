import { LeadRepository } from "@/domain/repositories/LeadRepository";
import { Lead, SavedLead } from "@/domain/entities/Lead";
import { prisma } from "@/infrastructure/db/prisma";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * True for a Prisma unique-constraint violation (error code P2002).
 * Checked structurally (duck-typed) instead of via
 * `instanceof Prisma.PrismaClientKnownRequestError` so this file
 * doesn't depend on the exact shape of the generated Prisma namespace
 * — Prisma error objects reliably carry a string `.code` at runtime
 * regardless of how the client happens to be generated.
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

/**
 * Adapter: persists captured leads via Prisma/Postgres, including the
 * three separately-tracked consent purposes (required report-delivery
 * consent, optional results-follow-up consent, optional marketing
 * consent), all recorded at capture time.
 *
 * `assessmentResultId` has a unique DB constraint (see
 * prisma/schema.prisma), which is what actually guarantees at most one
 * lead per assessment result under concurrent requests. `save()` makes
 * that constraint idempotent from the CALLER's perspective too: a
 * retried or double-clicked submission for an assessment result that
 * already has a lead returns the EXISTING lead rather than throwing an
 * error the UI would have to show as a failure.
 */
export class PrismaLeadRepository implements LeadRepository {
  async save(lead: Lead): Promise<SavedLead> {
    try {
      const saved = await prisma.lead.create({
        data: {
          firstName: lead.firstName,
          email: lead.email,
          company: lead.company,
          website: lead.website,
          assessmentResultId: lead.assessmentResultId,
          consentTimestamp: lead.consentTimestamp,
          consentPolicyVersion: lead.consentPolicyVersion,
          resultsFollowUpConsentAt: lead.resultsFollowUpConsentAt,
          marketingConsentAt: lead.marketingConsentAt,
        },
      });

      return this.toDomain(saved);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        // Another request already created a lead for this assessment
        // result (e.g. a double-submit or retried request) — treat as
        // success and return the existing record instead of erroring.
        const existing = await this.findByAssessmentResultId(lead.assessmentResultId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async findByAssessmentResultId(assessmentResultId: string): Promise<SavedLead | null> {
    const record = await prisma.lead.findUnique({ where: { assessmentResultId } });
    return record ? this.toDomain(record) : null;
  }

  private toDomain(record: {
    id: string;
    firstName: string;
    email: string;
    company: string | null;
    website: string | null;
    assessmentResultId: string;
    consentTimestamp: Date;
    consentPolicyVersion: string;
    resultsFollowUpConsentAt: Date | null;
    marketingConsentAt: Date | null;
    createdAt: Date;
  }): SavedLead {
    return {
      id: record.id,
      firstName: record.firstName,
      email: record.email,
      company: record.company ?? undefined,
      website: record.website ?? undefined,
      assessmentResultId: record.assessmentResultId,
      consentTimestamp: record.consentTimestamp,
      consentPolicyVersion: record.consentPolicyVersion,
      resultsFollowUpConsentAt: record.resultsFollowUpConsentAt ?? undefined,
      marketingConsentAt: record.marketingConsentAt ?? undefined,
      createdAt: record.createdAt,
    };
  }
}
