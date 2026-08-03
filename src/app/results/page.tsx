"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { OverallScore } from "@/components/results/OverallScore";
import { CategoryScoreList } from "@/components/results/CategoryScoreList";
import { InsightCard } from "@/components/results/InsightCard";
import { PriorityList } from "@/components/results/PriorityList";
import { ConfidenceBadge } from "@/components/results/ConfidenceBadge";
import { LeadCaptureForm, LeadFormValues } from "@/components/lead-capture/LeadCaptureForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ViewStep = "results" | "leadCapture" | "complete";

export default function ResultsPage() {
  return (
    <Suspense fallback={<CenteredMessage>Loading your results…</CenteredMessage>}>
      <ResultsContent />
    </Suspense>
  );
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [result, setResult] = useState<SavedAssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ViewStep>("results");
  const [intent, setIntent] = useState<"download" | "email">("download");

  useEffect(() => {
    if (!id) {
      setError("No assessment result was specified.");
      return;
    }
    fetch(`/api/assessments/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data: SavedAssessmentResult) => setResult(data))
      .catch(() => setError("We couldn't find that assessment result."));
  }, [id]);

  async function downloadReport() {
    if (!id) return;
    const response = await fetch(`/api/report?assessmentResultId=${id}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "business-minded-report.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  async function handleLeadSubmitted(_values: LeadFormValues) {
    await downloadReport();
    setStep("complete");
  }

  if (error) {
    return <CenteredMessage>{error}</CenteredMessage>;
  }

  if (!result) {
    return <CenteredMessage>Loading your results…</CenteredMessage>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      {step === "results" && (
        <>
          <div className="flex flex-col items-center gap-4">
            <OverallScore score={result.overallScore} />
            <ConfidenceBadge level={result.confidenceLevel} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Category Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryScoreList categoryScores={result.categoryScores} />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <InsightCard label="Biggest Opportunity" insight={result.biggestOpportunity} tone="positive" />
            <InsightCard label="Biggest Constraint" insight={result.biggestConstraint} tone="negative" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Three Priorities</CardTitle>
            </CardHeader>
            <CardContent>
              <PriorityList priorities={result.topPriorities} />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => {
                setIntent("download");
                setStep("leadCapture");
              }}
            >
              Download Report
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIntent("email");
                setStep("leadCapture");
              }}
            >
              Email My Report
            </Button>
            <Button variant="ghost" onClick={() => router.push("/assessment")}>
              Retake Assessment
            </Button>
          </div>
        </>
      )}

      {step === "leadCapture" && id && (
        <LeadCaptureForm
          assessmentResultId={id}
          intent={intent}
          onSubmitted={handleLeadSubmitted}
          onCancel={() => setStep("results")}
        />
      )}

      {step === "complete" && (
        <Card>
          <CardHeader>
            <CardTitle>Your report is ready</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {intent === "email"
                ? "We've saved your details. Your report has also been downloaded to this device — email delivery is coming in a future release."
                : "Your report has been downloaded to this device."}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={downloadReport}>
                Download again
              </Button>
              <Button variant="ghost" onClick={() => router.push("/assessment")}>
                Retake Assessment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
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
