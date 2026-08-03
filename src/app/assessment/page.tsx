"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionSet } from "@/domain/entities/Question";
import { useAssessmentProgress } from "@/lib/hooks/useAssessmentProgress";
import { QuestionCard } from "@/components/assessment/QuestionCard";
import { ProgressIndicator } from "@/components/assessment/ProgressIndicator";
import { Button } from "@/components/ui/button";

export default function AssessmentPage() {
  const router = useRouter();
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  if (loadError) {
    return <CenteredMessage>{loadError}</CenteredMessage>;
  }

  if (!questionSet || !hydrated) {
    return <CenteredMessage>Loading assessment…</CenteredMessage>;
  }

  const questions = questionSet.questions;
  const total = questions.length;
  const safeIndex = Math.min(currentIndex, total - 1);
  const question = questions[safeIndex];
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
      reset();
      router.push(`/results?id=${result.id}`);
    } catch {
      setSubmitError("Something went wrong scoring your assessment. Please try again.");
      setSubmitting(false);
    }
  }

  function handleAdvance() {
    if (!canAdvance) return;
    advance();
  }

  function handleSkip() {
    setSubmitError(null);
    skipAnswer(question.id);
    advance(question.id);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <ProgressIndicator currentStep={safeIndex + 1} totalSteps={total} />

      <QuestionCard
        question={question}
        selectedValue={selectedValue}
        onSelect={(value) => setAnswer(question.id, value)}
        onSkip={handleSkip}
        disabled={submitting}
      />

      {submitError ? (
        <p className="mt-4 text-sm text-red-600">{submitError}</p>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
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
