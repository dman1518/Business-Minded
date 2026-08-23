import { ClarityWebhookEventRepository } from "@/domain/repositories/ClarityWebhookEventRepository";
import { prisma } from "@/infrastructure/db/prisma";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

/**
 * Adapter: records processed Stripe webhook event IDs via a DB unique
 * constraint (see clarity_webhook_events in prisma/schema.prisma).
 * Relies on the constraint itself — not a prior read — to be correct
 * under concurrent/duplicate webhook deliveries.
 */
export class PrismaClarityWebhookEventRepository implements ClarityWebhookEventRepository {
  async recordIfNew(stripeEventId: string, eventType: string): Promise<boolean> {
    try {
      await prisma.clarityWebhookEvent.create({
        data: { stripeEventId, eventType },
      });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }
}
