import { CategoryScore, CategoryStatus } from "@/domain/entities/Score";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface CategoryScoreListProps {
  categoryScores: CategoryScore[];
}

const STATUS_STYLES: Record<CategoryStatus, string> = {
  Strength: "bg-emerald-100 text-emerald-700",
  Developing: "bg-amber-100 text-amber-700",
  Constraint: "bg-red-100 text-red-700",
  "Insufficient data": "bg-slate-100 text-slate-600",
};

export function CategoryScoreList({ categoryScores }: CategoryScoreListProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {categoryScores.map((category) => (
        <div key={category.categoryId} className="min-w-0">
          <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
            <span className="min-w-0 truncate font-medium text-foreground">{category.categoryName}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                  STATUS_STYLES[category.status]
                )}
              >
                {category.status}
              </span>
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">{category.score} / 20</span>
            </div>
          </div>
          <Progress
            value={(category.score / 20) * 100}
            aria-label={`${category.categoryName} score: ${category.score} out of 20, ${category.status}`}
          />
        </div>
      ))}
    </div>
  );
}
