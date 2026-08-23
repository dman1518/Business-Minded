"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";
import { formatCurrency } from "@/lib/formatCurrency";

interface PurchaseStatusView {
  purchaseId: string;
  status: string;
  intakeStatus: string;
  schedulingStatus: string;
  amountMinorUnits: number;
  currency: string;
}

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 10;

// Mirrors ClarityPurchaseStatus (src/domain/value-objects/ClarityPurchaseStatus.ts).
// This page only ever READS these values — the Stripe webhook is the
// sole writer of purchase status; this page never marks anything paid
// itself, even though it's the one the customer lands on right after
// paying.
const PAID_OR_LATER = new Set([
  "paid",
  "intake_pending",
  "intake_complete",
  "scheduling_pending",
  "scheduled",
  "delivered",
  "followup_due",
  "completed",
]);
const FAILED_STATUSES = new Set(["checkout_cancelled", "checkout_expired", "payment_failed"]);

export default function ClaritySessionSuccessPage() {
  return (
    <Suspense fallback={<CenteredMessage>Loading…</CenteredMessage>}>
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const purchaseIdParam = searchParams.get("purchase_id");

  const [purchase, setPurchase] = useState<PurchaseStatusView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const pollCount = useRef(0);
  const trackedPaid = useRef(false);

  useEffect(() => {
    if (!sessionId && !purchaseIdParam) {
      setNotFound(true);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const query = sessionId
        ? `session_id=${encodeURIComponent(sessionId)}`
        : `purchase_id=${encodeURIComponent(purchaseIdParam as string)}`;

      try {
        const res = await fetch(`/api/clarity-session/purchase-status?${query}`);
        if (cancelled) return;

        if (!res.ok) {
          setNotFound(true);
          return;
        }

        const data: PurchaseStatusView = await res.json();
        setPurchase(data);

        if (PAID_OR_LATER.has(data.status) || FAILED_STATUSES.has(data.status)) {
          if (PAID_OR_LATER.has(data.status) && !trackedPaid.current) {
            trackedPaid.current = true;
            trackEvent({ name: "clarity_payment_confirmed" });
          }
          return; // Reached a resting state — stop polling.
        }

        // Still "checkout_created": the webhook likely hasn't landed
        // yet (usually a matter of seconds). Keep polling a bounded
        // number of times rather than declaring success or failure
        // client-side — only the webhook decides that.
        pollCount.current += 1;
        if (pollCount.current < MAX_POLLS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, purchaseIdParam]);

  if (notFound) {
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center gap-4">
          <p>We couldn&apos;t find that checkout. If you were just charged, please contact us and we&apos;ll sort it out.</p>
          <Button variant="outline" asChild>
            <Link href="/clarity-session">Back to Business Clarity Session</Link>
          </Button>
        </div>
      </CenteredMessage>
    );
  }

  if (!purchase) {
    return <CenteredMessage>Confirming your payment…</CenteredMessage>;
  }

  if (FAILED_STATUSES.has(purchase.status)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Checkout didn&apos;t complete</CardTitle>
            <CardDescription>No session has been booked, and nothing further will be charged.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/clarity-session">Try again</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!PAID_OR_LATER.has(purchase.status)) {
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center gap-3">
          <p>We&apos;re still confirming your payment with Stripe — this usually takes just a few seconds.</p>
          <p className="text-xs text-muted-foreground">This page updates automatically. You can also refresh.</p>
        </div>
      </CenteredMessage>
    );
  }

  const needsIntake = purchase.intakeStatus !== "complete";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Payment confirmed</CardTitle>
          <CardDescription>
            {formatCurrency(purchase.amountMinorUnits, purchase.currency)} — your Business Clarity Session is
            booked in our system.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {needsIntake ? (
            <>
              <p className="text-sm text-muted-foreground">
                Next: a short intake so we can prepare for your session.
              </p>
              <Button asChild size="lg">
                <Link href={`/clarity-session/intake?purchase_id=${purchase.purchaseId}`}>Start Intake</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Thanks — we have your intake on file. We&apos;ll be in touch about scheduling.
            </p>
          )}
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
