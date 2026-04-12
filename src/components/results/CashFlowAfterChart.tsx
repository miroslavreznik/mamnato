import type { WizardState } from '../../types';
import { cashFlowAfterPurchase } from '../../engine/savings';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SortedTooltip from '../ui/SortedTooltip';
import Alert from '../ui/Alert';

interface Props {
  state: WizardState;
}

export default function CashFlowAfterChart({ state }: Props) {
  const raw = cashFlowAfterPurchase(state, 120);

  // Check if after-purchase is permanently negative
  const permanentlyNegative = raw.every((d) => d.afterPurchaseCashFlow <= 0);

  const chartData = raw
    .filter((_, i) => i % 12 === 0 || i === raw.length - 1)
    .map((d) => ({
      year: Math.round(d.month / 12),
      current: Math.round(d.currentCashFlow),
      afterPurchase: Math.round(d.afterPurchaseCashFlow),
    }));

  const fmt = (n: number) => `${(n / 1000000).toFixed(1)} M`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Výhled: cash flow s koupí vs. bez</h3>

      {permanentlyNegative && (
        <div className="mb-4">
          <Alert type="warning">Po koupi nemovitosti by vaše cash flow bylo trvale záporné.</Alert>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" label={{ value: 'Roky', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={fmt} />
          <Tooltip
            content={
              <SortedTooltip
                labelFormatter={(label) => `Rok ${label}`}
                nameFormatter={(name) => name === 'current' ? 'Pokud nekoupím' : 'Po koupi'}
              />
            }
          />
          <Legend formatter={(value) => (value === 'current' ? 'Pokud nekoupím' : 'Po koupi')} />
          <Line type="monotone" dataKey="current" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="afterPurchase" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
