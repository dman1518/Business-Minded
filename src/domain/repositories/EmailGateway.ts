export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Port: sends transactional email. Deliberately returns a discriminated
 * result rather than throwing on "not configured" — callers (the
 * webhook handler, the intake route) treat a missing email provider as
 * an expected, non-fatal condition: payment processing and intake
 * submission must succeed independently of whether email is set up.
 * See ResendEmailGateway for the concrete adapter and
 * isResendConfigured() for the "unavailable" check.
 */
export type SendEmailResult = { kind: "sent" } | { kind: "unavailable" } | { kind: "failed"; message: string };

export interface EmailGateway {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
