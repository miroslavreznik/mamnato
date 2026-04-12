import { useState } from 'react';
import type { WizardState } from '../../types';
import { monthlyDisposable } from '../../engine/cashflow';
import { retirementProjection } from '../../engine/savings';
import { DEFAULTS } from '../../engine/defaults';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SortedTooltip from '../ui/SortedTooltip';

const INFLATION = DEFAULTS.averageCzInflation;

const instruments = [
  { key: 'sp500', label: 'SP500 / globální akcie', rate: 7, color: '#3b82f6' },
  { key: 'bonds', label: 'Státní dluhopisy ČR', rate: 4, color: '#10b981' },
  { key: 'savings', label: 'Spořicí účet', rate: 4.5, color: '#f59e0b' },
  { key: 'gold', label: 'Zlato', rate: 3, color: '#a855f7' },
  { key: 'cash', label: 'Hotovost (pod polštářem)', rate: 0, color: '#ef4444' },
];

interface Props {
  state: WizardState;
}

export default function RetirementPlanner({ state }: Props) {
  const disposable = monthlyDisposable(state);
  const [monthlyAmount, setMonthlyAmount] = useState(Math.max(0, Math.round(disposable * 0.3)));
  const [yearsToRetirement, setYearsToRetirement] = useState(30);
  const [rates, setRates] = useState(() =>
    Object.fromEntries(instruments.map((i) => [i.key, i.rate]))
  );
  const [showInflation, setShowInflation] = useState(false);
  const [showInflationInfo, setShowInflationInfo] = useState(false);

  const nominalProjections = instruments.map((inst) => ({
    ...inst,
    data: retirementProjection(monthlyAmount, yearsToRetirement, rates[inst.key] / 100),
  }));

  const realProjections = showInflation
    ? instruments.map((inst) => ({
        ...inst,
        data: retirementProjection(monthlyAmount, yearsToRetirement, rates[inst.key] / 100, INFLATION),
      }))
    : null;

  // Merge all projections into a single dataset for the chart
  const chartData = Array.from({ length: yearsToRetirement + 1 }, (_, year) => {
    const point: Record<string, number> = { year };
    for (const p of nominalProjections) {
      if (showInflation) {
        point[`${p.key}_nom`] = p.data[year]?.portfolioValue ?? 0;
      } else {
        point[p.key] = p.data[year]?.portfolioValue ?? 0;
      }
    }
    if (realProjections) {
      for (const p of realProjections) {
        point[p.key] = p.data[year]?.portfolioValue ?? 0;
      }
    }
    return point;
  });

  const totalContributions = monthlyAmount * yearsToRetirement * 12;

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} tis`;
    return `${n}`;
  };

  // For the table, show real values when inflation is on, nominal otherwise
  const tableProjections = showInflation && realProjections ? realProjections : nominalProjections;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Plán spoření na důchod</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Měsíční částka k investování
          </label>
          <div className="relative">
            <input
              type="number"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Kč</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">Disponibilní příjem: {disposable.toLocaleString('cs-CZ')} Kč/měs</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Počet let do důchodu
          </label>
          <input
            type="number"
            value={yearsToRetirement}
            onChange={(e) => setYearsToRetirement(Math.max(1, Math.min(50, Number(e.target.value))))}
            min={1} max={50}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
        </div>
      </div>

      {/* Inflation toggle */}
      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            className={`relative w-10 h-6 rounded-full transition-colors ${showInflation ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            onClick={() => setShowInflation(!showInflation)}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${showInflation ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Započítat inflaci</span>
        </label>
        <button
          onClick={() => setShowInflationInfo(!showInflationInfo)}
          className="text-blue-500 hover:text-blue-700 text-sm"
          aria-label="Informace o inflaci"
        >ⓘ</button>
      </div>

      {showInflationInfo && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <p className="font-semibold">Co znamená „započítat inflaci"?</p>
          <p>
            Inflace postupně snižuje kupní sílu peněz. 1 000 000 Kč dnes bude mít za 30 let reálnou hodnotu
            přibližně 412 000 Kč (při průměrné inflaci 3 % ročně).
          </p>
          <p>
            Když zapnete tento přepínač, graf ukazuje <strong>reálnou hodnotu</strong> vašich úspor, tedy kolik
            si za ně skutečně koupíte v dnešních cenách. Nominální hodnota je to, co uvidíte na výpisu z účtu.
          </p>
          <p>Používáme průměrnou roční inflaci v ČR: <strong>3 %</strong> (dlouhodobý průměr ČNB).</p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" label={{ value: 'Roky', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={fmt} />
          <Tooltip
            content={
              <SortedTooltip
                labelFormatter={(label) => `Rok ${label}`}
                nameFormatter={(name) => {
                  const isNominal = name.endsWith('_nom');
                  const key = isNominal ? name.replace('_nom', '') : name;
                  const label = instruments.find((i) => i.key === key)?.label ?? key;
                  return isNominal ? `${label} (nominální)` : showInflation ? `${label} (reálná)` : label;
                }}
              />
            }
          />
          <Legend
            formatter={(value) => {
              const isNominal = value.endsWith('_nom');
              const key = isNominal ? value.replace('_nom', '') : value;
              const label = instruments.find((i) => i.key === key)?.label ?? key;
              return isNominal ? `${label} (nom.)` : showInflation ? `${label} (reál.)` : label;
            }}
          />
          {instruments.map((inst) => (
            showInflation ? (
              <Line
                key={`${inst.key}_nom`}
                type="monotone"
                dataKey={`${inst.key}_nom`}
                stroke={inst.color}
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                opacity={0.5}
              />
            ) : null
          ))}
          {instruments.map((inst) => (
            <Line
              key={inst.key}
              type="monotone"
              dataKey={inst.key}
              stroke={inst.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Výsledná hodnota portfolia{showInflation ? ' (reálná kupní síla)' : ''}
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 text-gray-500 dark:text-gray-400">Nástroj</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400">Výnos % / rok</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400">Hodnota</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400">
                  {showInflation ? 'Reálný zisk' : 'Složené úroky'}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableProjections.map((p) => {
                const finalValue = p.data[p.data.length - 1]?.portfolioValue ?? 0;
                const compoundInterest = finalValue - totalContributions;
                return (
                  <tr key={p.key} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 text-gray-900 dark:text-white">
                      <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </td>
                    <td className="text-right py-2 text-gray-600 dark:text-gray-300">
                      <input
                        type="number"
                        value={rates[p.key]}
                        onChange={(e) => setRates({ ...rates, [p.key]: Number(e.target.value) })}
                        className="w-16 text-right px-1 py-0.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-sm"
                        step={0.5}
                      />
                      <span className="ml-1">%</span>
                    </td>
                    <td className="text-right py-2 font-semibold text-gray-900 dark:text-white">
                      {finalValue.toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className={`text-right py-2 font-semibold ${compoundInterest >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {compoundInterest >= 0 ? '+' : ''}{compoundInterest.toLocaleString('cs-CZ')} Kč
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                <td colSpan={2} className="py-2 text-gray-600 dark:text-gray-400 text-sm">
                  Celkové vklady: {totalContributions.toLocaleString('cs-CZ')} Kč
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        Výnosy jsou historické průměry. Skutečné výsledky se mohou lišit.
        {showInflation && ` Inflace: ${(INFLATION * 100).toFixed(0)} % ročně (dlouhodobý průměr ČNB).`}
      </p>
    </div>
  );
}
