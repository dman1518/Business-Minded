"use client";

import { useCallback, useEffect, useState } from "react";
import { Segmentation } from "@/domain/value-objects/Segmentation";

const STORAGE_KEY = "business-minded:assessment-progress";

interface StoredProgress {
  currentIndex: number;
  answers: Record<string, number>;
  segmentation: Segmentation;
  introCompleted: boolean;
}

function readStoredProgress(): StoredProgress {
  if (typeof window === "undefined") {
    return { currentIndex: 0, answers: {}, segmentation: {}, introCompleted: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { currentIndex: 0, answers: {}, segmentation: {}, introCompleted: false };
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    return {
      currentIndex: typeof parsed.currentIndex === "number" ? parsed.currentIndex : 0,
      answers: parsed.answers ?? {},
      segmentation: parsed.segmentation ?? {},
      introCompleted: parsed.introCompleted ?? false,
    };
  } catch {
    return { currentIndex: 0, answers: {}, segmentation: {}, introCompleted: false };
  }
}

/**
 * Client-side hook that persists in-progress assessment answers to
 * localStorage so a respondent can close the tab and resume later.
 * Sprint 1 requirement: "Save progress locally."
 *
 * Also persists the optional intro-screen segmentation selections and
 * whether the intro screen has been completed, so a resumed session
 * doesn't re-show the intro to someone who already passed it.
 */
export function useAssessmentProgress() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [segmentation, setSegmentation] = useState<Segmentation>({});
  const [introCompleted, setIntroCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once, after mount (avoids SSR/client mismatch).
  useEffect(() => {
    const stored = readStoredProgress();
    setCurrentIndex(stored.currentIndex);
    setAnswers(stored.answers);
    setSegmentation(stored.segmentation);
    setIntroCompleted(stored.introCompleted);
    setHydrated(true);
  }, []);

  // Persist on every change, once hydrated.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentIndex,
        answers,
        segmentation,
        introCompleted,
      } satisfies StoredProgress)
    );
  }, [currentIndex, answers, segmentation, introCompleted, hydrated]);

  const setAnswer = useCallback((questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  /**
   * "I'm not sure" / skip: clears any answer for this question so it is
   * excluded from scoring and counted as unanswered for confidence.
   */
  const skipAnswer = useCallback((questionId: string) => {
    setAnswers((prev) => {
      if (!(questionId in prev)) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }, []);

  const setSegmentationField = useCallback((field: keyof Segmentation, value: string) => {
    setSegmentation((prev) => {
      if (!value) {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: value };
    });
  }, []);

  const completeIntro = useCallback(() => {
    setIntroCompleted(true);
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
    setSegmentation({});
    setIntroCompleted(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
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
    setCurrentIndex,
  };
}
