import type { WizardState } from '../../types';
import { DEFAULTS } from '../../engine/defaults';
import {
  requiredDownPayment,
  downPaymentGap,
  monthlyMortgagePayment,
  monthsToSaveDownPayment,
  effectiveDownPayment,
} from '../../engine/mortgage';

interface Props {
  state: WizardState;
}

export default function PropertyAffordability({ state }: Props) {
  const price = state.property.targetPrice;
  const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
  const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
  const dp = requiredDownPayment(price);
  const gap = downPaymentGap(state);
  const loanAmount = Math.max(0, price - effectiveDownPayment(state));
  const payment = monthlyMortgagePayment(loanAmount, rate, term);
  const months = monthsToSaveDownPayment(state);

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Kalkulačka nemovitosti</h3>

      <div className="space-y-3 text-sm">
        <Row label="Cena nemovitosti" value={`${fmt(price)} Kč`} />
        <Row label="Potřebná akontace (20 %)" value={`${fmt(dp)} Kč`} />
        <Row label="Akontace z úspor" value={`${fmt(effectiveDownPayment(state))} Kč`} />
        <Row
          label="Chybějící akontace"
          value={`${fmt(gap)} Kč`}
          highlight={gap > 0 ? 'red' : 'green'}
        />

        <div className="border-t dark:border-gray-600 pt-3" />

        <Row label="Výše hypotéky" value={`${fmt(loanAmount)} Kč`} />
        <Row
          label="Odhadovaná měsíční splátka"
          value={`${fmt(payment)} Kč/měs.`}
          bold
        />
        <Row label="Úroková sazba" value={`${(rate * 100).toFixed(1)} % ročně`} />
        <Row label="Délka hypotéky" value={`${term} let`} />

        {gap > 0 && months !== Infinity && (
          <>
            <div className="border-t dark:border-gray-600 pt-3" />
            <Row
              label="Čas na naspoření chybějící akontace"
              value={months < 12 ? `${months} měsíců` : `${Math.floor(months / 12)} let a ${months % 12} měs.`}
            />
          </>
        )}
        {months === Infinity && gap > 0 && (
          <>
            <div className="border-t dark:border-gray-600 pt-3" />
            <p className="text-red-600 text-sm">Při současných příjmech a výdajích akontaci nelze naspořit.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, highlight, bold }: {
  label: string;
  value: string;
  highlight?: 'red' | 'green';
  bold?: boolean;
}) {
  const valueColor = highlight === 'red' ? 'text-red-600' : highlight === 'green' ? 'text-green-600' : 'text-gray-900 dark:text-white';
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <span className={`${bold ? 'text-lg font-bold' : 'font-semibold'} ${valueColor}`}>{value}</span>
    </div>
  );
}
