"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionSet } from "@/domain/entities/Question";
import { useAssessmentProgress } from "@/lib/hooks/useAssessmentProgress";
import { QuestionCard } from "@/components/assessment/QuestionCard";
import { IntroScreen } from "@/components/assessment/IntroScreen";
import { ProgressIndicator } from "@/components/assessment/ProgressIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

export default function AssessmentPage() {
  const router = useRouter();
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Distinct, intentional outcome from the "every question skipped"
  // case (server returns 422 / code INSUFFICIENT_DATA) — never shown as
  // a generic scoring error, and never leaves the user stuck with a
  // permanently-disabled results button.
  const [insufficientData, setInsufficientData] = useState(false);
  // When the respondent is about to skip the very last remaining
  // unanswered question (i.e. every question, including this one, would
  // then be unanswered), warn them first instead of silently submitting
  // straight into the insufficient-data outcome.
  const [confirmingLastSkip, setConfirmingLastSkip] = useState(false);
  const hasTrackedStart = useRef(false);
  const lastTrackedQuestionIndex = useRef<number | null>(null);

  const {
    currentIndex,
    answers,
    segmentation,
    introCompleted,
    hydrated,
    setAnswer,
    skipAnswer,
    setSegmentationField,
    completeIntro,
    goNext,
    goBack,
    reset,
  } = useAssessmentProgress();

  useEffect(() => {
    fetch("/api/questions")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load questions");
        return res.json();
      })
      .then((data: QuestionSet) => setQuestionSet(data))
      .catch(() => setLoadError("We couldn't load the assessment. Please refresh the page."));
  }, []);

  const questions = questionSet?.questions ?? [];
  const total = questions.length;
  const safeIndex = questionSet ? Math.min(currentIndex, total - 1) : 0;
  const question = questionSet ? questions[safeIndex] : undefined;

  // Fire assessment_started once (the first time the intro screen has
  // been completed and the assessment is ready to show a question), and
  // question_viewed whenever the visible question actually changes —
  // guarded by refs so re-renders don't re-fire the same event.
  useEffect(() => {
    if (!questionSet || !hydrated || !introCompleted || !question) return;

    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackEvent({ name: "assessment_started" });
    }

    if (lastTrackedQuestionIndex.current !== safeIndex) {
      lastTrackedQuestionIndex.current = safeIndex;
      trackEvent({
        name: "question_viewed",
        questionNumber: safeIndex + 1,
        dimension: question.categoryId,
      });
    }
  }, [questionSet, hydrated, introCompleted, question, safeIndex]);

  if (loadError) {
    return <CenteredMessage>{loadError}</CenteredMessage>;
  }

  if (!questionSet || !hydrated) {
    return <CenteredMessage>Loading assessment…</CenteredMessage>;
  }

  if (!introCompleted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
        <IntroScreen
          segmentation={segmentation}
          onChange={setSegmentationField}
          onContinue={completeIntro}
        />
      </main>
    );
  }

  if (!question) {
    return <CenteredMessage>Loading assessment…</CenteredMessage>;
  }

  if (insufficientData) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
        <Card>
          <CardHeader>
            <CardTitle>We need at least one answer</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Every question was skipped, so there isn&apos;t anything to calculate a useful result from.
              Answer at least one question to see your Business Minded Score, or start over.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => {
                  setInsufficientData(false);
                  setConfirmingLastSkip(false);
                }}
              >
                Answer a question
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setInsufficientData(false);
                  setConfirmingLastSkip(false);
                }}
              >
                Restart assessment
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isLastQuestion = safeIndex === total - 1;
  const selectedValue = answers[question.id];
  const canAdvance = selectedValue !== undefined;

  async function advance(excludeQuestionId?: string) {
    if (!isLastQuestion) {
      goNext(total - 1);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const answerEntries = Object.entries(answers).filter(
        ([questionId]) => questionId !== excludeQuestionId
      );

      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answerEntries.map(([questionId, value]) => ({
            questionId,
            value,
          })),
          segmentation: Object.keys(segmentation).length > 0 ? segmentation : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status === 422 && body?.code === "INSUFFICIENT_DATA") {
          setInsufficientData(true);
          setSubmitting(false);
          return;
        }
        throw new Error("Submission failed");
      }

      const result = await response.json();
      trackEvent({ name: "assessment_completed", assessmentId: result.id });
      reset();
      router.push(`/results?id=${result.id}`);
    } catch {
      setSubmitError("Something went wrong scoring your assessment. Please try again.");
      setSubmitting(false);
    }
  }

  function handleSelect(value: number) {
    if (!question) return;
    setConfirmingLastSkip(false);
    setAnswer(question.id, value);
    trackEvent({
      name: "question_answered",
      questionNumber: safeIndex + 1,
      dimension: question.categoryId,
    });
  }

  function handleAdvance() {
    if (!canAdvance) return;
    advance();
  }

  function handleSkip() {
    if (!question) return;
    setSubmitError(null);

    // Skipping this question would leave every question unanswered —
    // warn instead of silently submitting into a guaranteed
    // insufficient-data outcome.
    const remainingAnswerCount = Object.keys(answers).filter((id) => id !== question.id).length;
    if (isLastQuestion && remainingAnswerCount === 0 && !confirmingLastSkip) {
      setConfirmingLastSkip(true);
      return;
    }

    setConfirmingLastSkip(false);
    trackEvent({
      name: "question_skipped",
      questionNumber: safeIndex + 1,
      dimension: question.categoryId,
    });
    skipAnswer(question.id);
    advance(question.id);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
      <ProgressIndicator currentStep={safeIndex + 1} totalSteps={total} />

      <QuestionCard
        question={question}
        selectedValue={selectedValue}
        onSelect={handleSelect}
        onSkip={handleSkip}
        disabled={submitting}
      />

      {confirmingLastSkip ? (
        <div className="mt-4 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            You&apos;ve skipped every question so far. Skipping this one too means we won&apos;t have enough
            to calculate a useful result.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleSkip}>
              Skip anyway
            </Button>
            <Button type="button" size="sm" onClick={() => setConfirmingLastSkip(false)}>
              Answer this question instead
            </Button>
          </div>
        </div>
      ) : null}

      {submitError ? (
        <p className="mt-4 text-sm text-red-600">{submitError}</p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSubmitError(null);
            setConfirmingLastSkip(false);
            goBack();
          }}
          disabled={safeIndex === 0 || submitting}
        >
          Back
        </Button>

        <Button type="button" onClick={handleAdvance} disabled={!canAdvance || submitting}>
          {submitting ? "Scoring…" : isLastQuestion ? "See My Results" : "Next"}
        </Button>
      </div>
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
