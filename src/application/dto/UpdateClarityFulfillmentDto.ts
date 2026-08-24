import { z } from "zod";

/**
 * Wire-format input for POST /api/internal/clarity-fulfillment/[id].
 * Each `set_status` variant corresponds to one legal forward edge in
 * the ClarityPurchaseStatus state machine (see
 * src/domain/value-objects/ClarityPurchaseStatus.ts) that an internal
 * user can trigger manually — refunds are deliberately excluded here
 * since those come from Stripe (via the webhook or the Stripe
 * Dashboard), never from this view.
 */
export const UpdateClarityFulfillmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("set_status"), to: z.literal("scheduled"), scheduledAt: z.string().datetime() }),
  z.object({ kind: z.literal("set_status"), to: z.literal("delivered") }),
  z.object({
    kind: z.literal("set_status"),
    to: z.literal("followup_due"),
    followUpDueAt: z.string().datetime(),
  }),
  z.object({ kind: z.literal("set_status"), to: z.literal("completed") }),
  z.object({ kind: z.literal("set_status"), to: z.literal("cancelled") }),
  z.object({ kind: z.literal("set_notes"), notes: z.string().max(5_000) }),
]);

export type UpdateClarityFulfillmentInput = z.infer<typeof UpdateClarityFulfillmentSchema>;
