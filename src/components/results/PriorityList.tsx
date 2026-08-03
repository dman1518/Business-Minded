interface PriorityListProps {
  priorities: string[];
}

export function PriorityList({ priorities }: PriorityListProps) {
  return (
    <ol className="flex flex-col gap-3">
      {priorities.map((priority, index) => (
        <li key={index} className="flex gap-3 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="text-foreground">{priority}</span>
        </li>
      ))}
    </ol>
  );
}
