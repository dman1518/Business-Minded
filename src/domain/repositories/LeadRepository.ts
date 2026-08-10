import { Lead, SavedLead } from "../entities/Lead";

/**
 * Port: persists captured leads.
 * Sprint 1 implementation is backed by Postgres via Prisma.
 */
export interface LeadRepository {
  /**
   * Saves a lead. Implementations MUST be idempotent per
   * assessmentResultId — a lead capture retried by a flaky network or
   * a duplicated click must never create two leads for the same
   * assessment result. When a lead already exists for the given
   * assessmentResultId, implementations should return the EXISTING
   * saved lead rather than erroring or creating a duplicate.
   */
  save(lead: Lead): Promise<SavedLead>;
  findByAssessmentResultId(assessmentResultId: string): Promise<SavedLead | null>;
}
