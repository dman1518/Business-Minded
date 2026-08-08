"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionSet } from "@/domain/entities/Question";
import { useAssessmentProgress } from "@/lib/hooks/useAssessmentProgress";
import { QuestionCard } from "@/components/assessment/QuestionCard";
import { ProgressIndicator } from "@/components/assessment/ProgressIndicator";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

export default function AssessmentPage() {
  const router = useRouter();
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasTrackedStart = useRef(false);
  const lastTrackedQuestionIndex = useRef<number | null>(null);

  const { currentIndex, answers, hydrated, setAnswer, skipAnswer, goNext, goBack, reset } =
    useAssessmentProgress();

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

  // Fire assessment_started once (the first time the assessment has
  // loaded and is ready to show a question), and question_viewed
  // whenever the visible question actually changes — guarded by refs
  // so re-renders don't re-fire the same event.
  useEffect(() => {
    if (!questionSet || !hydrated || !question) return;

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
  }, [questionSet, hydrated, question, safeIndex]);

  if (loadError) {
    return <CenteredMessage>{loadError}</CenteredMessage>;
  }

  if (!questionSet || !hydrated || !question) {
    return <CenteredMessage>Loading assessment…</CenteredMessage>;
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
        }),
      });

      if (!response.ok) throw new Error("Submission failed");

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

      {submitError ? (
        <p className="mt-4 text-sm text-red-600">{submitError}</p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSubmitError(null);
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
