import { z } from "zod";

const MAX_TEXT = 2_000;

/**
 * Wire-format input for POST /api/clarity-session/intake. Mirrors the
 * 13 fields in ClarityIntakeAnswers exactly (see
 * src/domain/entities/ClarityIntake.ts). Free-text fields require at
 * least one character (the form guides respondents to write
 * "Nothing yet" / "None" rather than leaving a substantive field
 * blank) so an intake can't be submitted mostly empty; only
 * `otherAttendees` is genuinely optional.
 */
export const SubmitClarityIntakeSchema = z.object({
  purchaseId: z.string().min(1).max(100),
  answers: z.object({
    businessDescription: z.string().trim().min(1, "Please describe your business.").max(MAX_TEXT),
    primaryCustomer: z.string().trim().min(1, "Please describe your primary customer.").max(MAX_TEXT),
    approxAnnualRevenue: z.string().trim().min(1, "Please select an approximate revenue range.").max(200),
    teamSize: z.string().trim().min(1, "Please select a team size.").max(200),
    mostUrgentProblem: z.string().trim().min(1, "Please tell us your most urgent problem.").max(MAX_TEXT),
    ninetyDayOutcome: z
      .string()
      .trim()
      .min(1, "Please describe the outcome you want in 90 days.")
      .max(MAX_TEXT),
    whatYouveAlreadyTried: z
      .string()
      .trim()
      .min(1, 'Please tell us what you\'ve tried already, or write "Nothing yet".')
      .max(MAX_TEXT),
    metricsCurrentlyTracked: z
      .string()
      .trim()
      .min(1, 'Please tell us what you track, or write "None yet".')
      .max(MAX_TEXT),
    implementationBlockers: z
      .string()
      .trim()
      .min(1, 'Please tell us what\'s in the way, or write "Nothing specific".')
      .max(MAX_TEXT),
    approvalNeededFromOthers: z.boolean(),
    isOwnerOrDecisionMaker: z.boolean(),
    readyToActWithinThirtyDays: z.boolean(),
    otherAttendees: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  }),
  intakeConsent: z.boolean().refine((value) => value === true, {
    message: "Please confirm the details above before submitting.",
  }),
});

export type SubmitClarityIntakeInput = z.infer<typeof SubmitClarityIntakeSchema>;
