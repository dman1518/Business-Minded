import { z } from "zod";

/**
 * Wire-format input for POST /api/clarity-session/checkout.
 *
 * Deliberately does NOT accept a price, currency, or amount from the
 * client — pricing is always computed server-side from
 * ClarityOfferConfig + a real DB count (see CreateClarityCheckoutSession).
 * `clientRequestId` is the idempotency key: generated once per checkout
 * attempt on the client and reused across retries/refreshes of the
 * same attempt.
 */
export const CreateClarityCheckoutSchema = z.object({
  clientRequestId: z.string().uuid("clientRequestId must be a UUID"),
  assessmentResultId: z.string().min(1).max(100).optional(),
  sourceCampaign: z
    .object({
      source: z.string().trim().max(100).optional(),
      medium: z.string().trim().max(100).optional(),
      campaign: z.string().trim().max(100).optional(),
    })
    .optional(),
});

export type CreateClarityCheckoutInput = z.infer<typeof CreateClarityCheckoutSchema>;
