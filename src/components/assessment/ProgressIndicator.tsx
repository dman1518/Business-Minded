import { Progress } from "@/components/ui/progress";

interface ProgressIndicatorProps {
  currentStep: number; // 1-based
  totalSteps: number;
}

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  const percent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <div className="mb-8 w-full">
      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Question {currentStep} of {totalSteps}
        </span>
        <span>{Math.round(percent)}%</span>
      </div>
      <Progress value={percent} aria-label="Assessment progress" />
    </div>
  );
}
