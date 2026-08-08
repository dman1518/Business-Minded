import { LeadRepository } from "@/domain/repositories/LeadRepository";
import { Lead, SavedLead } from "@/domain/entities/Lead";
import { prisma } from "@/infrastructure/db/prisma";

/**
 * Adapter: persists captured leads via Prisma/Postgres, including the
 * required report-delivery consent record and the separate, optional
 * marketing-consent timestamp, all recorded at capture time.
 */
export class PrismaLeadRepository implements LeadRepository {
  async save(lead: Lead): Promise<SavedLead> {
    const saved = await prisma.lead.create({
      data: {
        firstName: lead.firstName,
        email: lead.email,
        company: lead.company,
        website: lead.website,
        assessmentResultId: lead.assessmentResultId,
        consentTimestamp: lead.consentTimestamp,
        consentPolicyVersion: lead.consentPolicyVersion,
        marketingConsentAt: lead.marketingConsentAt,
      },
    });

    return {
      id: saved.id,
      firstName: saved.firstName,
      email: saved.email,
      company: saved.company ?? undefined,
      website: saved.website ?? undefined,
      assessmentResultId: saved.assessmentResultId,
      consentTimestamp: saved.consentTimestamp,
      consentPolicyVersion: saved.consentPolicyVersion,
      marketingConsentAt: saved.marketingConsentAt ?? undefined,
      createdAt: saved.createdAt,
    };
  }
}
