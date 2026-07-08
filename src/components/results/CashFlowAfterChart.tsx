import type { WizardState } from '../../types';
import { cashFlowAfterPurchase } from '../../engine/savings';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SortedTooltip from '../ui/SortedTooltip';
import Alert from '../ui/Alert';
import { useChartColors, gridProps, axisProps, fmtKcShort } from './chartTheme';

interface Props {
  state: WizardState;
}

export default function CashFlowAfterChart({ state }: Props) {
  const colors = useChartColors();
  const raw = cashFlowAfterPurchase(state, 120);

  // Check if after-purchase savings would permanently shrink
  const permanentlyNegative = raw[raw.length - 1].afterPurchaseCashFlow < raw[0].afterPurchaseCashFlow;

  const chartData = raw
    .filter((_, i) => i % 12 === 0 || i === raw.length - 1)
    .map((d) => ({
      year: Math.round(d.month / 12),
      current: Math.round(d.currentCashFlow),
      afterPurchase: Math.round(d.afterPurchaseCashFlow),
    }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Výhled: vývoj úspor s koupí vs. bez</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Jak by rostly (nebo klesaly) vaše úspory v čase — kdybyste nemovitost koupili, nebo zůstali v nájmu.
      </p>

      {permanentlyNegative && (
        <div className="mb-4">
          <Alert type="warning">Po koupi nemovitosti by vaše úspory postupně klesaly — měsíční výdaje by převýšily příjem.</Alert>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
          <defs>
            <linearGradient id="cf-current" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.primary} stopOpacity={0.25} />
              <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cf-after" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.positive} stopOpacity={0.25} />
              <stop offset="100%" stopColor={colors.positive} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis dataKey="year" {...axisProps(colors)} label={{ value: 'Roky', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }} />
          <YAxis tickFormatter={fmtKcShort} {...axisProps(colors)} />
          <Tooltip
            content={
              <SortedTooltip
                labelFormatter={(label) => `Rok ${label}`}
                nameFormatter={(name) => (name === 'current' ? 'Pokud nekoupím' : 'Po koupi')}
              />
            }
          />
          <Legend formatter={(value) => (value === 'current' ? 'Pokud nekoupím' : 'Po koupi')} />
          <Area type="monotone" dataKey="current" stroke={colors.primary} strokeWidth={2} fill="url(#cf-current)" dot={false} />
          <Area type="monotone" dataKey="afterPurchase" stroke={colors.positive} strokeWidth={2} fill="url(#cf-after)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
