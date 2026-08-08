import { z } from "zod";
import {
  INDUSTRY_VALUES,
  COMPANY_SIZE_VALUES,
  REVENUE_RANGE_VALUES,
} from "@/domain/value-objects/Segmentation";

/**
 * Unscored segmentation fields from the assessment intro screen. Every
 * field is optional (a respondent can skip any/all of them), and any
 * value that IS present must be one of the allowed option-list values
 * — never free text — so this can never become an injection or PII
 * vector.
 */
const SegmentationSchema = z
  .object({
    industry: z.enum(INDUSTRY_VALUES).optional(),
    companySize: z.enum(COMPANY_SIZE_VALUES).optional(),
    revenueRange: z.enum(REVENUE_RANGE_VALUES).optional(),
  })
  .optional();

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
  segmentation: SegmentationSchema,
});

export type SubmitAssessmentInput = z.infer<typeof SubmitAssessmentSchema>;
