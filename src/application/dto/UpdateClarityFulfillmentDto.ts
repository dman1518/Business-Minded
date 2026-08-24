import { z } from "zod";

/**
 * Wire-format input for POST /api/internal/clarity-fulfillment/[id].
 * Each `set_status` variant corresponds to one legal forward edge in
 * the ClarityPurchaseStatus state machine (see
 * src/domain/value-objects/ClarityPurchaseStatus.ts) that an internal
 * user can trigger manually — refunds are deliberately excluded here
 * since those come from Stripe (via the webhook or the Stripe
 * Dashboard), never from this view.
 *
 * Zod's `discriminatedUnion` requires a unique value of the
 * discriminator key across every variant. All five `set_status`
 * variants share `kind: "set_status"`, so they can't be top-level
 * options of a union discriminated on `kind` — that throws at module
 * load ("Discriminator property kind has duplicate value set_status").
 * Instead, the five variants form their own union discriminated on
 * `to` (which is unique per variant), and the outer shape is a plain
 * (non-discriminated) union of that with `set_notes`. Runtime
 * validation and inferred TypeScript narrowing are identical either
 * way — this only changes which Zod combinator is legal to use here.
 */
const SetStatusSchema = z.discriminatedUnion("to", [
  z.object({ kind: z.literal("set_status"), to: z.literal("scheduled"), scheduledAt: z.string().datetime() }),
  z.object({ kind: z.literal("set_status"), to: z.literal("delivered") }),
  z.object({
    kind: z.literal("set_status"),
    to: z.literal("followup_due"),
    followUpDueAt: z.string().datetime(),
  }),
  z.object({ kind: z.literal("set_status"), to: z.literal("completed") }),
  z.object({ kind: z.literal("set_status"), to: z.literal("cancelled") }),
]);

const SetNotesSchema = z.object({ kind: z.literal("set_notes"), notes: z.string().max(5_000) });

export const UpdateClarityFulfillmentSchema = z.union([SetStatusSchema, SetNotesSchema]);

export type UpdateClarityFulfillmentInput = z.infer<typeof UpdateClarityFulfillmentSchema>;
