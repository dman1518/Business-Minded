"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Fires the `landing_viewed` analytics event on mount. A tiny client
 * island so the landing page itself can stay a server component (fast
 * first paint, no client JS required to render the hero).
 */
export function LandingViewedTracker() {
  useEffect(() => {
    trackEvent({ name: "landing_viewed" });
  }, []);

  return null;
}
