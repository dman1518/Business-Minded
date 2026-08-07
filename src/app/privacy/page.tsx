import { CURRENT_PRIVACY_POLICY_VERSION } from "@/domain/policies/PrivacyPolicy";

export const metadata = {
  title: "Privacy Policy — Business Minded",
};

/**
 * Sprint 1 placeholder privacy notice, written in plain language for the
 * public validation launch. Replace with counsel-reviewed copy before a
 * general-availability launch. Bump CURRENT_PRIVACY_POLICY_VERSION
 * whenever this copy materially changes — that version tag is stored
 * with every lead's consent record.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <div>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Policy version {CURRENT_PRIVACY_POLICY_VERSION}
        </p>
      </div>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Business Minded (&ldquo;we&rdquo;) offers a free Business Health Check assessment.
          This page explains what we collect and how we use it.
        </p>

        <h2 className="text-base font-medium text-foreground">What we collect</h2>
        <p>
          When you complete the assessment, we store your answers and the resulting
          score so we can generate your report. When you request your report, we
          also collect your first name, email address, and company name.
        </p>

        <h2 className="text-base font-medium text-foreground">How we use it</h2>
        <p>
          We use your answers to calculate your Business Minded Score and generate
          your personalized report. We use your contact details to deliver that
          report and to follow up about your results. We do not sell your
          information to third parties.
        </p>

        <h2 className="text-base font-medium text-foreground">No account required</h2>
        <p>
          The assessment is anonymous until you choose to request a report — no
          account or sign-up is required to take the Health Check.
        </p>

        <h2 className="text-base font-medium text-foreground">Your choices</h2>
        <p>
          You can request that we delete your captured contact details and
          associated report at any time by emailing us. Deleting your details does
          not affect your anonymous assessment answers, which are not linked to
          your identity unless you submitted the lead-capture form.
        </p>

        <h2 className="text-base font-medium text-foreground">Contact</h2>
        <p>
          Questions about this policy? Contact us at privacy@businessminded.com.
        </p>
      </section>
    </main>
  );
}
