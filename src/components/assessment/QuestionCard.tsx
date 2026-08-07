import { Question } from "@/domain/entities/Question";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: Question;
  selectedValue?: number;
  onSelect: (value: number) => void;
  onSkip: () => void;
  disabled?: boolean;
}

export function QuestionCard({
  question,
  selectedValue,
  onSelect,
  onSkip,
  disabled = false,
}: QuestionCardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="break-words text-xl sm:text-2xl">{question.text}</CardTitle>
        {question.helpText ? (
          <p className="min-w-0 break-words text-sm text-muted-foreground">{question.helpText}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div
          className="flex min-w-0 flex-col gap-3"
          role="radiogroup"
          aria-label={question.text}
        >
          {question.options.map((option) => {
            const selected = selectedValue === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onSelect(option.value)}
                className={cn(
                  "flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  selected
                    ? "border-primary bg-primary/5 font-medium text-foreground"
                    : "border-border bg-background hover:border-primary/50 hover:bg-accent"
                )}
              >
                <span className="min-w-0 break-words">{option.label}</span>
                <span
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full border",
                    selected ? "border-primary bg-primary" : "border-border"
                  )}
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          className={cn(
            "mt-4 break-words text-left text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60",
            selectedValue === undefined && "font-medium text-foreground"
          )}
        >
          I&apos;m not sure / skip this question
        </button>
      </CardContent>
    </Card>
  );
}
