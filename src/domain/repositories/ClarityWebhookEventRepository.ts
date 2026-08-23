/**
 * Port: records processed Stripe webhook event IDs, purely as a
 * replay/duplicate-delivery guard. Stripe guarantees at-least-once
 * delivery, so every webhook handler must tolerate (and here,
 * short-circuit) redelivery of an event it already processed.
 */
export interface ClarityWebhookEventRepository {
  /**
   * Atomically records the event as processed. Returns true the FIRST
   * time a given stripeEventId is seen (caller should proceed to apply
   * side effects), and false on any subsequent call with the same ID
   * (caller must no-op). Implementations must rely on a DB unique
   * constraint, not a read-then-write check, to be correct under
   * concurrent webhook deliveries.
   */
  recordIfNew(stripeEventId: string, eventType: string): Promise<boolean>;
}
