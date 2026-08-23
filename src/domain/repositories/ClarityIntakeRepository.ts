import { ClarityIntake, ClarityIntakeAnswers } from "@/domain/entities/ClarityIntake";

export interface UpsertClarityIntakeInput {
  purchaseId: string;
  answers: ClarityIntakeAnswers;
  consentTimestamp: Date;
  consentPolicyVersion: string;
}

/**
 * Port: persists Business Clarity Session intake answers.
 *
 * `upsertSubmitted` creates the intake row on first submission or
 * overwrites a prior submission if the customer comes back and
 * resubmits before their session (e.g. to fix a typo) — the stored
 * intake is always the customer's latest answers, never appended
 * history.
 */
export interface ClarityIntakeRepository {
  findByPurchaseId(purchaseId: string): Promise<ClarityIntake | null>;
  upsertSubmitted(input: UpsertClarityIntakeInput): Promise<ClarityIntake>;
}
