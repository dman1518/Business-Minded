import { ConfidenceLevel } from "@/domain/entities/Score";
import { cn } from "@/lib/utils";

const STYLES: Record<ConfidenceLevel, string> = {
  High: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-red-100 text-red-700",
};

/**
 * Confidence reflects how many questions were answered, not how strong
 * the business is. A low score with high confidence is a well-evidenced
 * low score; a low confidence result just means more answers would
 * sharpen the picture — it is never a judgment on the business itself.
 */
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col items-center gap-1.5 text-center">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
          STYLES[level]
        )}
      >
        Confidence: {level}
      </span>
      <p className="max-w-xs text-xs text-muted-foreground">
        Confidence reflects how many questions you answered — not how strong
        your business is.
      </p>
    </div>
  );
}
