import { Question } from "@/domain/entities/Question";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: Question;
  selectedValue?: number;
  onSelect: (value: number) => void;
}

export function QuestionCard({ question, selectedValue, onSelect }: QuestionCardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">{question.text}</CardTitle>
        {question.helpText ? (
          <p className="text-sm text-muted-foreground">{question.helpText}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div
          className="flex flex-col gap-3"
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
                onClick={() => onSelect(option.value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/5 font-medium text-foreground"
                    : "border-border bg-background hover:border-primary/50 hover:bg-accent"
                )}
              >
                {option.label}
                <span
                  className={cn(
                    "ml-4 h-4 w-4 shrink-0 rounded-full border",
                    selected ? "border-primary bg-primary" : "border-border"
                  )}
                />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
