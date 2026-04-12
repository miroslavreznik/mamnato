interface StepNavigationProps {
  onBack?: () => void;
  onNext: () => void;
  showBack: boolean;
  nextLabel?: string;
  nextDisabled?: boolean;
}

export default function StepNavigation({
  onBack,
  onNext,
  showBack,
  nextLabel = 'Další',
  nextDisabled = false,
}: StepNavigationProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-8 px-6 py-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 flex justify-between">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px]"
        >
          Zpět
        </button>
      ) : (
        <div />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] font-medium"
      >
        {nextLabel}
      </button>
    </div>
  );
}
