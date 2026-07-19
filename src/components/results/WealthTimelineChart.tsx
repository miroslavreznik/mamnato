import { useMemo, useState } from 'react';
import type { WizardState } from '../../types';
import { wealthTimeline } from '../../engine/wealthTimeline';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useChartColors, gridProps, axisProps, fmtKcShort, fmtKc } from './chartTheme';
import NumField from '../ui/NumField';
import Tooltip from '../ui/Tooltip';

interface Props {
  state: WizardState;
}

const fmtMonth = (m: number) => {
  const y = Math.floor(m / 12);
  const mm = m % 12;
  if (y === 0) return `${mm}. měsíc`;
  return mm === 0 ? `${y}. rok` : `${y} r. ${mm} měs.`;
};

export default function WealthTimelineChart({ state }: Props) {
  const colors = useChartColors();
  const hasChild = state.goals.includes('child');
  // Kdy čekáte dítě — „co kdyby" parametr časové osy (neovlivňuje verdikt).
  const [childOffset, setChildOffset] = useState(12);

  const tl = useMemo(
    () => wealthTimeline(state, { months: 120, childOffsetMonths: childOffset }),
    [state, childOffset]
  );

  const events = [
    tl.purchaseMonth !== null ? { month: tl.purchaseMonth, label: 'Koupě' } : null,
    tl.childMonth !== null ? { month: tl.childMonth, label: 'Dítě' } : null,
    tl.leaveEndMonth !== null && tl.leaveEndMonth <= 120 ? { month: tl.leaveEndMonth, label: 'Konec rodič.' } : null,
  ].filter((e): e is { month: number; label: string } => e !== null);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center">
        Vývoj jmění v čase
        <Tooltip text="Měsíc po měsíci: úspory rostou o disponibilní částku, při koupi klesnou o akontaci a nájem nahradí splátka, s dítětem přibudou náklady dle věku a během rodičovské klesne příjem. Bez výnosů z investic a inflace — konzervativní odhad." />
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Jak se vaše úspory vyvinou přes plánované události — spoření, koupi, dítě i rodičovskou. Nejde o předpověď, ale o kontrolu, jestli plán projde bez pádu pod nulu.
      </p>

      {hasChild && (
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm text-gray-600 dark:text-gray-300">Dítě čekáme za</label>
          <NumField
            value={childOffset}
            onChange={setChildOffset}
            min={0}
            max={96}
            ariaLabel="Za kolik měsíců čekáte dítě"
            className="w-20 text-right px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">měsíců</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={tl.points} margin={{ top: 30, right: 8, left: 8, bottom: 5 }}>
          <defs>
            <linearGradient id="wealth-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis
            dataKey="month"
            type="number"
            domain={[0, 120]}
            ticks={[0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120]}
            tickFormatter={(m) => `${m / 12}`}
            {...axisProps(colors)}
            label={{ value: 'Roky', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }}
          />
          <YAxis tickFormatter={fmtKcShort} {...axisProps(colors)} />
          <ChartTooltip
            formatter={(value) => [fmtKc(Number(value)), 'Úspory']}
            labelFormatter={(m) => fmtMonth(Number(m))}
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
          />
          <ReferenceLine y={0} stroke={colors.negative} strokeDasharray="4 4" />
          {events.map((e, i) => (
            <ReferenceLine
              key={e.label}
              x={e.month}
              stroke={colors.accent2}
              strokeDasharray="3 3"
              label={{ value: e.label, position: 'top', dy: (i % 2) * 13, fill: colors.accent2, fontSize: 11 }}
            />
          ))}
          <Area type="monotone" dataKey="cash" stroke={colors.primary} strokeWidth={2} fill="url(#wealth-grad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      {tl.firstNegativeMonth !== null ? (
        <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
          Kolem <strong>{fmtMonth(tl.firstNegativeMonth)}</strong> by úspory klesly pod nulu (nejníž {fmtKc(tl.minCash)}).
          Plán v této podobě neprojde — pomůže větší rezerva, levnější nemovitost, kratší rodičovská nebo odklad některé události.
        </div>
      ) : (
        <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-800 dark:text-emerald-300">
          Úspory zůstávají po celou dobu v plusu — nejnižší bod je <strong>{fmtKc(tl.minCash)}</strong> ({fmtMonth(tl.minCashMonth)}).
        </div>
      )}

      {state.goals.includes('property') && tl.purchaseMonth === null && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Na akontaci v horizontu 10 let nedosáhnete — koupě se na časové ose nekoná.
        </p>
      )}

      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Zjednodušený model: konstantní příjmy a výdaje, bez výnosů z investic a inflace. Spoření na cíle zůstává součástí jmění.
      </p>
    </div>
  );
}
