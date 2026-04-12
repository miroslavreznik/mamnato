import { useWizard } from '../../../store/wizardStore';
import type { FinancialGoal } from '../../../types';
import StepNavigation from '../StepNavigation';

const goalOptions: { value: FinancialGoal; label: string; icon: string }[] = [
  { value: 'property', label: 'Nemovitost', icon: '🏠' },
  { value: 'child', label: 'Dítě / rodina', icon: '👶' },
  { value: 'retirement', label: 'Důchod / stáří', icon: '🏖️' },
  { value: 'other', label: 'Jiné', icon: '🎯' },
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

  const handleNext = () => {
    if (hasProperty) {
      dispatch({ type: 'NEXT_STEP' });
    } else {
      // Skip Step 6 (property) and go straight to results
      dispatch({ type: 'GO_TO_STEP', step: 7 });
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Vaše finanční cíle</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Na co šetříte? Vyberte jeden nebo více cílů.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {goalOptions.map((g) => {
          const selected = state.goals.includes(g.value);
          return (
            <button
              key={g.value}
              type="button"
              onClick={() => toggleGoal(g.value)}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-colors min-h-[44px] ${
                selected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 bg-white dark:bg-gray-700'
              }`}
            >
              <span className="text-2xl">{g.icon}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{g.label}</span>
            </button>
          );
        })}
      </div>

      <StepNavigation
        showBack={true}
        onBack={() => dispatch({ type: 'PREV_STEP' })}
        onNext={handleNext}
        nextDisabled={state.goals.length === 0}
      />
    </div>
  );
}
