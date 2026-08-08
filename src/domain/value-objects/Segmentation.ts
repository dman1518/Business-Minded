/**
 * Unscored segmentation info, collected on the assessment intro screen.
 *
 * None of these fields feed the scoring engine — they exist purely to
 * let the business qualify/segment leads later (e.g. "how did solo
 * businesses score vs. 21-50 employee businesses"). All three are
 * optional; a respondent can skip any or all of them and proceed
 * straight to the scored questions.
 *
 * The option lists below are the single source of truth for allowed
 * values, shared by the API's validation schema (SubmitAssessmentDto)
 * and the intro screen's dropdowns, so a value can never be accepted
 * server-side that isn't also offered client-side.
 */

export interface Segmentation {
  industry?: string;
  companySize?: string;
  revenueRange?: string;
}

export interface SegmentationOption {
  value: string;
  label: string;
}

export const INDUSTRY_OPTIONS: readonly SegmentationOption[] = [
  { value: "retail_ecommerce", label: "Retail / E-commerce" },
  { value: "professional_services", label: "Professional Services" },
  { value: "construction_trades", label: "Construction / Trades" },
  { value: "healthcare_wellness", label: "Healthcare / Wellness" },
  { value: "hospitality_food", label: "Hospitality / Food Service" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "technology_software", label: "Technology / Software" },
  { value: "creative_marketing", label: "Creative / Marketing" },
  { value: "other", label: "Other" },
] as const;

export const COMPANY_SIZE_OPTIONS: readonly SegmentationOption[] = [
  { value: "solo", label: "Just me (solo)" },
  { value: "2_5", label: "2–5 employees" },
  { value: "6_20", label: "6–20 employees" },
  { value: "21_50", label: "21–50 employees" },
  { value: "51_plus", label: "51+ employees" },
] as const;

export const REVENUE_RANGE_OPTIONS: readonly SegmentationOption[] = [
  { value: "under_250k", label: "Under $250K" },
  { value: "250k_1m", label: "$250K–$1M" },
  { value: "1m_5m", label: "$1M–$5M" },
  { value: "5m_10m", label: "$5M–$10M" },
  { value: "10m_plus", label: "$10M+" },
] as const;

export const INDUSTRY_VALUES = INDUSTRY_OPTIONS.map((o) => o.value) as [string, ...string[]];
export const COMPANY_SIZE_VALUES = COMPANY_SIZE_OPTIONS.map((o) => o.value) as [string, ...string[]];
export const REVENUE_RANGE_VALUES = REVENUE_RANGE_OPTIONS.map((o) => o.value) as [string, ...string[]];
