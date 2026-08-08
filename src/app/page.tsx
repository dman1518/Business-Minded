import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LandingViewedTracker } from "@/components/layout/LandingViewedTracker";

/**
 * Landing Page — server component; the hero itself needs no client JS
 * to render, so first paint is as fast as the static HTML shell. Only
 * the tiny LandingViewedTracker island is client-side, for analytics.
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16 sm:px-6 sm:py-24">
      <LandingViewedTracker />
      <div className="mx-auto flex min-w-0 max-w-2xl flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center rounded-full border border-border bg-white/60 px-4 py-1 text-xs font-medium tracking-wide text-muted-foreground">
          BUSINESS MINDED
        </span>

        <h1 className="break-words text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          Discover the one constraint limiting your business—and the three
          actions that can create more money and freedom.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Get your Business Minded Score and a personalized action plan built from your answers —
          free, private, and ready in minutes.
        </p>

        <p className="mt-4 text-sm font-medium tracking-wide text-muted-foreground">
          Free &bull; 2 minutes &bull; 10 questions
        </p>

        <div className="mt-10">
          <Button asChild size="lg">
            <Link href="/assessment">Start Assessment</Link>
          </Button>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
