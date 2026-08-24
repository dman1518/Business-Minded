/**
 * Lazy, safe accessors for Resend configuration — mirrors
 * src/infrastructure/payments/stripeConfig.ts. Absent env vars are a
 * legitimate, expected state (email is optional; see .env.example),
 * never a crash. Callers check isResendConfigured() first and treat
 * "unavailable" as a normal, non-fatal outcome.
 */

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.RESEND_FROM_EMAIL);
}

export function getResendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  return key;
}

export function getResendFromEmail(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not configured.");
  return from;
}

/**
 * Optional recipient for internal "new paying client" alerts (e.g. the
 * business owner's inbox). Distinct from RESEND_FROM_EMAIL, which is
 * the sending address. Null (not configured) means: don't send an
 * internal alert — the business owner relies on the fulfillment view
 * instead. See .env.example.
 */
export function getInternalNotificationEmail(): string | null {
  return process.env.CLARITY_INTERNAL_NOTIFICATION_EMAIL || null;
}
