/**
 * Minimal structured server-side error logger.
 *
 * Public-launch requirement: API routes must return generic error
 * messages to clients (no stack traces, no internal details) while
 * still capturing enough detail server-side to debug an incident.
 * This is intentionally dependency-free for Sprint 1 — swap the
 * `console.error` call for a real log shipper (e.g. pino + a log
 * drain) without touching any call site.
 */
export function logError(context: string, error: unknown, meta: Record<string, unknown> = {}): void {
  const entry = {
    level: "error",
    timestamp: new Date().toISOString(),
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...meta,
  };

  // eslint-disable-next-line no-console -- intentional structured server log
  console.error(JSON.stringify(entry));
}

export function logWarning(context: string, message: string, meta: Record<string, unknown> = {}): void {
  const entry = {
    level: "warn",
    timestamp: new Date().toISOString(),
    context,
    message,
    ...meta,
  };

  // eslint-disable-next-line no-console -- intentional structured server log
  console.warn(JSON.stringify(entry));
}
