"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "business-minded:assessment-progress";

interface StoredProgress {
  currentIndex: number;
  answers: Record<string, number>;
}

function readStoredProgress(): StoredProgress {
  if (typeof window === "undefined") return { currentIndex: 0, answers: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { currentIndex: 0, answers: {} };
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    return {
      currentIndex: typeof parsed.currentIndex === "number" ? parsed.currentIndex : 0,
      answers: parsed.answers ?? {},
    };
  } catch {
    return { currentIndex: 0, answers: {} };
  }
}

/**
 * Client-side hook that persists in-progress assessment answers to
 * localStorage so a respondent can close the tab and resume later.
 * Sprint 1 requirement: "Save progress locally."
 */
export function useAssessmentProgress() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once, after mount (avoids SSR/client mismatch).
  useEffect(() => {
    const stored = readStoredProgress();
    setCurrentIndex(stored.currentIndex);
    setAnswers(stored.answers);
    setHydrated(true);
  }, []);

  // Persist on every change, once hydrated.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ currentIndex, answers } satisfies StoredProgress)
    );
  }, [currentIndex, answers, hydrated]);

  const setAnswer = useCallback((questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const goNext = useCallback((lastIndex: number) => {
    setCurrentIndex((i) => Math.min(i + 1, lastIndex));
  }, []);

  const goBack = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setAnswers({});
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    currentIndex,
    answers,
    hydrated,
    setAnswer,
    goNext,
    goBack,
    reset,
    setCurrentIndex,
  };
}
