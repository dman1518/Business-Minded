/**
 * Domain entity: Lead.
 * The contact captured in exchange for the Business Health Check report.
 *
 * `consentTimestamp` and `consentPolicyVersion` record that the person
 * agreed to the privacy policy at capture time, and which version of
 * that policy they agreed to — required before a lead can be saved.
 */
export interface Lead {
  firstName: string;
  email: string;
  company: string;
  assessmentResultId: string;
  consentTimestamp: Date;
  consentPolicyVersion: string;
}

export interface SavedLead extends Lead {
  id: string;
  createdAt: Date;
}
