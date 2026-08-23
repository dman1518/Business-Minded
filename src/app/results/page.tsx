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
import { insightRoleLabel } from "@/domain/policies/ComparativeLanguage";
import { selectVisibleInsights } from "@/domain/policies/VisibleInsights";
import { TieState } from "@/domain/entities/Score";

type ViewStep = "results" | "leadCapture" | "complete";

/**
 * One heading per tie state (see TieState in Score.ts) — the heading
 * always names the ACTUAL band every scoreable dimension tied on, so
 * a Developing-band tie never reads the same as a Solid-band tie.
 */
const TIE_STATE_HEADINGS: Record<Exclude<TieState, "none">, string> = {
  "all-low-tied": "Broad, foundational risk",
  "developing-tied": "A consistently developing profile",
  "solid-tied": "A consistently solid profile",
  "all-high-tied": "A consistently strong profile",
};

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
            <OverallScore scoreDisplay={result.scoreDisplay} />
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

          {/* 2-4. What's working / Biggest constraint / Biggest opportunity, or
              a balanced-profile tie explanation when every scoreable dimension
              tied — showing an arbitrarily-picked "biggest" would be false
              precision in that case. Role labels (and the tie heading) are
              derived from the canonical tieState / scoreableDimensionCount —
              never hardcoded per score — so a Developing-band tie reads
              differently from a Solid-band tie, and a single eligible
              dimension is never framed as a comparative "biggest". */}
          {result.roles.tieState !== "none" ? (
            <Card>
              <CardHeader>
                <CardTitle>{TIE_STATE_HEADINGS[result.roles.tieState]}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="min-w-0 break-words text-sm text-muted-foreground">{result.roles.tieMessage}</p>
              </CardContent>
            </Card>
          ) : (
            (() => {
              // Only a role with an actual selected dimension renders a
              // card here — an unfilled role (e.g. no eligible second
              // dimension, or below the comparative-language threshold)
              // is omitted entirely rather than shown as an empty
              // placeholder card. This is what stops a one-dimension
              // sparse result from showing three identical "Preliminary
              // Focus Area" cards (two of them empty) instead of one.
              // See selectVisibleInsights for the (unit-tested) rule.
              const filledInsights = selectVisibleInsights(result.roles);

              if (filledInsights.length === 0) {
                return null;
              }

              const renderCard = (entry: (typeof filledInsights)[number]) => (
                <InsightCard
                  key={entry.role}
                  label={insightRoleLabel(entry.role, result.scoreDisplay.scoreableDimensionCount)}
                  insight={entry.insight}
                  tone={entry.tone}
                />
              );

              return (
                <>
                  <h3 className="min-w-0 break-words text-lg font-semibold leading-tight tracking-tight sm:text-xl">
                    Key Insights
                  </h3>
                  {filledInsights.length >= 3 ? (
                    <>
                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                        {filledInsights.slice(0, 2).map(renderCard)}
                      </div>
                      {renderCard(filledInsights[2])}
                    </>
                  ) : filledInsights.length === 2 ? (
                    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                      {filledInsights.map(renderCard)}
                    </div>
                  ) : (
                    renderCard(filledInsights[0])
                  )}
                </>
              );
            })()
          )}

          {/* 5. Top priorities */}
          <Card>
            <CardHeader>
              <CardTitle>Top Priorities</CardTitle>
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
