import { useState, useMemo } from 'react';
import type { WizardState } from '../../types';
import type { GoalAllocations } from '../../engine/allocation';
import { incomeFlow } from '../../engine/expenseBreakdown';
import type { ExpenseCategory } from '../../engine/expenseBreakdown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useChartColors, gridProps, axisProps, fmtKcShort, fmtKc } from './chartTheme';

interface Props {
  state: WizardState;
  allocations: GoalAllocations;
  onChangeAllocation: (goal: string, index: number | null, value: number) => void;
}

interface Row {
  name: string;
  goals: number;
  free: number;
  [key: string]: number | string;
}

function toggle(prev: Set<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

// Ovládací pole pro měsíční částku na cíl
function GoalInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-sm text-gray-600 dark:text-gray-300">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          min={0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="w-28 text-right pr-8 pl-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">Kč</span>
      </div>
    </div>
  );
}

export default function ExpenseBreakdownChart({ state, allocations, onChangeAllocation }: Props) {
  const colors = useChartColors();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const hasProperty = state.goals.includes('property');

  const flowNow = useMemo(() => incomeFlow(state, allocations, false, excluded), [state, allocations, excluded]);
  const flowAfter = useMemo(
    () => (hasProperty ? incomeFlow(state, allocations, true, excluded) : null),
    [state, allocations, hasProperty, excluded]
  );

  const income = flowNow.income;

  // Sjednocené pořadí výdajových kategorií (dle výše v „Nyní", od největší) + popisky.
  const { orderedKeys, labelMap, necessaryMap } = useMemo(() => {
    const labels: Record<string, string> = {};
    const necessary: Record<string, boolean> = {};
    const amountForSort: Record<string, number> = {};
    const merge = (cats: ExpenseCategory[]) => {
      cats.forEach((c) => {
        if (!(c.key in labels)) labels[c.key] = c.key === 'housing' ? 'Bydlení' : c.label;
        necessary[c.key] = c.necessary;
        amountForSort[c.key] = Math.max(amountForSort[c.key] ?? 0, c.amount);
      });
    };
    merge(flowNow.expenses);
    if (flowAfter) merge(flowAfter.expenses);
    const keys = Object.keys(labels).sort((a, b) => amountForSort[b] - amountForSort[a]);
    return { orderedKeys: keys, labelMap: labels, necessaryMap: necessary };
  }, [flowNow, flowAfter]);

  const buildRow = (name: string, expenses: ExpenseCategory[], goalsTotal: number, free: number): Row => {
    const row: Row = { name, goals: goalsTotal, free: Math.max(0, free) };
    for (const c of expenses) {
      row[c.key] = excluded.has(c.key) ? 0 : c.amount;
    }
    return row;
  };

  const goalsNow = flowNow.goals.reduce((s, g) => s + g.amount, 0);
  const data: Row[] = [buildRow('Nyní', flowNow.expenses, goalsNow, flowNow.free)];
  if (flowAfter) {
    const goalsAfter = flowAfter.goals.reduce((s, g) => s + g.amount, 0);
    data.push(buildRow('Po koupi', flowAfter.expenses, goalsAfter, flowAfter.free));
  }

  const freeColor = (v: number) => (v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400');

  // Ovládatelné cíle (mimo hypotéku — ta je výdajem)
  const controllableGoals: Array<{ key: string; label: string; value: number; onChange: (v: number) => void }> = [];
  if (state.goals.includes('retirement')) {
    controllableGoals.push({ key: 'retirement', label: 'Spoření na důchod', value: allocations.retirement, onChange: (v) => onChangeAllocation('retirement', null, v) });
  }
  if (state.goals.includes('child')) {
    controllableGoals.push({ key: 'child', label: 'Rezerva na dítě', value: allocations.child, onChange: (v) => onChangeAllocation('child', null, v) });
  }
  if (state.goals.includes('other')) {
    (state.customGoals ?? []).forEach((g, i) => {
      controllableGoals.push({ key: `custom-${i}`, label: g.name || `Vlastní cíl ${i + 1}`, value: allocations.custom[i] ?? 0, onChange: (v) => onChangeAllocation('custom', i, v) });
    });
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Rozpočet: kam jde váš příjem</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Celý měsíční příjem ({fmtKc(income)}) rozdělený na výdaje, spoření na cíle a volnou rezervu. Odškrtnutím položky nebo úpravou částek se vše přepočítá.
      </p>

      {/* Stat tiles: volná rezerva */}
      <div className={`grid gap-3 mb-5 ${flowAfter ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <span className="text-xs text-gray-500 dark:text-gray-400">Volná rezerva nyní</span>
          <p className={`text-2xl font-bold ${freeColor(flowNow.free)}`}>
            {flowNow.free >= 0 ? '' : '−'}{fmtKc(Math.abs(flowNow.free))}<span className="text-sm font-normal text-gray-400">/měs</span>
          </p>
        </div>
        {flowAfter && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <span className="text-xs text-gray-500 dark:text-gray-400">Volná rezerva po koupi</span>
            <p className={`text-2xl font-bold ${freeColor(flowAfter.free)}`}>
              {flowAfter.free >= 0 ? '' : '−'}{fmtKc(Math.abs(flowAfter.free))}<span className="text-sm font-normal text-gray-400">/měs</span>
            </p>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={data.length > 1 ? 160 : 110}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid {...gridProps(colors)} horizontal={false} />
          <XAxis type="number" tickFormatter={fmtKcShort} {...axisProps(colors)} />
          <YAxis type="category" dataKey="name" width={70} {...axisProps(colors)} />
          <Tooltip
            cursor={{ fill: colors.grid, opacity: 0.3 }}
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
            formatter={(value, name) => {
              const n = String(name);
              const label = n === 'free' ? 'Volná rezerva' : n === 'goals' ? 'Spoření na cíle' : labelMap[n] ?? n;
              return [fmtKc(Number(value)), label];
            }}
          />
          {orderedKeys.map((key) => (
            <Bar key={key} dataKey={key} stackId="a" fill={colors.categorical[key] ?? colors.primary} stroke={colors.surface} strokeWidth={2} radius={2} />
          ))}
          <Bar dataKey="goals" stackId="a" fill={colors.categorical.goals} stroke={colors.surface} strokeWidth={2} radius={2} />
          <Bar dataKey="free" stackId="a" fill={colors.categorical.surplus} stroke={colors.surface} strokeWidth={2} radius={[2, 4, 4, 2]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Toggle chips výdajů + legenda skupin */}
      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          {orderedKeys.map((key) => {
            const off = excluded.has(key);
            const color = colors.categorical[key] ?? colors.primary;
            return (
              <button
                key={key}
                onClick={() => setExcluded((prev) => toggle(prev, key))}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  off
                    ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 line-through'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                }`}
                title={necessaryMap[key] ? 'Nezbytný výdaj' : 'Zbytný výdaj'}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: off ? 'transparent' : color, border: off ? `1px solid ${color}` : 'none' }}
                />
                {labelMap[key]}
                {!necessaryMap[key] && <span className="text-[10px] text-amber-600 dark:text-amber-400">zbytné</span>}
              </button>
            );
          })}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.categorical.goals }} />
            Spoření na cíle
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.categorical.surplus }} />
            Volná rezerva
          </span>
        </div>
        {excluded.size > 0 && (
          <button
            onClick={() => setExcluded(new Set())}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Zobrazit vše
          </button>
        )}
      </div>

      {/* Ovládání částek na cíle */}
      {controllableGoals.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Kolik měsíčně dávat na cíle</h4>
          <div className="space-y-2">
            {controllableGoals.map((g) => (
              <GoalInput key={g.key} label={g.label} value={g.value} onChange={g.onChange} />
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            Hypotéka není v tomto seznamu — po koupi je součástí výdajů na bydlení. Změny se okamžitě promítnou do grafu i do volné rezervy.
          </p>
        </div>
      )}
    </div>
  );
}
