"use client";

import { FormEvent, ReactNode, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SchedulingCta } from "@/components/clarity-session/SchedulingCta";
import { trackEvent } from "@/lib/analytics";

interface IntakeAnswers {
  businessDescription: string;
  primaryCustomer: string;
  approxAnnualRevenue: string;
  teamSize: string;
  mostUrgentProblem: string;
  ninetyDayOutcome: string;
  whatYouveAlreadyTried: string;
  metricsCurrentlyTracked: string;
  implementationBlockers: string;
  approvalNeededFromOthers: boolean;
  isOwnerOrDecisionMaker: boolean;
  readyToActWithinThirtyDays: boolean;
  otherAttendees: string;
}

const EMPTY_ANSWERS: IntakeAnswers = {
  businessDescription: "",
  primaryCustomer: "",
  approxAnnualRevenue: "",
  teamSize: "",
  mostUrgentProblem: "",
  ninetyDayOutcome: "",
  whatYouveAlreadyTried: "",
  metricsCurrentlyTracked: "",
  implementationBlockers: "",
  approvalNeededFromOthers: false,
  isOwnerOrDecisionMaker: true,
  readyToActWithinThirtyDays: true,
  otherAttendees: "",
};

const REVENUE_OPTIONS = ["Pre-revenue", "Under $250K", "$250K–$1M", "$1M–$5M", "$5M–$20M", "Over $20M"];
const TEAM_SIZE_OPTIONS = ["Just me", "2–5", "6–15", "16–50", "50+"];

const PAID_OR_LATER_STATUSES = [
  "paid",
  "intake_pending",
  "intake_complete",
  "scheduling_pending",
  "scheduled",
  "delivered",
  "followup_due",
  "completed",
];

type LoadState = "loading" | "eligible" | "not_paid" | "not_found" | "already_submitted";

export default function ClarityIntakePage() {
  return (
    <Suspense fallback={<CenteredMessage>Loading…</CenteredMessage>}>
      <IntakeContent />
    </Suspense>
  );
}

