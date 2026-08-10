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

/**
 * Wire-format input for POST /api/assessments. Validated at the API
 * boundary.
 *
 * answers deliberately has NO .min(1) here: an empty array is a valid,
 * intentional wire shape -- it's exactly what the client sends when
 * every question was skipped (skipAnswer removes the key entirely, so
 * a fully-skipped assessment submits answers: []). Rejecting it here
 * with a generic 400 would short-circuit before SubmitAssessment /
 * ConfigurableScoringEngine ever get a chance to throw the intentional
 * InsufficientDataError the API route maps to 422 INSUFFICIENT_DATA
 * -- silently reintroducing the all-skipped generic-error bug at the
 * schema layer instead of the scoring layer.
 */
export const SubmitAssessmentSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      value: z.number(),
    })
  ),
  segmentation: SegmentationSchema,
});

export type SubmitAssessmentInput = z.infer<typeof SubmitAssessmentSchema>;
