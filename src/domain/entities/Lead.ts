/**
 * Domain entity: Lead.
 * The contact captured in exchange for the Business Health Check report.
 *
 * Only `firstName` and `email` are required — `company` and `website`
 * are optional context the respondent may choose to share.
 *
 * `consentTimestamp` and `consentPolicyVersion` record that the person
 * agreed to the privacy policy and consented to receive their report at
 * capture time, and which version of that policy they agreed to —
 * required before a lead can be saved.
 *
 * `marketingConsentAt` is a SEPARATE, optional opt-in: undefined/null
 * means the respondent did not agree to marketing contact; a timestamp
 * records when they did. Checking that box is never required to
 * receive the report.
 */
export interface Lead {
  firstName: string;
  email: string;
  company?: string;
  website?: string;
  assessmentResultId: string;
  consentTimestamp: Date;
  consentPolicyVersion: string;
  marketingConsentAt?: Date;
}

export interface SavedLead extends Lead {
  id: string;
  createdAt: Date;
}
