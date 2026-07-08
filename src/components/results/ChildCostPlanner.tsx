import { useState, useMemo } from 'react';
import type { WizardState } from '../../types';
import { CHILD_COSTS_CZ } from '../../engine/defaults';
import { calculateChildCosts } from '../../engine/childCost';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useChartColors, gridProps, axisProps } from './chartTheme';
import NumField from '../ui/NumField';

interface Props {
  state: WizardState;
}

export default function ChildCostPlanner({ state }: Props) {
  const colors = useChartColors();
  const isFamily = state.mode === 'family';
  const [numberOfChildren, setNumberOfChildren] = useState(state.numberOfChildren ?? 1);
  const [horizonYears, setHorizonYears] = useState(18);
  const [includeUni, setIncludeUni] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [customCosts, setCustomCosts] = useState<Record<string, number>>(() =>
    Object.fromEntries(CHILD_COSTS_CZ.map((r) => [r.label, r.monthlyCost]))
  );

  const effectiveHorizon = includeUni ? Math.max(horizonYears, 26) : horizonYears;

  const result = useMemo(
    () => calculateChildCosts(numberOfChildren, effectiveHorizon, includeUni, customCosts),
    [numberOfChildren, effectiveHorizon, includeUni, customCosts]
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-3xl">👶</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Náklady na dítě</h3>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="text-blue-500 hover:text-blue-700 text-sm"
              aria-label="Informace"
            >ⓘ</button>
          </div>
        </div>
      </div>

      {showInfo && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          Průměrné náklady na jedno dítě v ČR dle ČSÚ. Skutečné náklady se liší dle regionu, životního stylu a počtu dětí. Nezahrnují jednorázové výdaje (kočárek, autosedačka, nábytek).
        </div>
      )}

      {isFamily && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          Vaše aktuální výdaje na děti ({state.expenses.children.toLocaleString('cs-CZ')} Kč/měs) jsou již zahrnuty ve výpočtu cashflow. Níže zobrazené náklady představují odhad pro plánované/budoucí dítě.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Počet dětí</label>
          <NumField
            value={numberOfChildren}
            onChange={setNumberOfChildren}
            min={1} max={5}
            ariaLabel="Počet dětí"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
          {numberOfChildren > 1 && (
            <p className="mt-1 text-xs text-gray-400">U druhého a dalšího dítěte mohou být náklady nižší díky zděděnému vybavení.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Horizont (roky)</label>
          <NumField
            value={horizonYears}
            onChange={setHorizonYears}
            min={1} max={26}
            ariaLabel="Horizont v letech"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={includeUni}
              onChange={(e) => setIncludeUni(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Zahrnout VŠ (19–26 let)</span>
          </label>
        </div>
      </div>

      {/* Editable cost table */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Měsíční náklady dle věku</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 text-gray-500 dark:text-gray-400">Věk</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400">Kč/měsíc (1 dítě)</th>
              </tr>
            </thead>
            <tbody>
              {CHILD_COSTS_CZ.filter((r) => includeUni || r.to <= 18).map((range) => (
                <tr key={range.label} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 text-gray-900 dark:text-white">{range.label}</td>
                  <td className="text-right py-2">
                    <NumField
                      value={customCosts[range.label]}
                      onChange={(v) => setCustomCosts({ ...customCosts, [range.label]: v })}
                      ariaLabel={`Náklady ${range.label}`}
                      className="w-24 text-right px-2 py-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-sm text-gray-500 dark:text-gray-400">Průměrné měsíční náklady</span>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
            {result.monthlyAverage.toLocaleString('cs-CZ')} Kč/měs
          </p>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <span className="text-sm text-gray-500 dark:text-gray-400">Celkové náklady</span>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
            {(result.totalCost / 1_000_000).toFixed(1)} mil. Kč
          </p>
        </div>
      </div>

      {/* Chart */}
      {result.yearlyBreakdown.length > 0 && (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={result.yearlyBreakdown} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
            <defs>
              <linearGradient id="child-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.accent2} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colors.accent2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps(colors)} />
            <XAxis dataKey="year" {...axisProps(colors)} label={{ value: 'Věk dítěte', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }} />
            <YAxis tickFormatter={(n) => `${(n / 1000).toFixed(0)}k`} {...axisProps(colors)} />
            <Tooltip
              formatter={(value) => [`${Number(value).toLocaleString('cs-CZ')} Kč/měs`]}
              labelFormatter={(label) => `Věk: ${label} let`}
              contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
            />
            <Area type="stepAfter" dataKey="monthlyCost" stroke={colors.accent2} strokeWidth={2} fill="url(#child-grad)" dot={false} name="Měsíční náklady" />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        Zdroj: ČSÚ, průměr pro rok 2024. Částky jsou orientační a zahrnují běžné výdaje bez jednorázových položek.
      </p>
    </div>
  );
}