function IntakeContent() {
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase_id");

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [answers, setAnswers] = useState<IntakeAnswers>(EMPTY_ANSWERS);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) {
      setLoadState("not_found");
      return;
    }

    fetch(`/api/clarity-session/purchase-status?purchase_id=${encodeURIComponent(purchaseId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("not_found");
        return res.json();
      })
      .then((data: { status: string; intakeStatus: string }) => {
        if (!PAID_OR_LATER_STATUSES.includes(data.status)) {
          setLoadState("not_paid");
          return;
        }
        if (data.intakeStatus === "complete") {
          setLoadState("already_submitted");
          return;
        }
        setLoadState("eligible");
        trackEvent({ name: "clarity_intake_started" });
      })
      .catch(() => setLoadState("not_found"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!consent) {
      setError("Please confirm the checkbox below before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/clarity-session/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId,
          answers: { ...answers, otherAttendees: answers.otherAttendees || undefined },
          intakeConsent: consent,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to submit. Please try again.");
      }

      trackEvent({ name: "clarity_intake_submitted" });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === "loading") {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (loadState === "not_found") {
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center gap-4">
          <p>We couldn&apos;t find that session.</p>
          <Button variant="outline" asChild>
            <Link href="/clarity-session">Back to Business Clarity Session</Link>
          </Button>
        </div>
      </CenteredMessage>
    );
  }

  if (loadState === "not_paid") {
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center gap-4">
          <p>We don&apos;t see a completed payment for this session yet.</p>
          <Button variant="outline" asChild>
            <Link href="/clarity-session">Back to Business Clarity Session</Link>
          </Button>
        </div>
      </CenteredMessage>
    );
  }

  if ((loadState === "already_submitted" || submitted) && purchaseId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <Card className="w-full">
          <CardContent className="flex flex-col gap-4 pt-6">
            <p className="text-sm text-muted-foreground">
              {submitted
                ? "Thanks — your intake is in."
                : "We already have your intake on file."}{" "}
              Next: pick a time for your session.
            </p>
            <SchedulingCta purchaseId={purchaseId} />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pre-session intake</h1>
        <p className="text-sm text-muted-foreground">
          A few questions so we come to your session prepared. Takes about 5 minutes.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
            <Field label="What does your business do?">
              <Textarea
                required
                value={answers.businessDescription}
                onChange={(e) => setAnswers((a) => ({ ...a, businessDescription: e.target.value }))}
              />
            </Field>

            <Field label="Who is your primary customer?">
              <Textarea
                required
                value={answers.primaryCustomer}
                onChange={(e) => setAnswers((a) => ({ ...a, primaryCustomer: e.target.value }))}
              />
            </Field>

            <Field label="Approximate annual revenue">
              <Select
                required
                value={answers.approxAnnualRevenue}
                onChange={(e) => setAnswers((a) => ({ ...a, approxAnnualRevenue: e.target.value }))}
              >
                <option value="" disabled>
                  Select a range
                </option>
                {REVENUE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Team size">
              <Select
                required
                value={answers.teamSize}
                onChange={(e) => setAnswers((a) => ({ ...a, teamSize: e.target.value }))}
              >
                <option value="" disabled>
                  Select a size
                </option>
                {TEAM_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="What's the single most urgent problem you want to solve?">
              <Textarea
                required
                value={answers.mostUrgentProblem}
                onChange={(e) => setAnswers((a) => ({ ...a, mostUrgentProblem: e.target.value }))}
              />
            </Field>

            <Field label="What outcome would make the next 90 days a win?">
              <Textarea
                required
                value={answers.ninetyDayOutcome}
                onChange={(e) => setAnswers((a) => ({ ...a, ninetyDayOutcome: e.target.value }))}
              />
            </Field>

            <Field label="What have you already tried?">
              <Textarea
                required
                placeholder='Or write “Nothing yet”'
                value={answers.whatYouveAlreadyTried}
                onChange={(e) => setAnswers((a) => ({ ...a, whatYouveAlreadyTried: e.target.value }))}
              />
            </Field>

            <Field label="What metrics do you currently track?">
              <Textarea
                required
                placeholder='Or write “None yet”'
                value={answers.metricsCurrentlyTracked}
                onChange={(e) => setAnswers((a) => ({ ...a, metricsCurrentlyTracked: e.target.value }))}
              />
            </Field>

            <Field label="What's blocking you from implementing changes today?">
              <Textarea
                required
                placeholder='Or write “Nothing specific”'
                value={answers.implementationBlockers}
                onChange={(e) => setAnswers((a) => ({ ...a, implementationBlockers: e.target.value }))}
              />
            </Field>

            <YesNoField
              label="Do you need approval from anyone else to act on this?"
              value={answers.approvalNeededFromOthers}
              onChange={(value) => setAnswers((a) => ({ ...a, approvalNeededFromOthers: value }))}
            />

            <YesNoField
              label="Are you the owner or primary decision-maker?"
              value={answers.isOwnerOrDecisionMaker}
              onChange={(value) => setAnswers((a) => ({ ...a, isOwnerOrDecisionMaker: value }))}
            />

            <YesNoField
              label="Are you ready to act on recommendations within 30 days?"
              value={answers.readyToActWithinThirtyDays}
              onChange={(value) => setAnswers((a) => ({ ...a, readyToActWithinThirtyDays: value }))}
            />

            <Field label="Anyone else joining the session? (optional)">
              <Input
                value={answers.otherAttendees}
                onChange={(e) => setAnswers((a) => ({ ...a, otherAttendees: e.target.value }))}
                placeholder="Names and roles"
              />
            </Field>

            <div className="flex items-start gap-2.5 border-t border-border pt-4">
              <input
                id="intakeConsent"
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
              />
              <Label htmlFor="intakeConsent" className="text-sm font-normal leading-snug text-muted-foreground">
                I confirm the details above are accurate to the best of my knowledge, and understand they&apos;ll
                be used to prepare for my Business Clarity Session.
              </Label>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Intake"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-3">
        <Button type="button" variant={value ? "default" : "outline"} size="sm" onClick={() => onChange(true)}>
          Yes
        </Button>
        <Button type="button" variant={!value ? "default" : "outline"} size="sm" onClick={() => onChange(false)}>
          No
        </Button>
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center text-muted-foreground">
      {children}
    </main>
  );
}
