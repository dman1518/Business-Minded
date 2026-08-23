/**
 * Explicit state machine for a Business Clarity Session purchase.
 *
 * Deliberately a closed union of named states rather than a handful of
 * nullable timestamp columns — the task spec calls this out explicitly
 * ("use explicit statuses rather than nullable-field ambiguity").
 *
 * Pre-payment states exist because Stripe Checkout Sessions can be
 * cancelled or expire without ever becoming a payment, and a failed
 * payment attempt is a distinct, user-facing outcome from either of
 * those — all three needed their own state per the spec's requirement
 * to "handle successful, cancelled, expired, duplicate, and refunded
 * payments."
 */
export type ClarityPurchaseStatus =
  | "checkout_created"
  | "checkout_cancelled"
  | "checkout_expired"
  | "payment_failed"
  | "paid"
  | "intake_pending"
  | "intake_complete"
  | "scheduling_pending"
  | "scheduled"
  | "delivered"
  | "followup_due"
  | "completed"
  | "refunded"
  | "cancelled";

export const CLARITY_PURCHASE_STATUSES: readonly ClarityPurchaseStatus[] = [
  "checkout_created",
  "checkout_cancelled",
  "checkout_expired",
  "payment_failed",
  "paid",
  "intake_pending",
  "intake_complete",
  "scheduling_pending",
  "scheduled",
  "delivered",
  "followup_due",
  "completed",
  "refunded",
  "cancelled",
];

/**
 * Allowed forward transitions. Enforced by
 * ClarityPurchaseRepository.updateStatus implementations so a replayed
 * or out-of-order webhook cannot move a purchase backwards (e.g. a
 * stale "checkout.session.completed" arriving after a refund has
 * already been recorded must not resurrect the purchase as "paid").
 * Terminal states (refunded, cancelled, completed) have no outgoing
 * transitions except where explicitly listed.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<
  ClarityPurchaseStatus,
  readonly ClarityPurchaseStatus[]
> = {
  checkout_created: ["checkout_cancelled", "checkout_expired", "payment_failed", "paid"],
  checkout_cancelled: [],
  checkout_expired: [],
  payment_failed: ["checkout_created", "paid"],
  paid: ["intake_pending", "refunded"],
  intake_pending: ["intake_complete", "refunded"],
  intake_complete: ["scheduling_pending", "refunded"],
  scheduling_pending: ["scheduled", "refunded"],
  scheduled: ["delivered", "cancelled", "refunded"],
  delivered: ["followup_due", "refunded"],
  followup_due: ["completed", "refunded"],
  completed: ["refunded"],
  refunded: [],
  cancelled: [],
};

export function canTransition(
  from: ClarityPurchaseStatus,
  to: ClarityPurchaseStatus
): boolean {
  if (from === to) return true; // idempotent no-op, e.g. a replayed webhook
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export type ClarityIntakeStatus = "not_started" | "in_progress" | "complete";
export type ClaritySchedulingStatus =
  | "not_started"
  | "link_sent"
  | "externally_managed"
  | "scheduled";
