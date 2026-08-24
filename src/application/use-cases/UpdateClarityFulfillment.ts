import { ClarityPurchaseRepository } from "@/domain/repositories/ClarityPurchaseRepository";
import { UpdateClarityFulfillmentInput } from "@/application/dto/UpdateClarityFulfillmentDto";

export type UpdateClarityFulfillmentResult = { ok: true } | { ok: false; error: string };

/**
 * Use case: applies an internal fulfillment action (a manual status
 * advance, or an internal-notes update) to a purchase.
 *
 * Deliberately thin: it does not re-implement transition legality
 * checks itself — it always calls ClarityPurchaseRepository.updateStatus
 * and reports whatever that returns, since updateStatus is already the
 * single source of truth for the ClarityPurchaseStatus state machine
 * (see canTransition). This guarantees the admin view can never move a
 * purchase through an illegal transition just because a route or use
 * case forgot to check — there is exactly one place that decides.
 */
export class UpdateClarityFulfillment {
  constructor(private readonly purchaseRepository: ClarityPurchaseRepository) {}

  async execute(purchaseId: string, action: UpdateClarityFulfillmentInput): Promise<UpdateClarityFulfillmentResult> {
    const purchase = await this.purchaseRepository.findById(purchaseId);
    if (!purchase) return { ok: false, error: "Purchase not found." };

    if (action.kind === "set_notes") {
      await this.purchaseRepository.updateFields(purchase.id, { internalNotes: action.notes });
      return { ok: true };
    }

    const extra: Partial<{
      scheduledAt: Date;
      followUpDueAt: Date;
      planDeliveredAt: Date;
      followUpDoneAt: Date;
    }> = {};

    if (action.to === "scheduled") extra.scheduledAt = new Date(action.scheduledAt);
    if (action.to === "followup_due") extra.followUpDueAt = new Date(action.followUpDueAt);
    if (action.to === "delivered") extra.planDeliveredAt = new Date();
    if (action.to === "completed") extra.followUpDoneAt = new Date();

    const applied = await this.purchaseRepository.updateStatus(purchase.id, action.to, extra);
    if (!applied) {
      return { ok: false, error: `Can't move from "${purchase.status}" to "${action.to}".` };
    }

    if (action.to === "scheduled") {
      await this.purchaseRepository.updateFields(purchase.id, { schedulingStatus: "scheduled" });
    }

    return { ok: true };
  }
}
