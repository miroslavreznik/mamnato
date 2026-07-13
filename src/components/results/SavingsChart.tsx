import type { WizardState } from '../../types';
import { savingsProjection } from '../../engine/savings';
import { requiredDownPayment, downPaymentGap, downPaymentFraction } from '../../engine/mortgage';
import { monthlyDisposable } from '../../engine/cashflow';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import Alert from '../ui/Alert';
import { useChartColors, gridProps, axisProps, fmtKcShort } from './chartTheme';

interface Props {
  state: WizardState;
}

export default function SavingsChart({ state }: Props) {
  const colors = useChartColors();
  const gap = downPaymentGap(state);

  // Akontaci už máte našetřenou → graf „za jak dlouho na ni dosáhnu" nedává
  // smysl, kartu proto vůbec nezobrazujeme (pokrytí akontace řeší kalkulačka
  // nemovitosti).
  if (gap <= 0) return null;

  const disposable = monthlyDisposable(state);
  const downPayment = requiredDownPayment(state.property.targetPrice, downPaymentFraction(state));

  if (disposable <= 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Vývoj úspor v čase</h3>
        <Alert type="warning">Při záporné disponibilní částce nelze zobrazit projekci úspor.</Alert>
      </div>
    );
  }

  const projection = savingsProjection(state, 120);
  const intersectMonth = projection.find((p) => p.savings >= downPayment)?.month;

  const chartData = projection
    .filter((_, i) => i % 12 === 0 || i === projection.length - 1)
    .map((p) => ({
      year: Math.round(p.month / 12),
      savings: Math.round(p.savings),
    }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Vývoj úspor v čase</h3>
      {intersectMonth !== undefined && intersectMonth > 0 && (
        <p className="text-sm text-green-600 mb-4">
          Na akontaci dosáhnete za {Math.floor(intersectMonth / 12)} let a {intersectMonth % 12} měsíců.
        </p>
      )}
      {intersectMonth === undefined && (
        <p className="text-sm text-yellow-600 mb-4">
          Za 10 let na akontaci nedosáhnete při současném tempu spoření.
        </p>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
          <defs>
            <linearGradient id="savings-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis dataKey="year" {...axisProps(colors)} label={{ value: 'Roky', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }} />
          <YAxis tickFormatter={fmtKcShort} {...axisProps(colors)} />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString('cs-CZ')} Kč`, 'Úspory']}
            labelFormatter={(label) => `Rok ${label}`}
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
          />
          <ReferenceLine
            y={downPayment}
            stroke={colors.negative}
            strokeDasharray="5 5"
            label={{ value: `Akontace: ${Math.round(downPayment).toLocaleString('cs-CZ')} Kč`, position: 'insideTopRight', fill: colors.negative, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="savings" stroke={colors.primary} strokeWidth={2} fill="url(#savings-grad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
