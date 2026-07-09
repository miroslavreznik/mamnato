import type { WizardState } from '../../types';
import { DEFAULTS } from '../../engine/defaults';
import {
  requiredDownPayment,
  downPaymentGap,
  monthlyMortgagePayment,
  monthsToSaveDownPayment,
  effectiveDownPayment,
} from '../../engine/mortgage';
import Tooltip from '../ui/Tooltip';

interface Props {
  state: WizardState;
}

export default function PropertyAffordability({ state }: Props) {
  const price = state.property.targetPrice;
  const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
  const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
  const fixationYears = state.property.fixationYears ?? DEFAULTS.property.fixationYears;
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
        <Row
          label="Potřebná akontace (20 %)"
          value={`${fmt(dp)} Kč`}
          tooltip="Kolik banka požaduje zaplatit z vlastních peněz. Obvykle 20 % ceny nemovitosti — zbytek pokryje hypotéka."
        />
        <Row
          label="Pokryto z vlastních úspor"
          value={`${fmt(effectiveDownPayment(state))} Kč`}
          tooltip="Kolik z vašich naspořených peněz vložíte do akontace. Nastavuje se v kroku Nemovitost posuvníkem „Jak rozdělíte své úspory“."
        />
        <Row
          label="Chybějící akontace"
          value={`${fmt(gap)} Kč`}
          highlight={gap > 0 ? 'red' : 'green'}
          tooltip="Rozdíl mezi potřebnou akontací a tím, co pokryjete z úspor. Tuto částku je potřeba ještě naspořit, než se dá o hypotéku požádat."
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
        <Row label="Fixace sazby" value={`${fixationYears} ${fixationYears === 1 ? 'rok' : fixationYears < 5 ? 'roky' : 'let'}`} />

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

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        <span className="font-semibold">Nezapomeňte na refixaci.</span>{' '}
        Za {fixationYears} {fixationYears === 1 ? 'rok' : fixationYears < 5 ? 'roky' : 'let'} vám končí fixace úrokové sazby.
        Zhruba rok předem začněte porovnávat nabídky refinancování u jiných bank — po skončení fixace lze hypotéku bez sankce přenést jinam.
      </div>
    </div>
  );
}

function Row({ label, value, highlight, bold, tooltip }: {
  label: string;
  value: string;
  highlight?: 'red' | 'green';
  bold?: boolean;
  tooltip?: string;
}) {
  const valueColor = highlight === 'red' ? 'text-red-600' : highlight === 'green' ? 'text-green-600' : 'text-gray-900 dark:text-white';
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 dark:text-gray-300 flex items-center">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      <span className={`${bold ? 'text-lg font-bold' : 'font-semibold'} ${valueColor}`}>{value}</span>
    </div>
  );
}
