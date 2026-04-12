import { useState } from 'react';
import type { WizardState } from '../../types';
import { investmentComparison } from '../../engine/savings';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SortedTooltip from '../ui/SortedTooltip';

interface Props {
  state: WizardState;
}

export default function InvestmentComparisonChart({ state }: Props) {
  const [propertyRate, setPropertyRate] = useState(3);
  const [sp500Rate, setSp500Rate] = useState(7);
  const [rentGrowth, setRentGrowth] = useState(3);

  const data = investmentComparison(
    state,
    propertyRate / 100,
    sp500Rate / 100,
    rentGrowth / 100,
    30
  );

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} tis`;
    return `${n}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Koupě vs. nájem + investice</h3>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" label={{ value: 'Roky', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={fmt} />
          <Tooltip
            content={
              <SortedTooltip
                labelFormatter={(label) => `Rok ${label}`}
                nameFormatter={(name) => {
                  const labels: Record<string, string> = {
                    propertyNetWorth: 'Koupě nemovitosti',
                    sp500NetWorth: 'Nájem + investice SP500',
                    rentingCost: 'Nájem bez investic',
                  };
                  return labels[name] ?? name;
                }}
              />
            }
          />
          <Legend
            formatter={(value) => {
              const labels: Record<string, string> = {
                propertyNetWorth: 'Koupě nemovitosti',
                sp500NetWorth: 'Nájem + investice SP500',
                rentingCost: 'Nájem bez investic',
              };
              return labels[value] ?? value;
            }}
          />
          <Line type="monotone" dataKey="propertyNetWorth" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="sp500NetWorth" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="rentingCost" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Zhodnocení nemovitosti (% ročně)</label>
          <input
            type="number"
            value={propertyRate}
            onChange={(e) => setPropertyRate(Number(e.target.value))}
            min={0} max={15} step={0.5}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Výnos SP500 (% ročně)</label>
          <input
            type="number"
            value={sp500Rate}
            onChange={(e) => setSp500Rate(Number(e.target.value))}
            min={0} max={20} step={0.5}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Růst nájmu (% ročně)</label>
          <input
            type="number"
            value={rentGrowth}
            onChange={(e) => setRentGrowth(Number(e.target.value))}
            min={0} max={15} step={0.5}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Předpokládané výnosy jsou historické průměry a nezaručují budoucí výsledky.
      </p>
    </div>
  );
}
