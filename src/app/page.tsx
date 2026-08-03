import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Landing Page — server component, no client JS required to render
 * the hero, so first paint is as fast as the static HTML shell.
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center rounded-full border border-border bg-white/60 px-4 py-1 text-xs font-medium tracking-wide text-muted-foreground">
          BUSINESS MINDED
        </span>

        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          Know what&apos;s holding your business back.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Answer a few questions and receive your Business Minded Score along
          with personalized recommendations to increase business value and
          reduce owner dependence.
        </p>

        <div className="mt-10">
          <Button asChild size="lg">
            <Link href="/assessment">Start Assessment</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
