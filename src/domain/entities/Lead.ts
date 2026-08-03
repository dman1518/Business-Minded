/**
 * Domain entity: Lead.
 * The contact captured in exchange for the Business Health Check report.
 */
export interface Lead {
  firstName: string;
  email: string;
  company: string;
  assessmentResultId: string;
}

export interface SavedLead extends Lead {
  id: string;
  createdAt: Date;
}
