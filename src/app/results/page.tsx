"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssessmentResultView } from "@/application/dto/AssessmentResultView";
import { OverallScore } from "@/components/results/OverallScore";
import { CategoryScoreList } from "@/components/results/CategoryScoreList";
import { InsightCard } from "@/components/results/InsightCard";
import { PriorityList } from "@/components/results/PriorityList";
import { ConfidenceBadge } from "@/components/results/ConfidenceBadge";
import { LeadCaptureForm, LeadFormValues } from "@/components/lead-capture/LeadCaptureForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

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

  const [result, setResult] = useState<AssessmentResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ViewStep>("results");

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
      .then((data: AssessmentResultView) => {
        setResult(data);
        trackEvent({ name: "results_viewed", assessmentId: id });
      })
      .catch(() => setError("We couldn't find that assessment result."));
  }, [id]);

  async function downloadReport() {
    if (!id) return;
    const response = await fetch(`/api/report?assessmentResultId=${id}`);
    if (!response.ok) return;
    const blob = await response.blob();
    trackEvent({ name: "report_generated", assessmentId: id });

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "business-minded-report.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    trackEvent({ name: "report_delivered", assessmentId: id });
  }

  async function handleLeadSubmitted(_values: LeadFormValues) {
    await downloadReport();
    setStep("complete");
  }

  function handleRetake() {
    trackEvent({ name: "assessment_retake_started", assessmentId: id ?? undefined });
    router.push("/assessment");
  }

  if (error) {
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center gap-4">
          <p>{error}</p>
          <Button variant="outline" onClick={handleRetake}>
            Retake the assessment
          </Button>
        </div>
      </CenteredMessage>
    );
  }

  if (!result) {
    return <CenteredMessage>Loading your results…</CenteredMessage>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10 sm:gap-8 sm:px-6 sm:py-16">
      {step === "results" && (
        <>
          <div className="flex flex-col items-center gap-4">
            <OverallScore score={result.overallScore} />
            <ConfidenceBadge level={result.confidenceLevel} />
          </div>

          {/* 1. Score interpretation */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <p className="min-w-0 break-words text-sm leading-relaxed text-foreground">
                {result.scoreInterpretation}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryScoreList categoryScores={result.categoryScores} />
            </CardContent>
          </Card>

          {/* 2-4. What's working / Biggest constraint / Biggest opportunity */}
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <InsightCard label="What's Working" insight={result.whatsWorking} tone="positive" />
            <InsightCard label="Biggest Constraint" insight={result.biggestConstraint} tone="negative" />
          </div>
          <InsightCard label="Biggest Opportunity" insight={result.biggestOpportunity} tone="positive" />

          {/* 5. Top three priorities */}
          <Card>
            <CardHeader>
              <CardTitle>Top Three Priorities</CardTitle>
            </CardHeader>
            <CardContent>
              <PriorityList priorities={result.topPriorities} />
            </CardContent>
          </Card>

          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => {
                  if (id) trackEvent({ name: "report_cta_clicked", assessmentId: id });
                  setStep("leadCapture");
                }}
              >
                Get My Full Report
              </Button>
              <Button variant="ghost" onClick={handleRetake}>
                Retake Assessment
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Requires your name and email — no payment, and your results stay on this page either way.
            </p>
          </div>
        </>
      )}

      {step === "leadCapture" && id && (
        <LeadCaptureForm
          assessmentResultId={id}
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
              Your report has been downloaded to this device as a PDF.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={downloadReport}>
                Download again
              </Button>
              <Button variant="ghost" onClick={handleRetake}>
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
