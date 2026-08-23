"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";
import { formatCurrency } from "@/lib/formatCurrency";

interface OfferPricing {
  amountMinorUnits: number;
  currency: string;
  founderPricingApplied: boolean;
  foundingSpotsRemaining: number | null;
  badgeCopy: string;
}

const CLIENT_REQUEST_ID_KEY = "clarity_session_client_request_id";

/**
 * One clientRequestId per checkout attempt, persisted in
 * sessionStorage so a page refresh (or the browser back button after
 * a cancelled checkout) reuses the same attempt rather than starting
 * a new one — this is what the server uses to dedupe a double-click or
 * retried request into a single Stripe Checkout Session. See
 * CreateClarityCheckoutSession for the server side of this contract.
 */
function getOrCreateClientRequestId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.sessionStorage.getItem(CLIENT_REQUEST_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(CLIENT_REQUEST_ID_KEY, created);
  return created;
}

export default function ClaritySessionOfferPage() {
  return (
    <Suspense fallback={<CenteredMessage>Loading…</CenteredMessage>}>
      <OfferContent />
    </Suspense>
  );
}

function OfferContent() {
  const searchParams = useSearchParams();
  const assessmentResultId = searchParams.get("assessment_result_id") ?? undefined;
  const utmSource = searchParams.get("utm_source") ?? undefined;
  const utmMedium = searchParams.get("utm_medium") ?? undefined;
  const utmCampaign = searchParams.get("utm_campaign") ?? undefined;

  const [pricing, setPricing] = useState<OfferPricing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent({ name: "clarity_offer_viewed" });
    fetch("/api/clarity-session/offer")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: OfferPricing) => setPricing(data))
      .catch(() => setLoadError("We couldn't load current pricing. Please refresh the page."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBookSession() {
    setSubmitting(true);
    setSubmitError(null);
    trackEvent({ name: "clarity_checkout_started" });

    try {
      const clientRequestId = getOrCreateClientRequestId();
      const response = await fetch("/api/clarity-session/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId,
          assessmentResultId,
          sourceCampaign:
            utmSource || utmMedium || utmCampaign
              ? { source: utmSource, medium: utmMedium, campaign: utmCampaign }
              : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to start checkout. Please try again.");
      }

      const body = await response.json();
      const redirectTo = body.alreadyPaid ? body.redirectUrl : body.url;
      if (!redirectTo) throw new Error("Unable to start checkout. Please try again.");
      window.location.href = redirectTo;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 sm:gap-8 sm:px-6 sm:py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Business Clarity Session</h1>
        <p className="text-sm text-muted-foreground">
          A private, focused working session to turn your assessment results into a concrete 90-day plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s included</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>A short intake so we come prepared, not guessing</li>
            <li>A private 75-minute working session</li>
            <li>A written Business Clarity Plan delivered within 24 hours</li>
            <li>One 15-minute follow-up check-in</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          {pricing ? <CardDescription>{pricing.badgeCopy}</CardDescription> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : pricing ? (
            <p className="text-3xl font-semibold tracking-tight">
              {formatCurrency(pricing.amountMinorUnits, pricing.currency)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Loading current pricing…</p>
          )}

          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

          <Button onClick={handleBookSession} disabled={!pricing || submitting} size="lg">
            {submitting ? "Redirecting to checkout…" : "Book My Session"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You&apos;ll pay securely via Stripe. Nothing is charged until you complete checkout.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center text-muted-foreground">
      {children}
    </main>
  );
}
