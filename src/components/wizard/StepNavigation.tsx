/**
 * Spodní lišta průvodce: zpět a další.
 *
 * `data-testid` jsou tu schválně. Tlačítko „Další" se na posledním kroku
 * jmenuje „Zobrazit výsledky" a e2e testy ho hledaly podle názvu na jednadvaceti
 * místech. Redesign, který popisek nebo ikonu změní, by je shodil všechny,
 * přitom o navigaci nic neříkají. Kotva na chování je odolnější než na text.
 */
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
    <div className="sticky bottom-0 z-10 -mx-6 sm:-mx-8 mt-8 px-6 sm:px-8 py-4 bg-card/90 backdrop-blur border-t border-line flex justify-between items-center gap-3 rounded-b-2xl">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          data-testid="wizard-back"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-ink-body rounded-xl hover:bg-sunken transition-colors min-h-[44px] font-medium"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          Zpět
        </button>
      ) : (
        <div />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        data-testid="wizard-next"
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-ink text-page hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all active:scale-[0.98] min-h-[44px] font-semibold"
      >
        {nextLabel}
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </div>
  );
}
