import type { WizardState } from '../../types';
import { DEFAULTS } from '../../engine/defaults';
import { monthlyMortgagePayment, effectiveDownPayment } from '../../engine/mortgage';

interface Props {
  state: WizardState;
}

export default function MortgageVsRent({ state }: Props) {
  const rent = state.expenses.rent;
  const utilities = state.expenses.utilities;
  const totalRent = rent + utilities;

  const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
  const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
  const loanAmount = Math.max(0, state.property.targetPrice - effectiveDownPayment(state));
  const payment = monthlyMortgagePayment(loanAmount, rate, term);
  const ownershipCosts = state.property.ownershipCosts ?? DEFAULTS.property.ownershipCosts;
  const totalOwnership = payment + ownershipCosts;

  const diff = Math.round(totalOwnership - totalRent);
  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Celkové náklady na bydlení</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 text-center">Nyní (nájem)</div>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Nájem:</span>
              <span>{fmt(rent)} Kč</span>
            </div>
            <div className="flex justify-between">
              <span>Energie a poplatky:</span>
              <span>{fmt(utilities)} Kč</span>
            </div>
          </div>
          <div className="border-t dark:border-gray-600 mt-2 pt-2 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(totalRent)} Kč</div>
            <div className="text-xs text-gray-400 dark:text-gray-500">celkem měsíčně</div>
          </div>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 text-center">Po koupi (vlastnictví)</div>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Splátka hypotéky:</span>
              <span>{fmt(payment)} Kč</span>
            </div>
            <div className="flex justify-between">
              <span>Náklady na bydlení:</span>
              <span>{fmt(ownershipCosts)} Kč</span>
            </div>
          </div>
          <div className="border-t dark:border-gray-600 mt-2 pt-2 text-center">
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">{fmt(totalOwnership)} Kč</div>
            <div className="text-xs text-gray-400 dark:text-gray-500">celkem měsíčně</div>
          </div>
        </div>
      </div>

      <div className={`text-center p-3 rounded-lg ${diff > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
        <span className="font-semibold">
          Vlastnictví je o {fmt(Math.abs(diff))} Kč {diff > 0 ? 'dražší' : 'levnější'} než nájem.
        </span>
      </div>
    </div>
  );
}
