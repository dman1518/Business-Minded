"use client";

import { track } from "@vercel/analytics";

/**
 * Analytics event catalog for Business Minded.
 *
 * Every event and its allowed properties are declared here as a single
 * discriminated union, so a call site can't invent a new event name or
 * attach an unexpected property by accident — TypeScript enforces the
 * shape at the call site.
 *
 * Hard rule: NEVER include answer text, selected option labels, or any
 * personal information (name, email, company, website) in analytics
 * properties. Only structural signals are allowed — assessment id,
 * question number, dimension (category id), device category, and
 * timestamp — never the content of what someone typed or chose.
 * Vercel Analytics property values must also be flat primitives
 * (string/number/boolean/null) — never a nested object.
 */

export type DeviceCategory = "mobile" | "tablet" | "desktop";

function getDeviceCategory(): DeviceCategory {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

type AnalyticsEvent =
  | { name: "landing_viewed" }
  | { name: "assessment_started" }
  | { name: "question_viewed"; questionNumber: number; dimension: string }
  | { name: "question_answered"; questionNumber: number; dimension: string }
  | { name: "question_skipped"; questionNumber: number; dimension: string }
  | { name: "assessment_completed"; assessmentId: string }
  | { name: "results_viewed"; assessmentId: string }
  | { name: "report_cta_clicked"; assessmentId: string }
  | { name: "lead_form_started"; assessmentId: string }
  | { name: "lead_submitted"; assessmentId: string }
  | { name: "report_generated"; assessmentId: string }
  | { name: "report_delivered"; assessmentId: string }
  | { name: "assessment_retake_started"; assessmentId?: string };

/**
 * Fires a named analytics event via Vercel Web Analytics, automatically
 * attaching `device` and `timestamp` to every event. Silently caught —
 * a failed analytics beacon (blocked by an ad blocker, offline, etc.)
 * must never break the user-facing flow it's attached to.
 */
export function trackEvent(event: AnalyticsEvent): void {
  try {
    const { name, ...rest } = event;
    track(name, {
      ...rest,
      device: getDeviceCategory(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Analytics must never break the app.
  }
}
