import { LeadRepository } from "@/domain/repositories/LeadRepository";
import { Lead, SavedLead } from "@/domain/entities/Lead";
import { prisma } from "@/infrastructure/db/prisma";

/**
 * Adapter: persists captured leads via Prisma/Postgres, including the
 * consent timestamp and privacy-policy version recorded at capture time.
 */
export class PrismaLeadRepository implements LeadRepository {
  async save(lead: Lead): Promise<SavedLead> {
    const saved = await prisma.lead.create({
      data: {
        firstName: lead.firstName,
        email: lead.email,
        company: lead.company,
        assessmentResultId: lead.assessmentResultId,
        consentTimestamp: lead.consentTimestamp,
        consentPolicyVersion: lead.consentPolicyVersion,
      },
    });

    return {
      id: saved.id,
      firstName: saved.firstName,
      email: saved.email,
      company: saved.company,
      assessmentResultId: saved.assessmentResultId,
      consentTimestamp: saved.consentTimestamp,
      consentPolicyVersion: saved.consentPolicyVersion,
      createdAt: saved.createdAt,
    };
  }
}
