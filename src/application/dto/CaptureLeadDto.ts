import { z } from "zod";

/** Wire-format input for POST /api/leads. Validated at the API boundary. */
export const CaptureLeadSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  company: z.string().trim().min(1, "Company is required"),
  assessmentResultId: z.string().min(1),
});

export type CaptureLeadInput = z.infer<typeof CaptureLeadSchema>;
