interface OverallScoreProps {
  score: number;
}

export function OverallScore({ score }: OverallScoreProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Business Minded Score
      </span>
      <div className="mt-2 flex min-w-0 flex-wrap items-baseline justify-center gap-2">
        <span className="text-5xl font-semibold tracking-tight text-primary sm:text-6xl">{score}</span>
        <span className="text-xl text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
