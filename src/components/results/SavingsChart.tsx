import { useState } from 'react';
import type { WizardState } from '../../types';
import { savingsProjection } from '../../engine/savings';
import { requiredDownPayment, downPaymentGap, effectiveDownPayment } from '../../engine/mortgage';
import { monthlyDisposable } from '../../engine/cashflow';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import Alert from '../ui/Alert';
import { useChartColors, gridProps, axisProps, fmtKcShort } from './chartTheme';

interface Props {
  state: WizardState;
}

export default function SavingsChart({ state }: Props) {
  const colors = useChartColors();
  const disposable = monthlyDisposable(state);
  const gap = downPaymentGap(state);
  const [showChart, setShowChart] = useState(gap > 0);

  if (disposable <= 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Vývoj úspor v čase</h3>
        <Alert type="warning">Při záporné disponibilní částce nelze zobrazit projekci úspor.</Alert>
      </div>
    );
  }

  const downPayment = requiredDownPayment(state.property.targetPrice);
  const savings = effectiveDownPayment(state);
  const reserve = savings - downPayment;

  // Down payment already covered — show confirmation
  if (gap <= 0 && !showChart) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Vývoj úspor v čase</h3>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-green-700 dark:text-green-400">
            Na akontaci již máte dost. Vaše úspory ({savings.toLocaleString('cs-CZ')} Kč)
            pokrývají potřebnou akontaci ({downPayment.toLocaleString('cs-CZ')} Kč)
            s rezervou {reserve.toLocaleString('cs-CZ')} Kč.
          </p>
        </div>
        <button
          onClick={() => setShowChart(true)}
          className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Zobrazit graf vývoje úspor
        </button>
      </div>
    );
  }

  // Show chart
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
      {intersectMonth !== undefined && intersectMonth === 0 && (
        <p className="text-sm text-green-600 mb-4">
          Na akontaci již máte dostatek úspor.
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

      {gap <= 0 && (
        <button
          onClick={() => setShowChart(false)}
          className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:underline"
        >
          Skrýt graf
        </button>
      )}
    </div>
  );
}
