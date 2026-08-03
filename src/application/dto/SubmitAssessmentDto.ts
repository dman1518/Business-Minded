import { z } from "zod";

/** Wire-format input for POST /api/assessments. Validated at the API boundary. */
export const SubmitAssessmentSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        value: z.number(),
      })
    )
    .min(1),
});

export type SubmitAssessmentInput = z.infer<typeof SubmitAssessmentSchema>;
