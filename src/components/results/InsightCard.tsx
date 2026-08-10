import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Insight } from "@/domain/value-objects/Insight";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  label: string;
  insight: Insight | null;
  tone: "positive" | "negative";
  /** Shown instead of a card when insight is null and there's no eligible dimension for this role (distinct from a tie — see ResultsContent). */
  emptyMessage?: string;
}

export function InsightCard({ label, insight, tone, emptyMessage }: InsightCardProps) {
  if (!insight) {
    return (
      <Card className="min-w-0 border-dashed">
        <CardHeader className="min-w-0 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        </CardHeader>
        <CardContent className="min-w-0">
          <p className="min-w-0 break-words text-sm text-muted-foreground">
            {emptyMessage ?? "Not enough distinct data yet to call this out on its own."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="min-w-0 pb-2">
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            tone === "positive" ? "text-emerald-600" : "text-amber-600"
          )}
        >
          {label}
        </span>
        <CardTitle className="break-words text-base sm:text-lg">{insight.headline}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <p className="min-w-0 break-words text-sm text-muted-foreground">{insight.description}</p>
      </CardContent>
    </Card>
  );
}
