import type { WizardState } from '../../types';
import { totalMonthlyIncome, totalMonthlyExpenses, monthlyDisposable, savingsRate } from '../../engine/cashflow';
import Alert from '../ui/Alert';
import { useState } from 'react';

interface Props {
  state: WizardState;
}

const expenseLabels: Record<string, string> = {
  rent: 'Nájem',
  utilities: 'Energie a poplatky',
  existingLoans: 'Splátky úvěrů',
  insurance: 'Pojistky',
  food: 'Jídlo',
  transport: 'Doprava',
  children: 'Výdaje na děti',
  other: 'Ostatní',
};

export default function CashFlowSummary({ state }: Props) {
  const [expanded, setExpanded] = useState(false);
  const income = totalMonthlyIncome(state);
  const expenses = totalMonthlyExpenses(state);
  const disposable = monthlyDisposable(state);
  const rate = savingsRate(state);

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cash flow přehled</h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Celkové příjmy</span>
          <span className="font-semibold text-gray-900 dark:text-white">{fmt(income)} Kč/měs.</span>
        </div>

        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex justify-between items-center w-full text-left"
          >
            <span className="text-gray-600 dark:text-gray-400">Celkové výdaje {expanded ? '▾' : '▸'}</span>
            <span className="font-semibold text-gray-900 dark:text-white">{fmt(expenses)} Kč/měs.</span>
          </button>
          {expanded && (
            <div className="mt-2 ml-4 space-y-1 text-sm text-gray-500 dark:text-gray-400">
              {Object.entries(state.expenses).map(([key, val]) => {
                if (val === 0 && key === 'children' && state.mode !== 'family') return null;
                if (val === 0 && key === 'existingLoans') return null;
                return (
                  <div key={key} className="flex justify-between">
                    <span>{expenseLabels[key] ?? key}</span>
                    <span>{fmt(val)} Kč</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t dark:border-gray-600 pt-3">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700 dark:text-gray-300">Disponibilní částka</span>
            <span className={`text-xl font-bold ${disposable >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {disposable >= 0 ? '+' : ''}{fmt(disposable)} Kč/měs.
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500 dark:text-gray-400">Míra úspor</span>
          <span className="text-gray-700 dark:text-gray-300">
            {(rate * 100).toFixed(1)} %
            <span className="text-gray-400 dark:text-gray-500 ml-1">(doporučeno 10–20 %)</span>
          </span>
        </div>
      </div>

      {disposable < 0 && (
        <div className="mt-4">
          <Alert type="error">Vaše výdaje převyšují příjmy. Doporučujeme zkontrolovat rozpočet.</Alert>
        </div>
      )}
      {disposable >= 0 && rate < 0.1 && (
        <div className="mt-4">
          <Alert type="warning">Vaše míra úspor je nízká. Pro zdravé finance se doporučuje spořit alespoň 10–20 % příjmů.</Alert>
        </div>
      )}
    </div>
  );
}
