import { Lead, SavedLead } from "../entities/Lead";

/**
 * Port: persists captured leads.
 * Sprint 1 implementation is backed by Postgres via Prisma.
 */
export interface LeadRepository {
  save(lead: Lead): Promise<SavedLead>;
}
