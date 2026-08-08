"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

export interface LeadFormValues {
  firstName: string;
  email: string;
  company: string;
  website: string;
  reportConsent: boolean;
  marketingConsent: boolean;
}

interface LeadCaptureFormProps {
  assessmentResultId: string;
  onSubmitted: (values: LeadFormValues) => Promise<void> | void;
  onCancel: () => void;
}

const EMPTY_VALUES: LeadFormValues = {
  firstName: "",
  email: "",
  company: "",
  website: "",
  reportConsent: false,
  marketingConsent: false,
};

/**
 * Lead Capture — collects First name (required), Email (required),
 * Company (optional), Website (optional), and consent, then stores the
 * lead via POST /api/leads before unlocking the report download.
 *
 * Report-delivery consent is required (you can't unlock the report
 * without it); marketing consent is a separate, optional checkbox —
 * unchecked by default, never required.
 */
export function LeadCaptureForm({ assessmentResultId, onSubmitted, onCancel }: LeadCaptureFormProps) {
  const [values, setValues] = useState<LeadFormValues>(EMPTY_VALUES);
  // Honeypot: a field a real visitor never sees or fills in, distinct
  // from the real, visible "Website" field above. Kept out of
  // LeadFormValues/onSubmitted so callers never have to think about it —
  // it only ever travels to the API, which rejects any submission where
  // it's non-empty.
  const [hp, setHp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent({ name: "lead_form_started", assessmentId: assessmentResultId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!values.reportConsent) {
      setError("Please agree to receive your report to continue.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, assessmentResultId, hp }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to save your details. Please try again.");
      }

      trackEvent({ name: "lead_submitted", assessmentId: assessmentResultId });
      await onSubmitted(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Get your full report</CardTitle>
        <CardDescription>
          We&apos;ll save your details below and unlock your full Business Minded report as a PDF
          you can download right away. We don&apos;t currently deliver reports by email — save the
          PDF for your records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              required
              value={values.firstName}
              onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))}
              autoComplete="given-name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company">Company (optional)</Label>
            <Input
              id="company"
              value={values.company}
              onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))}
              autoComplete="organization"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              placeholder="yourbusiness.com"
              value={values.website}
              onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))}
              autoComplete="url"
            />
          </div>

          {/* Honeypot — hidden from real visitors via CSS (not `display:none`,
              which some bots skip), left blank by humans, and rejected
              server-side if filled in. `tabIndex=-1` and `autoComplete=off`
              keep it out of the keyboard-navigation and autofill paths. Named
              and labeled distinctly from the real "Website" field above so
              the two are never confused. */}
          <div
            className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
            style={{ clip: "rect(0,0,0,0)", clipPath: "inset(50%)" }}
            aria-hidden="true"
          >
            <Label htmlFor="hp-confirm">Leave this field blank</Label>
            <Input
              id="hp-confirm"
              name="hp-confirm"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex items-start gap-2.5">
              <input
                id="reportConsent"
                type="checkbox"
                required
                checked={values.reportConsent}
                onChange={(e) => setValues((v) => ({ ...v, reportConsent: e.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
              />
              <Label
                htmlFor="reportConsent"
                className="text-sm font-normal leading-snug text-muted-foreground"
              >
                I agree to the{" "}
                <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                  privacy policy
                </Link>{" "}
                and consent to receiving my report and being contacted about my results.
                <span className="text-foreground"> Required.</span>
              </Label>
            </div>

            <div className="flex items-start gap-2.5">
              <input
                id="marketingConsent"
                type="checkbox"
                checked={values.marketingConsent}
                onChange={(e) => setValues((v) => ({ ...v, marketingConsent: e.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
              />
              <Label
                htmlFor="marketingConsent"
                className="text-sm font-normal leading-snug text-muted-foreground"
              >
                Also send me occasional tips and updates from Business Minded.
                <span className="text-foreground"> Optional — separate from the report above.</span>
              </Label>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={submitting || !values.reportConsent}>
              {submitting ? "Submitting…" : "Get My Full Report"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Back to results
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
