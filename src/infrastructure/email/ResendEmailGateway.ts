import { EmailGateway, SendEmailInput, SendEmailResult } from "@/domain/repositories/EmailGateway";
import { isResendConfigured, getResendApiKey, getResendFromEmail } from "@/infrastructure/email/resendConfig";
import { logError } from "@/infrastructure/logging/logger";

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Adapter: sends email via Resend's REST API using a plain `fetch`
 * call rather than the `resend` npm package — this avoids adding
 * another dependency that would need a matching package-lock.json
 * entry (see the CI/lockfile note on the `stripe` dependency's own
 * commit for why that's been a real constraint in this environment).
 * Resend's API is a simple POST with a JSON body, so no SDK is needed.
 */
export class ResendEmailGateway implements EmailGateway {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!isResendConfigured()) {
      return { kind: "unavailable" };
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getResendApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: getResendFromEmail(),
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return { kind: "failed", message: `Resend API returned ${response.status}: ${body}` };
      }

      return { kind: "sent" };
    } catch (error) {
      logError("resend.send_failed", error, {});
      return { kind: "failed", message: error instanceof Error ? error.message : String(error) };
    }
  }
}
