import { useState, useMemo } from 'react';
import type { WizardState } from '../../types';
import { totalMonthlyIncome } from '../../engine/cashflow';
import { expenseCategories, breakdownSurplus } from '../../engine/expenseBreakdown';
import type { ExpenseCategory } from '../../engine/expenseBreakdown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useChartColors, gridProps, axisProps, fmtKcShort, fmtKc } from './chartTheme';

interface Props {
  state: WizardState;
}

interface Row {
  name: string;
  surplus: number;
  [key: string]: number | string;
}

function toggle(prev: Set<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

export default function ExpenseBreakdownChart({ state }: Props) {
  const colors = useChartColors();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const hasProperty = state.goals.includes('property');
  const income = totalMonthlyIncome(state);

  const catsNow = useMemo(() => expenseCategories(state, false), [state]);
  const catsAfter = useMemo(
    () => (hasProperty ? expenseCategories(state, true) : null),
    [state, hasProperty]
  );

  // Sjednocené pořadí kategorií (dle výše ve stavu „Nyní", od největší), + popisky.
  const { orderedKeys, labelMap } = useMemo(() => {
    const labels: Record<string, string> = {};
    const amountForSort: Record<string, number> = {};
    const merge = (cats: ExpenseCategory[] | null) => {
      cats?.forEach((c) => {
        if (!(c.key in labels)) labels[c.key] = c.key === 'housing' ? 'Bydlení' : c.label;
        amountForSort[c.key] = Math.max(amountForSort[c.key] ?? 0, c.amount);
      });
    };
    merge(catsNow);
    merge(catsAfter);
    const keys = Object.keys(labels).sort((a, b) => amountForSort[b] - amountForSort[a]);
    return { orderedKeys: keys, labelMap: labels };
  }, [catsNow, catsAfter]);

  const necessaryMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    [...(catsNow ?? []), ...(catsAfter ?? [])].forEach((c) => { m[c.key] = c.necessary; });
    return m;
  }, [catsNow, catsAfter]);

  const surplusNow = breakdownSurplus(state, catsNow, excluded);
  const surplusAfter = catsAfter ? breakdownSurplus(state, catsAfter, excluded) : null;

  const buildRow = (name: string, cats: ExpenseCategory[]): Row => {
    const row: Row = { name, surplus: 0 };
    let spent = 0;
    for (const c of cats) {
      const val = excluded.has(c.key) ? 0 : c.amount;
      row[c.key] = val;
      spent += val;
    }
    row.surplus = Math.max(0, income - spent);
    return row;
  };

  const data: Row[] = [buildRow('Nyní', catsNow)];
  if (catsAfter) data.push(buildRow('Po koupi', catsAfter));

  const surplusColor = (v: number) => (v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Kam tečou vaše peníze</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Rozpad měsíčního příjmu ({fmtKc(income)}). Odškrtnutím položky uvidíte, jak by vypadal rozpočet bez ní.
      </p>

      {/* Stat tiles: kolik zbývá */}
      <div className={`grid gap-3 mb-5 ${surplusAfter !== null ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <span className="text-xs text-gray-500 dark:text-gray-400">Zbývá vám nyní</span>
          <p className={`text-2xl font-bold ${surplusColor(surplusNow)}`}>
            {surplusNow >= 0 ? '' : '−'}{fmtKc(Math.abs(surplusNow))}<span className="text-sm font-normal text-gray-400">/měs</span>
          </p>
        </div>
        {surplusAfter !== null && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <span className="text-xs text-gray-500 dark:text-gray-400">Zbývalo by po koupi</span>
            <p className={`text-2xl font-bold ${surplusColor(surplusAfter)}`}>
              {surplusAfter >= 0 ? '' : '−'}{fmtKc(Math.abs(surplusAfter))}<span className="text-sm font-normal text-gray-400">/měs</span>
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
            formatter={(value, name) => [fmtKc(Number(value)), name === 'surplus' ? 'Zbývá' : labelMap[String(name)] ?? String(name)]}
          />
          {orderedKeys.map((key) => (
            <Bar key={key} dataKey={key} stackId="a" fill={colors.categorical[key] ?? colors.primary} stroke={colors.surface} strokeWidth={2} radius={2} />
          ))}
          <Bar dataKey="surplus" stackId="a" fill={colors.categorical.surplus} stroke={colors.surface} strokeWidth={2} radius={[2, 4, 4, 2]}>
            {data.map((_, i) => <Cell key={i} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Toggle chips */}
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
    </div>
  );
}
