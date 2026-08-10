"use client";

import {
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  REVENUE_RANGE_OPTIONS,
  Segmentation,
} from "@/domain/value-objects/Segmentation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface IntroScreenProps {
  segmentation: Segmentation;
  onChange: (field: keyof Segmentation, value: string) => void;
  onContinue: () => void;
}

const SKIP_VALUE = "";

/**
 * Shown once, before the first scored question. Collects three
 * optional, unscored segmentation fields (industry, company size,
 * revenue range) used only for internal lead qualification — never
 * for scoring. Every field defaults to "Prefer not to say" and the
 * respondent can continue immediately without choosing any of them.
 */
export function IntroScreen({ segmentation, onChange, onContinue }: IntroScreenProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">Before we begin</CardTitle>
        <CardDescription>
          10 quick questions, about 2 minutes. These three are optional and won&apos;t affect your
          score or change the recommendations you see — they just help us understand who&apos;s using
          this tool.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="industry">Industry (optional)</Label>
            <Select
              id="industry"
              value={segmentation.industry ?? SKIP_VALUE}
              onChange={(e) => onChange("industry", e.target.value)}
            >
              <option value={SKIP_VALUE}>Prefer not to say</option>
              {INDUSTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="companySize">Company size (optional)</Label>
            <Select
              id="companySize"
              value={segmentation.companySize ?? SKIP_VALUE}
              onChange={(e) => onChange("companySize", e.target.value)}
            >
              <option value={SKIP_VALUE}>Prefer not to say</option>
              {COMPANY_SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revenueRange">Annual revenue (optional)</Label>
            <Select
              id="revenueRange"
              value={segmentation.revenueRange ?? SKIP_VALUE}
              onChange={(e) => onChange("revenueRange", e.target.value)}
            >
              <option value={SKIP_VALUE}>Prefer not to say</option>
              {REVENUE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-2">
            <Button type="button" onClick={onContinue} className="w-full sm:w-auto">
              Start Assessment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
