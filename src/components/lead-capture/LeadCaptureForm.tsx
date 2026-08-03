"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export interface LeadFormValues {
  firstName: string;
  email: string;
  company: string;
}

interface LeadCaptureFormProps {
  assessmentResultId: string;
  /** Copy differs slightly depending on which CTA opened the form. */
  intent: "download" | "email";
  onSubmitted: (values: LeadFormValues) => Promise<void> | void;
  onCancel: () => void;
}

/**
 * Lead Capture — collects First Name, Email, Company and stores the
 * lead in the database (via POST /api/leads) before unlocking the
 * report download, per the customer flow:
 * Results -> Email Capture -> Download Report.
 */
export function LeadCaptureForm({
  assessmentResultId,
  intent,
  onSubmitted,
  onCancel,
}: LeadCaptureFormProps) {
  const [values, setValues] = useState<LeadFormValues>({ firstName: "", email: "", company: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, assessmentResultId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to save your details.");
      }

      await onSubmitted(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Get your full report</CardTitle>
        <CardDescription>
          {intent === "email"
            ? "Enter your details and we'll get your Business Health Check report to you."
            : "Enter your details to unlock your downloadable report."}
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
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              required
              value={values.company}
              onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))}
              autoComplete="organization"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="mt-2 flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : intent === "email" ? "Email My Report" : "Download Report"}
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
