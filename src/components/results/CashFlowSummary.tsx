import type { WizardState } from '../../types';
import { totalMonthlyIncome, totalMonthlyExpenses, monthlyDisposable, savingsRate, necessaryMonthlyExpenses, emergencyRunwayMonths } from '../../engine/cashflow';
import Alert from '../ui/Alert';
import Tooltip from '../ui/Tooltip';
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
  other: 'Zbytné výdaje',
};

export default function CashFlowSummary({ state }: Props) {
  const [expanded, setExpanded] = useState(false);
  const income = totalMonthlyIncome(state);
  const expenses = totalMonthlyExpenses(state);
  const necessary = necessaryMonthlyExpenses(state);
  const disposable = monthlyDisposable(state);
  const rate = savingsRate(state);
  const runway = emergencyRunwayMonths(state);

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  const runwayColor = runway >= 6 ? 'text-green-600' : runway >= 3 ? 'text-amber-600' : 'text-red-600';
  const runwayLabel = runway === Infinity ? '∞' : `${runway.toFixed(1)} měs.`;

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
                if (typeof val !== 'number') return null; // discretionaryBreakdown je mapa, ne částka
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
          <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-500 mt-1">
            <span>z toho nezbytné</span>
            <span>{fmt(necessary)} Kč/měs.</span>
          </div>
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

        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500 dark:text-gray-400 flex items-center">
            Rezerva vydrží
            <Tooltip text="Jak dlouho by vaše úspory pokryly nezbytné výdaje, kdyby zcela vypadl příjem. Doporučuje se mít rezervu na 3–6 měsíců." />
          </span>
          <span className={`font-semibold ${runwayColor}`}>
            {runwayLabel}
            <span className="text-gray-400 dark:text-gray-500 ml-1 font-normal">(doporučeno 3–6)</span>
          </span>
        </div>
      </div>

      {runway < 3 && state.savings.totalSavings >= 0 && (
        <div className="mt-4">
          <Alert type="warning">
            Vaše rezerva by při výpadku příjmů vydržela méně než 3 měsíce. Než budete řešit velké cíle, je vhodné vytvořit nouzový fond ve výši 3–6 měsíců nezbytných výdajů.
          </Alert>
        </div>
      )}

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
