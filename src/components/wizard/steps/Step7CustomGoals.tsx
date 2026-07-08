import { useEffect, useState } from 'react';
import { useWizard } from '../../../store/wizardStore';
import type { CustomGoal } from '../../../types';
import { monthlyDisposable } from '../../../engine/cashflow';
import StepNavigation from '../StepNavigation';

let nextId = 1;
function makeId() {
  return `goal-${Date.now()}-${nextId++}`;
}
function newGoal(): CustomGoal {
  return { id: makeId(), name: '', targetAmount: 300000, targetMonths: 24 };
}

export default function Step7CustomGoals() {
  const { state, dispatch } = useWizard();
  const goals = state.customGoals ?? [];
  const disposable = monthlyDisposable(state);
  const [timeUnit, setTimeUnit] = useState<'months' | 'years'>('months');

  // Při vstupu do kroku vždy nabídneme aspoň jeden prázdný cíl k vyplnění.
  useEffect(() => {
    if (!state.customGoals || state.customGoals.length === 0) {
      dispatch({ type: 'UPDATE_CUSTOM_GOALS', goals: [newGoal()] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setGoals = (g: CustomGoal[]) => dispatch({ type: 'UPDATE_CUSTOM_GOALS', goals: g });
  const update = (id: string, field: keyof CustomGoal, value: string | number) =>
    setGoals(goals.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  const addGoal = () => setGoals([...goals, newGoal()]);
  const removeGoal = (id: string) => setGoals(goals.filter((g) => g.id !== id));

  const toDisplay = (months: number) => (timeUnit === 'years' ? Math.max(1, Math.round(months / 12)) : months);
  const fromDisplay = (value: number) => (timeUnit === 'years' ? Math.max(1, value) * 12 : Math.max(1, value));

  const totalNeeded = goals.reduce(
    (sum, g) => sum + (g.targetMonths > 0 ? Math.ceil(g.targetAmount / g.targetMonths) : 0),
    0
  );
  const overBudget = totalNeeded > disposable && disposable > 0;

  const hasProperty = state.goals.includes('property');

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Vaše vlastní cíle</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        Na co dalšího šetříte? Zadejte, co chcete, kolik na to potřebujete a za jak dlouho to chcete mít.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-600 dark:text-gray-400">Časový horizont v:</span>
        {(['months', 'years'] as const).map((unit) => (
          <button
            key={unit}
            type="button"
            onClick={() => setTimeUnit(unit)}
            className={`px-3 py-1 text-sm rounded-lg ${
              timeUnit === unit
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {unit === 'months' ? 'Měsících' : 'Letech'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {goals.map((goal, index) => {
          const months = goal.targetMonths;
          const requiredMonthly = months > 0 ? Math.ceil(goal.targetAmount / months) : 0;
          return (
            <div key={goal.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cíl #{index + 1}</span>
                {goals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGoal(goal.id)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    Odebrat
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Co chci (název)</label>
                  <input
                    type="text"
                    value={goal.name}
                    onChange={(e) => update(goal.id, 'name', e.target.value)}
                    placeholder="např. Auto, dovolená, rezerva…"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Kolik potřebuji (Kč)</label>
                  <input
                    type="number"
                    value={goal.targetAmount}
                    min={0}
                    step={10000}
                    onChange={(e) => update(goal.id, 'targetAmount', Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Za jak dlouho ({timeUnit === 'months' ? 'měsíců' : 'let'})
                  </label>
                  <input
                    type="number"
                    value={toDisplay(goal.targetMonths)}
                    min={1}
                    onChange={(e) => update(goal.id, 'targetMonths', fromDisplay(Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                  />
                </div>
              </div>

              {requiredMonthly > 0 && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  Odpovídá spoření{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {requiredMonthly.toLocaleString('cs-CZ')} Kč/měs.
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addGoal}
        className="mt-4 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 min-h-[44px]"
      >
        + Přidat další cíl
      </button>

      {goals.length > 0 && (
        <div className="mt-5 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Celkem potřeba měsíčně na cíle:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{totalNeeded.toLocaleString('cs-CZ')} Kč/měs.</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-600 dark:text-gray-400">Máte k dispozici:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{Math.round(disposable).toLocaleString('cs-CZ')} Kč/měs.</span>
          </div>
          {overBudget && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Cíle dohromady potřebují víc, než máte k dispozici. Nevadí — ve výsledcích uvidíte, na které dosáhnete a jak upravit horizont.
            </p>
          )}
        </div>
      )}

      <StepNavigation
        showBack={true}
        onBack={() => dispatch({ type: 'GO_TO_STEP', step: hasProperty ? 6 : 5 })}
        onNext={() => dispatch({ type: 'GO_TO_STEP', step: 8 })}
        nextLabel="Zobrazit výsledky"
      />
    </div>
  );
}
