import { useState, useMemo } from 'react';
import type { WizardState, CustomGoal } from '../../types';
import { monthlyDisposable } from '../../engine/cashflow';
import { allocateGoals } from '../../engine/savings';
import type { GoalAllocation } from '../../engine/savings';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props {
  state: WizardState;
}

let nextId = 1;
function makeId() {
  return `goal-${Date.now()}-${nextId++}`;
}

function toggleInSet(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

function StatusBadge({ alloc }: { alloc: GoalAllocation }) {
  const configs = [
    { show: alloc.monthlyAllocation <= 0, label: 'Nestačí prostředky', colors: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
    { show: !alloc.achievable, label: 'Potřebuje více času', colors: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
    { show: true, label: 'Dosažitelný', colors: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  ];
  const { label, colors } = configs.find((c) => c.show)!;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}

function GoalSummaryPanel({ disposable, totalAllocated, totalNeeded }: { disposable: number; totalAllocated: number; totalNeeded: number }) {
  const remaining = disposable - totalAllocated;
  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 mb-4">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Disponibilní celkem</span>
          <p className="font-semibold text-gray-900 dark:text-white">{disposable.toLocaleString('cs-CZ')} Kč/měs</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Alokováno na cíle</span>
          <p className="font-semibold text-gray-900 dark:text-white">{totalAllocated.toLocaleString('cs-CZ')} Kč/měs</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Zbývá volných</span>
          <p className={`font-semibold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {remaining.toLocaleString('cs-CZ')} Kč/měs
          </p>
        </div>
      </div>
      {totalNeeded > disposable && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-400">
          Tvoje cíle dohromady potřebují o {(totalNeeded - disposable).toLocaleString('cs-CZ')} Kč/měs více, než máš k dispozici. Uprav cíle nebo jejich horizont.
        </div>
      )}
    </div>
  );
}

export default function CustomGoalPlanner({ state }: Props) {
  const disposable = monthlyDisposable(state);
  const [goals, setGoals] = useState<CustomGoal[]>(() => {
    if (state.customGoals && state.customGoals.length > 0) {
      return state.customGoals.map((g) => ({ ...g, id: g.id || makeId() }));
    }
    return [{ id: makeId(), name: '', targetAmount: 500000, targetMonths: 24 }];
  });
  const [timeUnit, setTimeUnit] = useState<'months' | 'years'>('months');
  const [deferredIds, setDeferredIds] = useState<Set<string>>(new Set());
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set());

  const toMonths = (g: CustomGoal) => timeUnit === 'years' ? g.targetMonths * 12 : g.targetMonths;

  // Single memo: filter active goals, convert to months, allocate
  const { allocationMap, totalAllocated, totalNeeded } = useMemo(() => {
    const active = goals.filter((g) => !deferredIds.has(g.id));
    const inMonths = active.map((g) => ({ ...g, targetMonths: toMonths(g) }));
    const allocs = allocateGoals(inMonths, disposable);
    const map = new Map<string, GoalAllocation>();
    active.forEach((g, i) => map.set(g.id, allocs[i]));
    const needed = inMonths.reduce((sum, g) => sum + (g.targetMonths > 0 ? Math.ceil(g.targetAmount / g.targetMonths) : 0), 0);
    const allocated = allocs.reduce((sum, a) => sum + a.monthlyAllocation, 0);
    return { allocationMap: map, totalAllocated: allocated, totalNeeded: needed };
  }, [goals, deferredIds, timeUnit, disposable]);

  const addGoal = () => {
    setGoals([...goals, { id: makeId(), name: '', targetAmount: 500000, targetMonths: 24 }]);
  };

  const updateGoal = (id: string, field: keyof CustomGoal, value: string | number) => {
    setGoals(goals.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  };

  const removeGoal = (id: string) => {
    if (goals.length > 1) {
      setGoals(goals.filter((g) => g.id !== id));
      setDeferredIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const move = (id: string, delta: -1 | 1) => {
    const idx = goals.findIndex((g) => g.id === id);
    const target = idx + delta;
    if (target < 0 || target >= goals.length) return;
    const next = [...goals];
    [next[idx], next[target]] = [next[target], next[idx]];
    setGoals(next);
  };

  const recommendInstrument = (months: number) => {
    if (months <= 12) return 'Spořicí účet';
    if (months <= 60) return 'Spořicí účet nebo konzervativní dluhopisy';
    return 'Akciový index (SP500 / globální)';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Vlastní finanční cíle</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Seřaď cíle podle důležitosti. Začneme od nejvyššího a uvidíme, na které ještě zbývá.
      </p>

      <GoalSummaryPanel disposable={disposable} totalAllocated={totalAllocated} totalNeeded={totalNeeded} />

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-600 dark:text-gray-400">Časový horizont v:</span>
        {(['months', 'years'] as const).map((unit) => (
          <button
            key={unit}
            onClick={() => setTimeUnit(unit)}
            className={`px-3 py-1 text-sm rounded-lg ${timeUnit === unit ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {unit === 'months' ? 'Měsících' : 'Letech'}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {goals.map((goal, index) => {
          const isDeferred = deferredIds.has(goal.id);
          const alloc = allocationMap.get(goal.id);
          const months = toMonths(goal);
          const requiredMonthly = months > 0 ? Math.ceil(goal.targetAmount / months) : 0;
          const chartAllocation = alloc?.monthlyAllocation ?? 0;
          const chartMonths = chartAllocation > 0 ? Math.min(Math.ceil(goal.targetAmount / chartAllocation), 360) : 0;

          return (
            <div
              key={goal.id}
              className={`border rounded-xl p-4 ${isDeferred ? 'opacity-50 border-dashed border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => move(goal.id, -1)}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 text-xs leading-none p-0.5"
                      aria-label="Posunout nahoru"
                    >▲</button>
                    <button
                      onClick={() => move(goal.id, 1)}
                      disabled={index === goals.length - 1}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 text-xs leading-none p-0.5"
                      aria-label="Posunout dolů"
                    >▼</button>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">#{index + 1}</span>
                  {!isDeferred && alloc && <StatusBadge alloc={alloc} />}
                  {isDeferred && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      Odložený
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDeferredIds((prev) => toggleInSet(prev, goal.id))}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {isDeferred ? 'Obnovit cíl' : 'Co kdybych odložil tento cíl?'}
                  </button>
                  {goals.length > 1 && (
                    <button onClick={() => removeGoal(goal.id)} className="text-red-400 hover:text-red-600 text-sm">
                      Odebrat
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Název cíle</label>
                  <input
                    type="text"
                    value={goal.name}
                    onChange={(e) => updateGoal(goal.id, 'name', e.target.value)}
                    placeholder="např. Auto, dovolená..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cílová částka (Kč)</label>
                  <input
                    type="number"
                    value={goal.targetAmount}
                    onChange={(e) => updateGoal(goal.id, 'targetAmount', Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Za kolik {timeUnit === 'months' ? 'měsíců' : 'let'}
                  </label>
                  <input
                    type="number"
                    value={goal.targetMonths}
                    onChange={(e) => updateGoal(goal.id, 'targetMonths', Math.max(1, Number(e.target.value)))}
                    min={1}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                  />
                </div>
              </div>

              {!isDeferred && alloc && (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Potřebná měsíční úspora:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {requiredMonthly.toLocaleString('cs-CZ')} Kč/měs
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Na tento cíl odkládáš:</span>
                    <span className={`font-semibold ${alloc.achievable ? 'text-green-600' : alloc.monthlyAllocation > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {alloc.monthlyAllocation.toLocaleString('cs-CZ')} Kč/měs
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Zbývá ti po tomto cíli:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {alloc.remainingAfter.toLocaleString('cs-CZ')} Kč/měs
                    </span>
                  </div>

                  {alloc.achievable && (
                    <div className="text-sm p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                      Na cíl dosáhneš v požadovaném čase.
                    </div>
                  )}
                  {!alloc.achievable && alloc.monthlyAllocation > 0 && (
                    <div className="text-sm p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">
                      Cíl potřebuje více času. Při aktuální alokaci dosáhneš za {alloc.monthsNeeded} měsíců místo {months}.
                    </div>
                  )}
                  {alloc.monthlyAllocation <= 0 && (
                    <div className="text-sm p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                      Na tento cíl ti po předchozích cílech nezbývají žádné prostředky.
                    </div>
                  )}

                  {!alloc.achievable && (
                    <div>
                      <button
                        onClick={() => setExpandedTips((prev) => toggleInSet(prev, goal.id))}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {expandedTips.has(goal.id) ? 'Skrýt doporučení' : 'Co s tím?'}
                      </button>
                      {expandedTips.has(goal.id) && (
                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm space-y-1.5">
                          {alloc.suggestedMonths !== undefined && alloc.suggestedMonths !== Infinity && (
                            <p className="text-blue-700 dark:text-blue-300">
                              <strong>Prodlužte horizont:</strong> pro dosažení tohoto cíle by stačilo {alloc.suggestedMonths} měsíců místo {months}.
                            </p>
                          )}
                          {alloc.achievableAmount !== undefined && alloc.achievableAmount > 0 && (
                            <p className="text-blue-700 dark:text-blue-300">
                              <strong>Snižte cílovou částku:</strong> při tvém rozpočtu dosáhneš na {alloc.achievableAmount.toLocaleString('cs-CZ')} Kč v zadaném čase.
                            </p>
                          )}
                          <p className="text-blue-700 dark:text-blue-300">
                            <strong>Přesuňte cíl níže v prioritách:</strong> uvolní se prostředky z vyšších cílů.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Doporučený nástroj: <span className="font-medium text-gray-900 dark:text-white">{recommendInstrument(months)}</span>
                  </div>
                </div>
              )}

              {!isDeferred && chartMonths > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={Array.from({ length: chartMonths + 1 }, (_, m) => ({ month: m, savings: chartAllocation * m }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" label={{ value: 'Měsíce', position: 'insideBottom', offset: -5 }} />
                    <YAxis tickFormatter={(n) => `${(n / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toLocaleString('cs-CZ')} Kč`]}
                      labelFormatter={(label) => `Měsíc ${label}`}
                    />
                    <Line type="monotone" dataKey="savings" stroke="#3b82f6" strokeWidth={2} dot={false} name="Úspory" />
                    <ReferenceLine y={goal.targetAmount} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Cíl', position: 'right' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={addGoal}
        className="mt-4 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 min-h-[44px]"
      >
        + Přidat další cíl
      </button>
    </div>
  );
}
