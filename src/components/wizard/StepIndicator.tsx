export interface StepItem {
  step: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: StepItem[];
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

export default function StepIndicator({ currentStep, steps, completedSteps, onStepClick }: StepIndicatorProps) {
  const total = steps.length;
  const currentIndex = steps.findIndex((s) => s.step === currentStep);
  const currentLabel = currentIndex >= 0 ? steps[currentIndex].label : '';
  const position = currentIndex >= 0 ? currentIndex + 1 : currentStep;

  return (
    <nav className="mb-8" aria-label="Kroky průvodce">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{currentLabel}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">Krok {position} z {total}</span>
      </div>

      <ol className="flex items-start">
        {steps.map((item, i) => {
          const step = item.step;
          const label = item.label;
          const isCurrent = step === currentStep;
          const isCompleted = completedSteps.includes(step) && !isCurrent;
          const canJump = completedSteps.includes(step) || isCurrent;

          const circleBase = 'relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all';
          const circleCls = isCurrent
            ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 ring-2 ring-blue-600 dark:ring-blue-400'
            : isCompleted
            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500';

          const Circle = canJump ? 'button' : 'div';

          return (
            <li key={step} className={`flex items-start ${i < total - 1 ? 'flex-1' : ''}`}>
              <div className="flex flex-col items-center">
                <Circle
                  {...(canJump
                    ? { type: 'button' as const, onClick: () => onStepClick(step), 'aria-current': isCurrent ? ('step' as const) : undefined }
                    : {})}
                  className={`${circleBase} ${circleCls} ${canJump && !isCurrent ? 'cursor-pointer' : 'cursor-default'}`}
                  aria-label={canJump && !isCurrent ? `${label} — upravit` : label}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    i + 1
                  )}
                </Circle>
                <span className={`hidden sm:block mt-1.5 text-[11px] leading-tight text-center max-w-[76px] ${isCurrent ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                  {label}
                </span>
              </div>
              {i < total - 1 && (
                <div className={`flex-1 h-0.5 mt-4 mx-1.5 rounded-full transition-colors ${completedSteps.includes(step) ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
