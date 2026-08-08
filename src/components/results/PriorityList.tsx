import { PriorityItem } from "@/domain/entities/Score";

interface PriorityListProps {
  priorities: PriorityItem[];
}

export function PriorityList({ priorities }: PriorityListProps) {
  return (
    <ol className="flex min-w-0 flex-col gap-5">
      {priorities.map((priority, index) => (
        <li key={`${priority.categoryId}-${index}`} className="flex min-w-0 items-start gap-3 text-sm">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="min-w-0 break-words font-medium text-foreground">{priority.action}</p>
            <p className="min-w-0 break-words text-muted-foreground">
              <span className="font-medium text-foreground">Why it matters: </span>
              {priority.whyItMatters}
            </p>
            <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="min-w-0 break-words">
                <span className="font-medium text-foreground">Suggested timeframe: </span>
                {priority.timeframe}
              </span>
              <span className="min-w-0 break-words">
                <span className="font-medium text-foreground">Affects: </span>
                {priority.categoryName}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
