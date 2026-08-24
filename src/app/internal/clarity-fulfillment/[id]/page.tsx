"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatCurrency";
import { ADMIN_SECRET_STORAGE_KEY } from "@/app/internal/clarity-fulfillment/page";

interface PurchaseDetail {
  id: string;
  customerEmail: string | null;
  status: string;
  intakeStatus: string;
  schedulingStatus: string;
  amountMinorUnits: number;
  currency: string;
  founderPricingApplied: boolean;
  scheduledAt: string | null;
  planDeliveredAt: string | null;
  followUpDueAt: string | null;
  followUpDoneAt: string | null;
  internalNotes: string | null;
  createdAt: string;
}

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
  otherAttendees: string | null;
}

interface IntakeDetail {
  answers: IntakeAnswers;
  submittedAt: string | null;
}

export default function ClarityFulfillmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const purchaseId = params.id;

  const [secret, setSecret] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [intake, setIntake] = useState<IntakeDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduledAtInput, setScheduledAtInput] = useState("");
  const [followUpDueAtInput, setFollowUpDueAtInput] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_SECRET_STORAGE_KEY);
    if (!stored) {
      router.replace("/internal/clarity-fulfillment");
      return;
    }
    setSecret(stored);
  }, [router]);

  function reload(currentSecret: string) {
    fetch(`/api/internal/clarity-fulfillment/${purchaseId}`, {
      headers: { "x-admin-secret": currentSecret },
    })
      .then((res) => {
        if (res.status === 401) throw new Error("unauthorized");
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: { purchase: PurchaseDetail; intake: IntakeDetail | null }) => {
        setPurchase(data.purchase);
        setIntake(data.intake);
        setNotes(data.purchase.internalNotes ?? "");
      })
      .catch((err) => {
        if (err instanceof Error && err.message === "unauthorized") {
          window.sessionStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
          router.replace("/internal/clarity-fulfillment");
        } else {
          setError("Unable to load this purchase.");
        }
      });
  }

  useEffect(() => {
    if (secret) reload(secret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]);

  async function postAction(body: Record<string, unknown>) {
    if (!secret) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/internal/clarity-fulfillment/${purchaseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify(body),
      });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(responseBody.error ?? "Update failed.");
      }
      reload(secret);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveNotes() {
    await postAction({ kind: "set_notes", notes });
  }

  async function handleDownloadPlan() {
    if (!secret) return;
    const res = await fetch(`/api/internal/clarity-fulfillment/${purchaseId}/plan-template`, {
      headers: { "x-admin-secret": secret },
    });
    if (!res.ok) {
      setActionError("Unable to generate the plan template — make sure intake is complete.");
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `business-clarity-plan-${purchaseId}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <p>{error}</p>
          <Button variant="outline" asChild>
            <Link href="/internal/clarity-fulfillment">Back to queue</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (!purchase) {
    return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/internal/clarity-fulfillment" className="text-sm text-muted-foreground hover:underline">
          ← Back to queue
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{purchase.customerEmail ?? "(no email on file)"}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">Amount paid</span>
          <span>
            {formatCurrency(purchase.amountMinorUnits, purchase.currency)}
            {purchase.founderPricingApplied ? " (founding rate)" : ""}
          </span>
          <span className="text-muted-foreground">Status</span>
          <span>{purchase.status}</span>
          <span className="text-muted-foreground">Intake</span>
          <span>{purchase.intakeStatus}</span>
          <span className="text-muted-foreground">Scheduling</span>
          <span>{purchase.schedulingStatus}</span>
          {purchase.scheduledAt ? (
            <>
              <span className="text-muted-foreground">Scheduled for</span>
              <span>{new Date(purchase.scheduledAt).toLocaleString()}</span>
            </>
          ) : null}
          {purchase.planDeliveredAt ? (
            <>
              <span className="text-muted-foreground">Plan delivered</span>
              <span>{new Date(purchase.planDeliveredAt).toLocaleString()}</span>
            </>
          ) : null}
          <span className="text-muted-foreground">Purchased</span>
          <span>{new Date(purchase.createdAt).toLocaleString()}</span>
        </CardContent>
      </Card>

      {intake ? (
        <Card>
          <CardHeader>
            <CardTitle>Intake answers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <IntakeRow label="What the business does" value={intake.answers.businessDescription} />
            <IntakeRow label="Primary customer" value={intake.answers.primaryCustomer} />
            <IntakeRow label="Approx. annual revenue" value={intake.answers.approxAnnualRevenue} />
            <IntakeRow label="Team size" value={intake.answers.teamSize} />
            <IntakeRow label="Most urgent problem" value={intake.answers.mostUrgentProblem} />
            <IntakeRow label="90-day outcome" value={intake.answers.ninetyDayOutcome} />
            <IntakeRow label="Already tried" value={intake.answers.whatYouveAlreadyTried} />
            <IntakeRow label="Currently tracked metrics" value={intake.answers.metricsCurrentlyTracked} />
            <IntakeRow label="Implementation blockers" value={intake.answers.implementationBlockers} />
            <IntakeRow
              label="Needs approval from others"
              value={intake.answers.approvalNeededFromOthers ? "Yes" : "No"}
            />
            <IntakeRow
              label="Owner / decision-maker"
              value={intake.answers.isOwnerOrDecisionMaker ? "Yes" : "No"}
            />
            <IntakeRow
              label="Ready to act within 30 days"
              value={intake.answers.readyToActWithinThirtyDays ? "Yes" : "No"}
            />
            <IntakeRow label="Other attendees" value={intake.answers.otherAttendees ?? "None"} />

            <Button variant="outline" onClick={handleDownloadPlan} className="mt-2 self-start">
              Download Plan Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Intake not submitted yet.</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Move forward</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

          {purchase.status === "scheduling_pending" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scheduledAt">Session date/time</Label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAtInput}
                  onChange={(e) => setScheduledAtInput(e.target.value)}
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                />
              </div>
              <Button
                disabled={busy || !scheduledAtInput}
                onClick={() =>
                  postAction({
                    kind: "set_status",
                    to: "scheduled",
                    scheduledAt: new Date(scheduledAtInput).toISOString(),
                  })
                }
              >
                Mark Scheduled
              </Button>
            </div>
          )}

          {purchase.status === "scheduled" && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => postAction({ kind: "set_status", to: "delivered" })}>
                Mark Plan Delivered
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => postAction({ kind: "set_status", to: "cancelled" })}
              >
                Cancel Session
              </Button>
            </div>
          )}

          {purchase.status === "delivered" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="followUpDueAt">Follow-up due</Label>
                <input
                  id="followUpDueAt"
                  type="datetime-local"
                  value={followUpDueAtInput}
                  onChange={(e) => setFollowUpDueAtInput(e.target.value)}
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                />
              </div>
              <Button
                disabled={busy || !followUpDueAtInput}
                onClick={() =>
                  postAction({
                    kind: "set_status",
                    to: "followup_due",
                    followUpDueAt: new Date(followUpDueAtInput).toISOString(),
                  })
                }
              >
                Set Follow-up Due
              </Button>
            </div>
          )}

          {purchase.status === "followup_due" && (
            <Button disabled={busy} onClick={() => postAction({ kind: "set_status", to: "completed" })}>
              Mark Completed
            </Button>
          )}

          {["completed", "cancelled", "refunded"].includes(purchase.status) && (
            <p className="text-sm text-muted-foreground">This purchase is in a final state.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Internal notes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          <Button variant="outline" disabled={busy} onClick={handleSaveNotes} className="self-start">
            Save Notes
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function IntakeRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}
