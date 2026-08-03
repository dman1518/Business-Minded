import { CategoryScore } from "@/domain/entities/Score";
import { Progress } from "@/components/ui/progress";

interface CategoryScoreListProps {
  categoryScores: CategoryScore[];
}

export function CategoryScoreList({ categoryScores }: CategoryScoreListProps) {
  return (
    <div className="flex flex-col gap-4">
      {categoryScores.map((category) => (
        <div key={category.categoryId}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{category.categoryName}</span>
            <span className="text-muted-foreground">{category.score}</span>
          </div>
          <Progress value={category.score} aria-label={`${category.categoryName} score`} />
        </div>
      ))}
    </div>
  );
}
