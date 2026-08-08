import { z } from "zod";

/**
 * Wire-format input for POST /api/leads. Validated at the API boundary.
 *
 * Only `firstName` and `email` are required; `company` and `website`
 * are optional. `reportConsent` must be explicitly true (required
 * before the report can be unlocked); `marketingConsent` is a
 * separate, optional opt-in and defaults to false.
 *
 * `hp` is an anti-bot honeypot field, unrelated to and distinct from
 * the real, visible `website` field above: it is rendered hidden/off-
 * screen in the real form, so a human never fills it in. A non-empty
 * value here almost certainly means the submission came from an
 * automated bot filling every field it can find — see the honeypot
 * handling in the API route for how this field is used.
 */
export const CaptureLeadSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(200),
  email: z.string().trim().email("Enter a valid email address").max(320),
  company: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  assessmentResultId: z.string().min(1).max(100),
  reportConsent: z
    .boolean()
    .refine((value) => value === true, {
      message: "You must agree to receive your report to continue.",
    }),
  marketingConsent: z.boolean().optional().default(false),
  hp: z.string().max(500).optional(),
});

export type CaptureLeadInput = z.infer<typeof CaptureLeadSchema>;
