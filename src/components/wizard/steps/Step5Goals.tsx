import type { ReactNode } from 'react';
import { useWizard } from '../../../store/wizardStore';
import type { FinancialGoal } from '../../../types';
import StepNavigation from '../StepNavigation';

// Obrysové ikony, ne emoji. Emoji se kreslí podle systému, takže vypadají
// na každém zařízení jinak a vedle obrysových ikon ve zbytku appky působí
// jako druhý vizuální jazyk.
const goalOptions: { value: FinancialGoal; label: string; icon: ReactNode }[] = [
  {
    value: 'property',
    label: 'Vlastní bydlení',
    icon: <path d="M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5M9.5 20v-5h5v5" />,
  },
  {
    value: 'child',
    label: 'Dítě / rodina',
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
      </>
    ),
  },
  {
    value: 'retirement',
    label: 'Důchod',
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    value: 'other',
    label: 'Vlastní cíle',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
  },
];

export default function Step5Goals() {
  const { state, dispatch } = useWizard();

  const toggleGoal = (goal: FinancialGoal) => {
    const current = state.goals;
    const updated = current.includes(goal)
      ? current.filter((g) => g !== goal)
      : [...current, goal];
    dispatch({ type: 'SET_GOALS', goals: updated });
  };

  const hasProperty = state.goals.includes('property');
  const hasOther = state.goals.includes('other');

  const handleNext = () => {
    if (hasProperty) {
      dispatch({ type: 'GO_TO_STEP', step: 6 }); // Nemovitost
    } else if (hasOther) {
      dispatch({ type: 'GO_TO_STEP', step: 7 }); // Vlastní cíle
    } else {
      // Žádný krok navíc, rovnou na výsledky
      dispatch({ type: 'GO_TO_STEP', step: 8 });
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-ink mb-2">Vaše finanční cíle</h2>
      <p className="text-ink-muted mb-6">
        Na co šetříte? Vyberte jeden nebo více cílů. Čím víc jich zadáte, tím líp uvidíte,
        jestli se vejdou do jednoho rozpočtu vedle sebe.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {goalOptions.map((g) => {
          const selected = state.goals.includes(g.value);
          return (
            <button
              key={g.value}
              type="button"
              onClick={() => toggleGoal(g.value)}
              aria-pressed={selected}
              data-testid={`goal-${g.value}`}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-colors min-h-[44px] ${
                selected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 bg-white dark:bg-gray-700'
              }`}
            >
              <svg
                className={`w-7 h-7 ${selected ? 'text-brand' : 'text-ink-faint'}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              >
                {g.icon}
              </svg>
              <span className="text-sm font-medium text-ink-label">{g.label}</span>
              {/* Viditelná značka i bez barvy, kvůli tisku a přístupnosti. */}
              <span className={`text-xs ${selected ? 'text-brand' : 'text-transparent'}`}>
                {selected ? '✓ vybráno' : 'nevybráno'}
              </span>
            </button>
          );
        })}
      </div>

      <StepNavigation
        showBack={true}
        onBack={() => dispatch({ type: 'PREV_STEP' })}
        onNext={handleNext}
        nextLabel={hasProperty || hasOther ? 'Další' : 'Zobrazit výsledky'}
        nextDisabled={state.goals.length === 0}
      />
    </div>
  );
}
