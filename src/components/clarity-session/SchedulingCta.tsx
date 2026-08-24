"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface SchedulingCtaProps {
  purchaseId: string;
}

/**
 * Fetches and renders the post-intake scheduling call-to-action.
 * Deliberately three distinct states — loading, real link, and "no
 * provider configured yet" — never a fake or broken link when
 * CLARITY_SESSION_SCHEDULING_URL isn't set. See
 * /api/clarity-session/scheduling-link.
 */
export function SchedulingCta({ purchaseId }: SchedulingCtaProps) {
  const [schedulingUrl, setSchedulingUrl] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/clarity-session/scheduling-link?purchase_id=${encodeURIComponent(purchaseId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: { schedulingUrl: string | null }) => setSchedulingUrl(data.schedulingUrl))
      .catch(() => setFailed(true));
  }, [purchaseId]);

  if (failed) {
    return (
      <p className="text-sm text-muted-foreground">
        We&apos;ll follow up personally to schedule your session.
      </p>
    );
  }

  if (schedulingUrl === undefined) {
    return <p className="text-sm text-muted-foreground">Loading scheduling options…</p>;
  }

  if (schedulingUrl) {
    return (
      <Button asChild size="lg">
        <a href={schedulingUrl} target="_blank" rel="noopener noreferrer">
          Schedule Your Session
        </a>
      </Button>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      We&apos;ll follow up personally within one business day to schedule your session.
    </p>
  );
}
