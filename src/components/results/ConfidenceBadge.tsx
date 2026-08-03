import { ConfidenceLevel } from "@/domain/entities/Score";
import { cn } from "@/lib/utils";

const STYLES: Record<ConfidenceLevel, string> = {
  High: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-red-100 text-red-700",
};

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        STYLES[level]
      )}
    >
      Confidence: {level}
    </span>
  );
}
