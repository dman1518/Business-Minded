/**
 * Domain entity: Lead.
 * The contact captured in exchange for the Business Health Check report.
 *
 * Only `firstName` and `email` are required — `company` and `website`
 * are optional context the respondent may choose to share.
 *
 * Three DISTINCT consent purposes are tracked separately, per the
 * lead-capture privacy requirements — none of them are bundled into
 * one checkbox:
 *  (a) `consentTimestamp` / `consentPolicyVersion` — REQUIRED. Consent
 *      to process the submitted details in order to create/unlock the
 *      report. A lead cannot be saved without this.
 *  (b) `resultsFollowUpConsentAt` — OPTIONAL. Permission for
 *      personalized follow-up specifically about this assessment's
 *      results (e.g. a person reaching out to discuss the findings).
 *      undefined/null means not granted; a timestamp records when it
 *      was.
 *  (c) `marketingConsentAt` — OPTIONAL and SEPARATE from (b). General
 *      tips/marketing updates, unrelated to this specific result.
 *      undefined/null means the respondent did not opt in.
 * Neither (b) nor (c) is ever required to receive the report.
 */
export interface Lead {
  firstName: string;
  email: string;
  company?: string;
  website?: string;
  assessmentResultId: string;
  consentTimestamp: Date;
  consentPolicyVersion: string;
  resultsFollowUpConsentAt?: Date;
  marketingConsentAt?: Date;
}

export interface SavedLead extends Lead {
  id: string;
  createdAt: Date;
}
