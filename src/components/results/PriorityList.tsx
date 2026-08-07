interface PriorityListProps {
  priorities: string[];
}

export function PriorityList({ priorities }: PriorityListProps) {
  return (
    <ol className="flex min-w-0 flex-col gap-3">
      {priorities.map((priority, index) => (
        <li key={index} className="flex min-w-0 items-start gap-3 text-sm">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="min-w-0 break-words text-foreground">{priority}</span>
        </li>
      ))}
    </ol>
  );
}
