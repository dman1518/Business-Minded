import { z } from "zod";

/**
 * Loosely validates an optional website: if the respondent typed
 * something, it must at least look like a domain or URL once a missing
 * scheme is assumed — this is a light sanity check, not a live
 * reachability check, since we never fetch the URL server-side.
 */
const WEBSITE_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/.*)?$/i;

function normalizeWebsite(value: string): string {
  const withoutScheme = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return withoutScheme;
}

/**
 * Wire-format input for POST /api/leads. Validated at the API boundary.
 *
 * Only `firstName` and `email` are required; `company` and `website`
 * are optional. Three consent purposes are tracked separately and
 * independently (see Lead.ts):
 *  - `reportConsent` (required=true) — processing these details to
 *    create/unlock the report.
 *  - `resultsFollowUpConsent` (optional, default false) — personalized
 *    follow-up about THIS assessment's results.
 *  - `marketingConsent` (optional, default false) — general tips and
 *    marketing updates, unrelated to this specific result.
 * Only the first is ever required.
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
    .transform((v) => (v && v.length > 0 ? normalizeWebsite(v) : undefined))
    .refine((v) => v === undefined || WEBSITE_PATTERN.test(v), {
      message: "Enter a valid website (e.g. yourbusiness.com)",
    }),
  assessmentResultId: z.string().min(1).max(100),
  reportConsent: z
    .boolean()
    .refine((value) => value === true, {
      message: "You must agree to the privacy policy to receive your report.",
    }),
  resultsFollowUpConsent: z.boolean().optional().default(false),
  marketingConsent: z.boolean().optional().default(false),
  hp: z.string().max(500).optional(),
});

export type CaptureLeadInput = z.infer<typeof CaptureLeadSchema>;
