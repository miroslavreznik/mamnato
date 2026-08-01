import { useState, useMemo } from 'react';
import type { WizardState } from '../../types';
import { CHILD_COSTS_CZ } from '../../engine/defaults';
import { calculateChildCosts } from '../../engine/childCost';
import { decimal } from '../../engine/format';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useChartColors, gridProps, axisProps } from './chartTheme';
import NumField from '../ui/NumField';
import GoalAllocationField from './GoalAllocationField';
import Disclosure from '../ui/Disclosure';
import Card from '../ui/Card';
import Callout from '../ui/Callout';
import { HELP_BUTTON } from '../ui/Tooltip';
import { fieldClass } from '../ui/fieldClass';

interface Props {
  state: WizardState;
  monthlyAllocation: number;
  onChangeAllocation: (v: number) => void;
}

export default function ChildCostPlanner({ state, monthlyAllocation, onChangeAllocation }: Props) {
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
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="type-section text-ink">Náklady na dítě</h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={HELP_BUTTON}
          aria-label="Nápověda"
        >?</button>
      </div>

      {showInfo && (
        <Callout tone="brand" className="mb-4">
          Průměrné náklady na jedno dítě v ČR dle ČSÚ. Skutečné náklady se liší dle regionu, životního stylu a počtu dětí. Nezahrnují jednorázové výdaje (kočárek, autosedačka, nábytek).
        </Callout>
      )}

      {isFamily && (
        <Callout tone="caution" className="mb-4">
          Vaše aktuální výdaje na děti ({state.expenses.children.toLocaleString('cs-CZ')} Kč/měs.) jsou již zahrnuty ve výpočtu cashflow. Níže zobrazené náklady představují odhad pro plánované/budoucí dítě.
        </Callout>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-ink-label mb-1">Počet dětí</label>
          <NumField
            value={numberOfChildren}
            onChange={setNumberOfChildren}
            min={1} max={5}
            ariaLabel="Počet dětí"
            step={1}
            className={fieldClass('w-full px-3 py-2.5 text-base')}
          />
          {numberOfChildren > 1 && (
            <p className="mt-1 text-xs text-ink-faint">U druhého a dalšího dítěte mohou být náklady nižší díky zděděnému vybavení.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-label mb-1">Horizont (roky)</label>
          <NumField
            value={horizonYears}
            onChange={setHorizonYears}
            min={1} max={26}
            ariaLabel="Horizont v letech"
            step={1}
            className={fieldClass('w-full px-3 py-2.5 text-base')}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={includeUni}
              onChange={(e) => setIncludeUni(e.target.checked)}
              className="w-4 h-4 rounded border-line-strong"
            />
            <span className="text-sm text-ink-label">Zahrnout VŠ (19–26 let)</span>
          </label>
        </div>
      </div>

      {/* Tabulka je k přepsání, ne ke čtení: odpověď je průměr a součet pod
          ní, tohle jsou vstupy. Na telefonu zabírala čtyři řádky polí hned
          nad grafem, který totéž ukazuje názorněji. */}
      <Disclosure summary="Upravit náklady podle věku" className="mb-4">
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-ink-label mb-2">Měsíční náklady dle věku</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left py-2 text-ink-muted">Věk</th>
                <th className="text-right py-2 text-ink-muted">Kč/měs. (1 dítě)</th>
              </tr>
            </thead>
            <tbody>
              {CHILD_COSTS_CZ.filter((r) => includeUni || r.to <= 18).map((range) => (
                <tr key={range.label} className="border-b border-line">
                  <td className="py-2 text-ink">{range.label}</td>
                  <td className="text-right py-2">
                    <NumField
                      value={customCosts[range.label]}
                      onChange={(v) => setCustomCosts({ ...customCosts, [range.label]: v })}
                      ariaLabel={`Náklady ${range.label}`}
                      className={fieldClass('w-24 text-right px-2 py-2 text-sm')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </Disclosure>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-tint-brand rounded-lg">
          <span className="text-sm text-ink-muted">Průměrné měsíční náklady</span>
          <p className="text-lg font-bold text-brand">
            {result.monthlyAverage.toLocaleString('cs-CZ')} Kč/měs.
          </p>
        </div>
        <div className="p-3 bg-tint-brand rounded-lg">
          <span className="text-sm text-ink-muted">Celkové náklady</span>
          <p className="text-lg font-bold text-brand">
            {decimal(result.totalCost / 1_000_000)} mil. Kč
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
              formatter={(value) => [`${Number(value).toLocaleString('cs-CZ')} Kč/měs.`]}
              labelFormatter={(label) => `Věk: ${label} let`}
              contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
            />
            <Area type="stepAfter" dataKey="monthlyCost" stroke={colors.accent2} strokeWidth={2} fill="url(#child-grad)" dot={false} name="Měsíční náklady" />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <p className="mt-4 text-xs text-ink-faint">
        Zdroj: ČSÚ, průměr pro rok 2024. Částky jsou orientační a zahrnují běžné výdaje bez jednorázových položek.
      </p>
      <GoalAllocationField
        label="Kolik měsíčně odkládám na dítě"
        value={monthlyAllocation}
        onChange={onChangeAllocation}
        hint="Částka se promítne do rozpočtu i do celkového verdiktu."
      />
    </Card>
  );
}
