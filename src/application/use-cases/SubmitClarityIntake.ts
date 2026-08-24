import { ClarityPurchaseRepository } from "@/domain/repositories/ClarityPurchaseRepository";
import { ClarityIntakeRepository } from "@/domain/repositories/ClarityIntakeRepository";
import { ClarityIntakeAnswers } from "@/domain/entities/ClarityIntake";
import { CURRENT_PRIVACY_POLICY_VERSION } from "@/domain/policies/PrivacyPolicy";

export interface SubmitClarityIntakeInput {
  purchaseId: string;
  answers: ClarityIntakeAnswers;
}

export type SubmitClarityIntakeResult =
  | { kind: "submitted" }
  | { kind: "not_found" }
  | { kind: "not_paid" };

const INTAKE_ELIGIBLE_STATUSES = [
  "intake_pending",
  "intake_complete",
  "scheduling_pending",
  "scheduled",
  "delivered",
  "followup_due",
  "completed",
];

/**
 * Use case: records a paying customer's pre-session intake answers.
 *
 * Authorization model: `purchaseId` is an unguessable cuid — the same
 * capability-token pattern this app already uses for assessment
 * results (see /api/assessments/[id]); there is no login system. The
 * actual gate that matters is here, though: intake is only accepted
 * for a purchase whose status has reached "intake_pending" or later,
 * meaning the Stripe webhook has already verified payment. Knowing or
 * guessing a purchase id alone is never enough to submit intake for a
 * purchase nobody paid for.
 *
 * On first submission this also advances two things that the
 * ClarityPurchase.intakeStatus / .status fields both need to reflect:
 * intakeStatus flips to "complete" (this is the field the success and
 * intake pages actually read to decide whether to show "Start Intake"
 * again — it must be set here, not left at its default), and the main
 * status state machine advances intake_pending -> intake_complete ->
 * scheduling_pending in one step, mirroring how the webhook chains
 * paid -> intake_pending: the customer's next action (scheduling) is
 * a deterministic consequence of finishing intake, not a separate
 * business decision.
 */
export class SubmitClarityIntake {
  constructor(
    private readonly purchaseRepository: ClarityPurchaseRepository,
    private readonly intakeRepository: ClarityIntakeRepository
  ) {}

  async execute(input: SubmitClarityIntakeInput): Promise<SubmitClarityIntakeResult> {
    const purchase = await this.purchaseRepository.findById(input.purchaseId);
    if (!purchase) return { kind: "not_found" };

    if (!INTAKE_ELIGIBLE_STATUSES.includes(purchase.status)) {
      return { kind: "not_paid" };
    }

    await this.intakeRepository.upsertSubmitted({
      purchaseId: purchase.id,
      answers: input.answers,
      consentTimestamp: new Date(),
      consentPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    });

    await this.purchaseRepository.updateFields(purchase.id, { intakeStatus: "complete" });

    // Advance the purchase state machine on first submission. A
    // resubmission (status already past intake_pending) is a safe
    // no-op: updateStatus treats from===to as idempotent and will not
    // attempt a disallowed backward transition.
    if (purchase.status === "intake_pending") {
      await this.purchaseRepository.updateStatus(purchase.id, "intake_complete");
      await this.purchaseRepository.updateStatus(purchase.id, "scheduling_pending");
    }

    return { kind: "submitted" };
  }
}
