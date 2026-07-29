import { useState, useMemo, useEffect, useCallback } from 'react';
import type { WizardState, CustomGoal } from '../../types';
import { monthlyDisposable } from '../../engine/cashflow';
import { allocateGoals } from '../../engine/savings';
import type { GoalAllocation } from '../../engine/savings';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useChartColors, gridProps, axisProps } from './chartTheme';
import NumField from '../ui/NumField';
import GoalAllocationField from './GoalAllocationField';
import Card from '../ui/Card';
import Callout from '../ui/Callout';
import StatusBadge from '../ui/StatusBadge';
import { fieldClass } from '../ui/fieldClass';

interface Props {
  state: WizardState;
  onChangeGoals: (goals: CustomGoal[]) => void;
  allocations: number[];
  onChangeAllocation: (index: number, value: number) => void;
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

/**
 * Stav vlastního cíle. Dřív to byl vlastní odznak: tónovaná pilulka se
 * slovem, jinak vypadající než odznaky u ostatních cílů, a stejným jménem
 * jako sdílená komponenta. Vedle sebe to byly dva různé odznaky pro totéž.
 */
function GoalStatus({ alloc }: { alloc: GoalAllocation }) {
  const [status, label] = alloc.monthlyAllocation <= 0
    ? ['danger', 'Nestačí prostředky'] as const
    : !alloc.achievable
      ? ['caution', 'Potřebuje více času'] as const
      : ['good', 'Dosažitelný'] as const;
  return <StatusBadge status={status} label={label} />;
}

function GoalSummaryPanel({ disposable, totalAllocated, totalNeeded }: { disposable: number; totalAllocated: number; totalNeeded: number }) {
  const remaining = disposable - totalAllocated;
  return (
    <div className="p-4 rounded-xl border border-line bg-sunken mb-4">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-ink-muted">Disponibilní celkem</span>
          <p className="font-semibold text-ink">{disposable.toLocaleString('cs-CZ')} Kč/měs.</p>
        </div>
        <div>
          <span className="text-ink-muted">Alokováno na cíle</span>
          <p className="font-semibold text-ink">{totalAllocated.toLocaleString('cs-CZ')} Kč/měs.</p>
        </div>
        <div>
          <span className="text-ink-muted">Zbývá volných</span>
          <p className={`font-semibold ${remaining >= 0 ? 'text-good' : 'text-danger'}`}>
            {remaining.toLocaleString('cs-CZ')} Kč/měs.
          </p>
        </div>
      </div>
      {totalNeeded > disposable && (
        <Callout tone="danger" className="mt-3">
          Tvoje cíle dohromady potřebují o {(totalNeeded - disposable).toLocaleString('cs-CZ')} Kč/měs. více, než máš k dispozici. Uprav cíle nebo jejich horizont.
        </Callout>
      )}
    </div>
  );
}

export default function CustomGoalPlanner({ state, onChangeGoals, allocations, onChangeAllocation }: Props) {
  const colors = useChartColors();
  const disposable = monthlyDisposable(state);
  // Cíle jsou zdrojem pravdy ve sdíleném stavu, změny se hned promítnou
  // do souhrnu i grafu rozpočtu a uloží se do prohlížeče.
  const goals = useMemo(() => state.customGoals ?? [], [state.customGoals]);
  const setGoals = onChangeGoals;

  // Kdyby uživatel dorazil bez zadaného cíle, nabídneme jeden prázdný.
  useEffect(() => {
    if (goals.length === 0) {
      onChangeGoals([{ id: makeId(), name: '', targetAmount: 500000, targetMonths: 24 }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [timeUnit, setTimeUnit] = useState<'months' | 'years'>('months');
  const [deferredIds, setDeferredIds] = useState<Set<string>>(new Set());
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set());

  const toMonths = useCallback(
    (g: CustomGoal) => (timeUnit === 'years' ? g.targetMonths * 12 : g.targetMonths),
    [timeUnit]
  );

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
  }, [goals, deferredIds, toMonths, disposable]);

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
    <Card>
      <h3 className="type-section text-ink mb-2">Vlastní finanční cíle</h3>
      <p className="text-sm text-ink-muted mb-4">
        Seřaď cíle podle důležitosti. Začneme od nejvyššího a uvidíme, na které ještě zbývá.
      </p>

      <GoalSummaryPanel disposable={disposable} totalAllocated={totalAllocated} totalNeeded={totalNeeded} />

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-ink-body">Časový horizont v:</span>
        {(['months', 'years'] as const).map((unit) => (
          <button
            key={unit}
            onClick={() => setTimeUnit(unit)}
            className={`px-3 py-1 text-sm rounded-lg ${timeUnit === unit ? 'bg-tint-brand text-brand' : 'text-ink-muted'}`}
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
              className={`border rounded-xl p-4 ${isDeferred ? 'opacity-50 border-dashed border-line-strong' : 'border-line'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => move(goal.id, -1)}
                      disabled={index === 0}
                      className="text-ink-faint hover:text-ink-body disabled:opacity-30 text-xs leading-none p-0.5"
                      aria-label="Posunout nahoru"
                    >▲</button>
                    <button
                      onClick={() => move(goal.id, 1)}
                      disabled={index === goals.length - 1}
                      className="text-ink-faint hover:text-ink-body disabled:opacity-30 text-xs leading-none p-0.5"
                      aria-label="Posunout dolů"
                    >▼</button>
                  </div>
                  <span className="text-sm font-medium text-ink-label">#{index + 1}</span>
                  {!isDeferred && alloc && <GoalStatus alloc={alloc} />}
                  {isDeferred && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sunken text-ink-muted">
                      Odložený
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDeferredIds((prev) => toggleInSet(prev, goal.id))}
                    className="text-xs text-brand hover:underline"
                  >
                    {isDeferred ? 'Obnovit cíl' : 'Co kdybych odložil tento cíl?'}
                  </button>
                  {goals.length > 1 && (
                    <button onClick={() => removeGoal(goal.id)} className="text-danger hover:text-danger text-sm">
                      Odebrat
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Název cíle</label>
                  <input
                    type="text"
                    value={goal.name}
                    onChange={(e) => updateGoal(goal.id, 'name', e.target.value)}
                    placeholder="např. Auto, dovolená..."
                    className={fieldClass('w-full px-3 py-2 text-sm')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Cílová částka (Kč)</label>
                  <NumField
                    value={goal.targetAmount}
                    onChange={(v) => updateGoal(goal.id, 'targetAmount', v)}
                    ariaLabel="Cílová částka"
                    step={10000}
                    className={fieldClass('w-full px-3 py-2.5 text-base')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">
                    Za kolik {timeUnit === 'months' ? 'měsíců' : 'let'}
                  </label>
                  <NumField
                    value={goal.targetMonths}
                    onChange={(v) => updateGoal(goal.id, 'targetMonths', v)}
                    min={1}
                    ariaLabel="Za kolik měsíců/let"
                    step={1}
                    className={fieldClass('w-full px-3 py-2.5 text-base')}
                  />
                </div>
              </div>

              <GoalAllocationField
                label="Kolik na tento cíl měsíčně dávám"
                value={allocations[index] ?? 0}
                onChange={(v) => onChangeAllocation(index, v)}
              />

              {!isDeferred && alloc && (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-body">Potřebná měsíční úspora:</span>
                    <span className="font-semibold text-ink">
                      {requiredMonthly.toLocaleString('cs-CZ')} Kč/měs.
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-body">Na tento cíl odkládáš:</span>
                    <span className={`font-semibold ${alloc.achievable ? 'text-good' : alloc.monthlyAllocation > 0 ? 'text-caution' : 'text-danger'}`}>
                      {alloc.monthlyAllocation.toLocaleString('cs-CZ')} Kč/měs.
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-body">Zbývá ti po tomto cíli:</span>
                    <span className="font-semibold text-ink">
                      {alloc.remainingAfter.toLocaleString('cs-CZ')} Kč/měs.
                    </span>
                  </div>

                  {alloc.achievable && (
                    <Callout tone="good" pad="p-2 rounded-lg">
                      Na cíl dosáhneš v požadovaném čase.
                    </Callout>
                  )}
                  {!alloc.achievable && alloc.monthlyAllocation > 0 && (
                    <Callout tone="caution" pad="p-2 rounded-lg">
                      Cíl potřebuje více času. Při aktuální alokaci dosáhneš za {alloc.monthsNeeded} měsíců místo {months}.
                    </Callout>
                  )}
                  {alloc.monthlyAllocation <= 0 && (
                    <Callout tone="danger" pad="p-2 rounded-lg">
                      Na tento cíl ti po předchozích cílech nezbývají žádné prostředky.
                    </Callout>
                  )}

                  {!alloc.achievable && (
                    <div>
                      <button
                        onClick={() => setExpandedTips((prev) => toggleInSet(prev, goal.id))}
                        className="text-sm text-brand hover:underline"
                      >
                        {expandedTips.has(goal.id) ? 'Skrýt doporučení' : 'Co s tím?'}
                      </button>
                      {expandedTips.has(goal.id) && (
                        <Callout tone="brand" className="mt-2 space-y-1.5">
                          {alloc.suggestedMonths !== undefined && alloc.suggestedMonths !== Infinity && (
                            <p className="text-brand">
                              <strong>Prodlužte horizont:</strong> pro dosažení tohoto cíle by stačilo {alloc.suggestedMonths} měsíců místo {months}.
                            </p>
                          )}
                          {alloc.achievableAmount !== undefined && alloc.achievableAmount > 0 && (
                            <p className="text-brand">
                              <strong>Snižte cílovou částku:</strong> při tvém rozpočtu dosáhneš na {alloc.achievableAmount.toLocaleString('cs-CZ')} Kč v zadaném čase.
                            </p>
                          )}
                          <p className="text-brand">
                            <strong>Přesuňte cíl níže v prioritách:</strong> uvolní se prostředky z vyšších cílů.
                          </p>
                        </Callout>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-ink-body">
                    Doporučený nástroj: <span className="font-medium text-ink">{recommendInstrument(months)}</span>
                  </div>
                </div>
              )}

              {!isDeferred && chartMonths > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={Array.from({ length: chartMonths + 1 }, (_, m) => ({ month: m, savings: chartAllocation * m }))} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
                    <defs>
                      <linearGradient id={`goal-grad-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridProps(colors)} />
                    <XAxis dataKey="month" {...axisProps(colors)} label={{ value: 'Měsíce', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }} />
                    <YAxis tickFormatter={(n) => `${(n / 1000).toFixed(0)}k`} {...axisProps(colors)} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toLocaleString('cs-CZ')} Kč`]}
                      labelFormatter={(label) => `Měsíc ${label}`}
                      contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
                    />
                    <Area type="monotone" dataKey="savings" stroke={colors.primary} strokeWidth={2} fill={`url(#goal-grad-${goal.id})`} dot={false} name="Úspory" />
                    <ReferenceLine y={goal.targetAmount} stroke={colors.negative} strokeDasharray="5 5" label={{ value: 'Cíl', position: 'insideTopRight', fill: colors.negative, fontSize: 12 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={addGoal}
        className="mt-4 px-4 py-2 text-sm text-brand border border-line rounded-lg hover:bg-tint-brand min-h-[44px]"
      >
        + Přidat další cíl
      </button>
    </Card>
  );
}
