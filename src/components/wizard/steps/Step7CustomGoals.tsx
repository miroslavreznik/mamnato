import { useEffect, useState } from 'react';
import { useWizard } from '../../../store/wizardStore';
import type { CustomGoal } from '../../../types';
import { monthlyDisposable } from '../../../engine/cashflow';
import NumField from '../../ui/NumField';
import StepNavigation from '../StepNavigation';
import { fieldClass } from '../../ui/fieldClass';

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
      <h2 className="text-xl font-semibold text-ink mb-2">Vaše vlastní cíle</h2>
      <p className="text-ink-muted mb-6">
        Na co dalšího šetříte? Zadejte, co chcete, kolik na to potřebujete a za jak dlouho to chcete mít.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-ink-body">Časový horizont v:</span>
        {(['months', 'years'] as const).map((unit) => (
          <button
            key={unit}
            type="button"
            onClick={() => setTimeUnit(unit)}
            className={`px-3 py-1 text-sm rounded-lg ${
              timeUnit === unit
                ? 'bg-tint-brand text-brand'
                : 'text-ink-muted'
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
            <div key={goal.id} className="border border-line rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-ink-label">Cíl #{index + 1}</span>
                {goals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGoal(goal.id)}
                    className="text-danger hover:text-danger text-sm"
                  >
                    Odebrat
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Co chci (název)</label>
                  <input
                    type="text"
                    value={goal.name}
                    onChange={(e) => update(goal.id, 'name', e.target.value)}
                    placeholder="např. Auto, dovolená, rezerva…"
                    className={fieldClass('w-full px-3 py-2 text-sm')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Kolik potřebuji (Kč)</label>
                  <NumField
                    value={goal.targetAmount}
                    onChange={(v) => update(goal.id, 'targetAmount', v)}
                    ariaLabel="Kolik potřebuji"
                    className={fieldClass('w-full px-3 py-2 text-sm')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">
                    Za jak dlouho ({timeUnit === 'months' ? 'měsíců' : 'let'})
                  </label>
                  <NumField
                    value={toDisplay(goal.targetMonths)}
                    onChange={(v) => update(goal.id, 'targetMonths', fromDisplay(v))}
                    min={1}
                    ariaLabel="Za jak dlouho"
                    className={fieldClass('w-full px-3 py-2 text-sm')}
                  />
                </div>
              </div>

              {requiredMonthly > 0 && (
                <p className="mt-3 text-sm text-ink-body">
                  Odpovídá spoření{' '}
                  <span className="font-semibold text-ink">
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
        className="mt-4 px-4 py-2 text-sm text-brand border border-line rounded-lg hover:bg-tint-brand min-h-[44px]"
      >
        + Přidat další cíl
      </button>

      {goals.length > 0 && (
        <div className="mt-5 p-4 rounded-xl bg-sunken text-sm">
          <div className="flex justify-between">
            <span className="text-ink-body">Celkem potřeba měsíčně na cíle:</span>
            <span className="font-semibold text-ink">{totalNeeded.toLocaleString('cs-CZ')} Kč/měs.</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-ink-body">Máte k dispozici:</span>
            <span className="font-semibold text-ink">{Math.round(disposable).toLocaleString('cs-CZ')} Kč/měs.</span>
          </div>
          {overBudget && (
            <p className="mt-2 text-xs text-caution">
              Cíle dohromady potřebují víc, než máte k dispozici. Nevadí, ve výsledcích uvidíte, na které dosáhnete a jak upravit horizont.
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
