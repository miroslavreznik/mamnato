import { useMemo, useState } from 'react';
import type { WizardState } from '../../types';
import { discretionaryGroupTotals } from '../../engine/discretionary';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useChartColors, axisProps, fmtKcShort, fmtKc } from './chartTheme';
import { totalMonthlyIncome } from '../../engine/cashflow';

interface Props {
  state: WizardState;
}

export default function DiscretionaryBreakdownChart({ state }: Props) {
  const colors = useChartColors();
  const [showItems, setShowItems] = useState(false);

  const groups = useMemo(
    () => discretionaryGroupTotals(state.expenses.discretionaryBreakdown).filter((g) => g.amount > 0),
    [state.expenses.discretionaryBreakdown]
  );

  const total = groups.reduce((s, g) => s + g.amount, 0);
  const income = totalMonthlyIncome(state);
  const shareOfIncome = income > 0 ? (total / income) * 100 : 0;

  const colorFor = (i: number) => colors.discretionaryColors[i % colors.discretionaryColors.length];

  // Jeden vodorovný „stacked" sloupec: skupiny vedle sebe podle podílu.
  const row: Record<string, number | string> = { name: 'Zbytné' };
  groups.forEach((g) => { row[g.key] = g.amount; });
  const data = [row];

  const labelByKey = Object.fromEntries(groups.map((g) => [g.key, g.label]));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Zbytné výdaje: za co utrácíte</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Podrobný rozpis zbytných výdajů ({fmtKc(total)}/měs., {shareOfIncome.toFixed(0)} % příjmu). Tohle jsou výdaje, které lze při výpadku příjmů nejsnáz omezit.
      </p>

      <ResponsiveContainer width="100%" height={70}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
          <XAxis type="number" tickFormatter={fmtKcShort} {...axisProps(colors)} />
          <YAxis type="category" dataKey="name" width={70} {...axisProps(colors)} hide />
          <Tooltip
            cursor={{ fill: colors.grid, opacity: 0.3 }}
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
            formatter={(value, name) => [fmtKc(Number(value)), labelByKey[String(name)] ?? String(name)]}
          />
          {groups.map((g, i) => (
            <Bar
              key={g.key}
              dataKey={g.key}
              stackId="a"
              fill={colorFor(i)}
              stroke={colors.surface}
              strokeWidth={2}
              radius={i === 0 ? [4, 0, 0, 4] : i === groups.length - 1 ? [0, 4, 4, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Skupiny s částkou a podílem */}
      <div className="mt-4 space-y-2">
        {groups.map((g, i) => {
          const pct = total > 0 ? (g.amount / total) * 100 : 0;
          return (
            <div key={g.key}>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(i) }} />
                <span className="mr-0.5">{g.icon}</span>
                <span className="text-gray-700 dark:text-gray-200">{g.label}</span>
                <span className="ml-auto font-semibold text-gray-900 dark:text-white">{fmtKc(g.amount)}</span>
                <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)} %</span>
              </div>
              {showItems && (
                <div className="mt-1 ml-6 space-y-0.5">
                  {g.items.filter((it) => it.amount > 0).map((it) => (
                    <div key={it.key} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{it.label}</span>
                      <span>{fmtKc(it.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setShowItems((v) => !v)}
        className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {showItems ? 'Skrýt jednotlivé položky' : 'Zobrazit jednotlivé položky'}
      </button>
    </div>
  );
}
