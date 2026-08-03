import { z } from "zod";

/**
 * Wire-format input for POST /api/leads. Validated at the API boundary.
 *
 * `consent` must be explicitly true — the lead-capture form requires
 * the checkbox to be checked before it will submit, and the API
 * enforces it again server-side.
 *
 * `website` is an anti-bot honeypot field: it is rendered hidden/off-
 * screen in the real form, so a human never fills it in. A non-empty
 * value here almost certainly means the submission came from an
 * automated bot filling every field it can find, not a real lead — see
 * the honeypot handling in the API route for how this field is used.
 */
export const CaptureLeadSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(200),
  email: z.string().trim().email("Enter a valid email address").max(320),
  company: z.string().trim().min(1, "Company is required").max(200),
  assessmentResultId: z.string().min(1).max(100),
  consent: z
    .boolean()
    .refine((value) => value === true, {
      message: "You must agree to the privacy policy to continue.",
    }),
  website: z.string().max(500).optional(),
});

export type CaptureLeadInput = z.infer<typeof CaptureLeadSchema>;
