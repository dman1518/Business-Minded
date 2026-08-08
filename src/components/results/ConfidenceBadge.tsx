import { ConfidenceLevel } from "@/domain/entities/Score";
import { cn } from "@/lib/utils";

const STYLES: Record<ConfidenceLevel, string> = {
  High: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-red-100 text-red-700",
};

/**
 * Displayed to users as "Assessment completeness" rather than
 * "Confidence" -- the current calculation reflects only how many
 * questions were answered, not evidence quality, answer consistency,
 * or available business data. "Confidence" is reserved for a future
 * version whose calculation actually incorporates those signals; using
 * that word today would overstate what this number means. The
 * underlying domain type/field name (ConfidenceLevel /
 * result.confidenceLevel) is unchanged -- this is a display-copy-only
 * rename, not a recalculation.
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
        Assessment completeness: {level}
      </span>
      <p className="max-w-xs text-xs text-muted-foreground">
        Reflects how many questions you answered — not how strong your
        business is.
      </p>
    </div>
  );
}
