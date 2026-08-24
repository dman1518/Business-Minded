import { formatCurrency } from "@/lib/formatCurrency";

export interface ReceiptEmailInput {
  amountMinorUnits: number;
  currency: string;
  intakeUrl: string;
}

/**
 * Purchase receipt sent to the customer once the Stripe webhook
 * confirms payment. Deliberately minimal — no upsell copy, no
 * marketing — just confirmation of what they paid and the one action
 * they need to take next.
 */
export function buildReceiptEmail(input: ReceiptEmailInput): { subject: string; html: string; text: string } {
  const amount = formatCurrency(input.amountMinorUnits, input.currency);
  const subject = `You're booked: Business Clarity Session (${amount})`;
  const text = `Thanks for booking your Business Clarity Session.\n\nAmount paid: ${amount}\n\nNext step: complete a short pre-session intake so we can prepare.\n${input.intakeUrl}\n\nQuestions? Just reply to this email.`;
  const html = `
    <p>Thanks for booking your Business Clarity Session.</p>
    <p><strong>Amount paid:</strong> ${amount}</p>
    <p><strong>Next step:</strong> complete a short pre-session intake so we can prepare.</p>
    <p><a href="${input.intakeUrl}">Start your intake</a></p>
    <p>Questions? Just reply to this email.</p>
  `.trim();
  return { subject, html, text };
}

export interface InternalAlertEmailInput {
  purchaseId: string;
  customerEmail: string | null;
  amountMinorUnits: number;
  currency: string;
  fulfillmentUrl: string;
}

/**
 * Internal "a client just completed intake" alert, sent to whoever is
 * configured via CLARITY_INTERNAL_NOTIFICATION_EMAIL (see
 * resendConfig.ts). Links to the internal fulfillment view rather than
 * including intake answers inline, so intake content only ever lives
 * behind the shared-secret-gated view, never in an email inbox.
 */
export function buildInternalAlertEmail(
  input: InternalAlertEmailInput
): { subject: string; html: string; text: string } {
  const amount = formatCurrency(input.amountMinorUnits, input.currency);
  const customer = input.customerEmail ?? "(no email on file)";
  const subject = `New Clarity Session intake: ${customer}`;
  const text = `A client completed intake for their Business Clarity Session.\n\nCustomer: ${customer}\nAmount paid: ${amount}\nPurchase ID: ${input.purchaseId}\n\nView details: ${input.fulfillmentUrl}`;
  const html = `
    <p>A client completed intake for their Business Clarity Session.</p>
    <p><strong>Customer:</strong> ${customer}<br/>
       <strong>Amount paid:</strong> ${amount}<br/>
       <strong>Purchase ID:</strong> ${input.purchaseId}</p>
    <p><a href="${input.fulfillmentUrl}">View details</a></p>
  `.trim();
  return { subject, html, text };
}
