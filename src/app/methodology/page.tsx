export const metadata = {
  title: "Methodology — Business Minded",
};

/**
 * Plain-language explanation of how the Business Minded Score is
 * calculated, per the locked v1 framework. Kept in sync by hand with
 * scoring-rules.json and RequiredCategories.ts — if those change, this
 * copy needs to change with them.
 */
export default function MethodologyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <div>
        <h1 className="text-2xl font-semibold">Methodology</h1>
        <p className="mt-1 text-sm text-muted-foreground">How your Business Minded Score is calculated.</p>
      </div>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          The Business Minded Score comes from 10 questions covering five equally weighted
          dimensions of your business: Money, Operations, Growth, Freedom, and Resilience. Each
          dimension gets two questions and is scored out of 20 points; the five dimension scores
          always add up to your overall score out of 100.
        </p>

        <h2 className="text-base font-medium text-foreground">The five dimensions</h2>
        <p>
          <span className="font-medium text-foreground">Money</span> — whether your business is
          creating the financial results you need.{" "}
          <span className="font-medium text-foreground">Operations</span> — whether your business
          executes consistently, independent of who&apos;s doing the work.{" "}
          <span className="font-medium text-foreground">Growth</span> — whether you have a
          repeatable way to bring in new customers.{" "}
          <span className="font-medium text-foreground">Freedom</span> — whether the business
          depends on you personally or can run without you.{" "}
          <span className="font-medium text-foreground">Resilience</span> — whether you could
          absorb a serious setback without real trouble.
        </p>

        <h2 className="text-base font-medium text-foreground">How a dimension is scored</h2>
        <p>
          Each question is answered on a 1–5 scale. A dimension&apos;s two answers are averaged,
          normalized to a 0–20 scale, and rounded. If you skip both questions in a dimension, that
          dimension scores 0 and is marked &ldquo;Insufficient data&rdquo; instead of being treated
          as a measured weakness — it simply means we don&apos;t have evidence for that dimension
          yet, and it&apos;s excluded from your results&apos; constraint, opportunity, and priority
          picks.
        </p>

        <h2 className="text-base font-medium text-foreground">What the results mean</h2>
        <p>
          Your <span className="font-medium text-foreground">biggest constraint</span> is your
          lowest-scoring dimension with real answers behind it. Your{" "}
          <span className="font-medium text-foreground">biggest opportunity</span> is the
          next-lowest — the most attainable near-term win. Your{" "}
          <span className="font-medium text-foreground">top three priorities</span> are drawn from
          your three lowest-scoring dimensions, each with a concrete action, why it matters, and a
          suggested timeframe.
        </p>

        <h2 className="text-base font-medium text-foreground">Assessment completeness</h2>
        <p>
          The &ldquo;Assessment completeness&rdquo; indicator reflects only how many of the 10
          questions you answered — not how strong or weak your business is. It has nothing to do
          with your score.
        </p>

        <h2 className="text-base font-medium text-foreground">What this is — and isn&apos;t</h2>
        <p>
          This is an initial diagnostic meant to point you toward where to focus next, based
          entirely on your own self-reported answers. It is not a formal business valuation, an
          accounting opinion, or financial or investment advice, and it hasn&apos;t been verified
          against your actual financial records. For decisions with real financial or legal
          consequences, consult a qualified professional.
        </p>
      </section>
    </main>
  );
}
