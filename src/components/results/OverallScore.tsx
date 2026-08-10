import { ScoreDisplay } from "@/domain/entities/Score";

interface OverallScoreProps {
  scoreDisplay: ScoreDisplay;
}

/**
 * Renders the headline Business Minded Score.
 *
 * When scoreDisplay.suppressed is true (fewer than three of five
 * dimensions have any evidence), no number is shown at all — showing a
 * low-looking number built from mostly-unanswered dimensions is exactly
 * the sparse-data bug this component exists to avoid. When a value IS
 * shown but not every question was answered, the "Based on X of Y
 * answers" disclosure stays visible so the number is never mistaken for
 * a fully-informed score.
 */
export function OverallScore({ scoreDisplay }: OverallScoreProps) {
  const isPartial = scoreDisplay.answeredQuestionCount < scoreDisplay.totalQuestionCount;

  if (scoreDisplay.suppressed || scoreDisplay.value === null) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Business Minded Score
        </span>
        <div className="mt-2 max-w-xs">
          <span className="text-2xl font-semibold tracking-tight text-foreground">Not enough answers yet</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Based on {scoreDisplay.answeredQuestionCount} of {scoreDisplay.totalQuestionCount} answers. Answer
          more questions to see your score.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Business Minded Score
      </span>
      <div className="mt-2 flex min-w-0 flex-wrap items-baseline justify-center gap-2">
        <span className="text-5xl font-semibold tracking-tight text-primary sm:text-6xl">
          {scoreDisplay.value}
        </span>
        <span className="text-xl text-muted-foreground">/ 100</span>
      </div>
      {isPartial && (
        <p className="mt-2 text-xs text-muted-foreground">
          Based on {scoreDisplay.answeredQuestionCount} of {scoreDisplay.totalQuestionCount} answers.
        </p>
      )}
    </div>
  );
}
