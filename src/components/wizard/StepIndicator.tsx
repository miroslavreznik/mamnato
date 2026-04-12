interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
}

export default function StepIndicator({ currentStep, totalSteps, completedSteps }: StepIndicatorProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">Krok {currentStep} z {totalSteps}</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isCompleted = completedSteps.includes(step);
          const isCurrent = step === currentStep;
          return (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                isCurrent
                  ? 'bg-blue-600'
                  : isCompleted
                  ? 'bg-blue-300'
                  : 'bg-gray-200 dark:bg-gray-600'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
