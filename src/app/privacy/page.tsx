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
 *
 * NOTE (flagged for product-owner / legal review, not resolved by this
 * copy): the retention-duration and third-party-processor language
 * below is intentionally conservative and un-promised, because no
 * automated retention or deletion-schedule job exists yet. Do not
 * strengthen these statements without either building that
 * functionality first or getting counsel sign-off on the exact wording.
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
          When you complete the assessment, we store your answers and the resulting score so we
          can generate your report. If you choose, you can also tell us your industry, company
          size, and revenue range before starting — these three fields are optional, never affect
          your score, and are used only to help us understand who is using this tool.
        </p>
        <p>
          When you request your full report, we additionally collect your first name and email
          address (both required), and your company name and website (both optional).
        </p>

        <h2 className="text-base font-medium text-foreground">How we use it</h2>
        <p>
          We use your answers to calculate your Business Minded Score and generate your
          personalized report. We ask for three separate permissions when you request your
          report, and only the first is required:
        </p>
        <ul className="list-disc pl-5">
          <li>Processing your submitted details to create and unlock your report (required).</li>
          <li>
            Personally following up with you about your specific results (optional — only if
            you check that box).
          </li>
          <li>
            Sending occasional general tips and updates (optional and separate from the above —
            only if you check that box).
          </li>
        </ul>
        <p>
          Your report is generated as a PDF you download immediately in your browser — we do not
          currently email it to you, even though you&apos;ve given us your email address. We do
          not sell your information to third parties.
        </p>

        <h2 className="text-base font-medium text-foreground">No account required</h2>
        <p>
          The assessment is anonymous until you choose to request a report — no account or
          sign-up is required to take the Health Check.
        </p>

        <h2 className="text-base font-medium text-foreground">Your results link</h2>
        <p>
          Your results page is accessible to anyone who has the exact link — it is not protected
          by a password or account login. The link is not published or indexed anywhere by us, and
          its id is not sequential or otherwise guessable, but if you share the link with someone
          else, they will be able to view your results. Avoid sharing it publicly if you&apos;d
          rather keep your results private.
        </p>

        <h2 className="text-base font-medium text-foreground">How long we keep data</h2>
        <p>
          We do not currently have an automated data-retention schedule. In practice, we retain
          assessment answers and any contact details you submit for as long as we operate this
          tool, or until you ask us to delete them (see below). We expect to introduce a formal
          retention policy with a defined deletion timeline in a future update.
        </p>

        <h2 className="text-base font-medium text-foreground">Your choices</h2>
        <p>
          You can ask us to delete your captured contact details (name, email, company, website,
          and consent records) at any time by emailing us. Deleting your contact details does not
          delete your underlying assessment answers or score — those are not linked to your
          identity once your contact details are removed, since nothing else in that record
          identifies you. If you&apos;d like your assessment answers deleted as well, tell us the
          results link and we&apos;ll remove that too.
        </p>

        <h2 className="text-base font-medium text-foreground">Contact</h2>
        <p>
          Questions about this policy? Contact us at privacy@businessminded.com.
        </p>
      </section>
    </main>
  );
}
