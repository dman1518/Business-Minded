import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Insight } from "@/domain/value-objects/Insight";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  label: string;
  insight: Insight;
  tone: "positive" | "negative";
}

export function InsightCard({ label, insight, tone }: InsightCardProps) {
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
