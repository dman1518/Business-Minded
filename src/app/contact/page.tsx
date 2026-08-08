export const metadata = {
  title: "Contact — Business Minded",
};

export default function ContactPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <div>
        <h1 className="text-2xl font-semibold">Contact</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Questions about your results, this beta, or anything else — we&apos;d like to hear from
          you.
        </p>
      </div>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Email us at{" "}
          <a
            href="mailto:hello@businessminded.com"
            className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
          >
            hello@businessminded.com
          </a>{" "}
          and we&apos;ll get back to you as soon as we can.
        </p>
        <p>
          For questions specifically about how we handle your data, see our{" "}
          <a href="/privacy" className="font-medium text-foreground underline underline-offset-2 hover:text-primary">
            privacy policy
          </a>{" "}
          or reach out to{" "}
          <a
            href="mailto:privacy@businessminded.com"
            className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
          >
            privacy@businessminded.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
