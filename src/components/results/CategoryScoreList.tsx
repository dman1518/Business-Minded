import { CategoryScore } from "@/domain/entities/Score";
import { Progress } from "@/components/ui/progress";

interface CategoryScoreListProps {
  categoryScores: CategoryScore[];
}

export function CategoryScoreList({ categoryScores }: CategoryScoreListProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {categoryScores.map((category) => (
        <div key={category.categoryId} className="min-w-0">
          <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium text-foreground">{category.categoryName}</span>
            <span className="shrink-0 whitespace-nowrap text-muted-foreground">{category.score}</span>
          </div>
          <Progress value={category.score} aria-label={`${category.categoryName} score`} />
        </div>
      ))}
    </div>
  );
}
