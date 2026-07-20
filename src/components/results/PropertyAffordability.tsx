import type { WizardState } from '../../types';
import { DEFAULTS } from '../../engine/defaults';
import {
  requiredDownPayment,
  downPaymentGap,
  downPaymentFraction,
  monthlyMortgagePayment,
  monthsToSaveDownPayment,
  effectiveDownPayment,
} from '../../engine/mortgage';
import Tooltip from '../ui/Tooltip';

interface Props {
  state: WizardState;
  // Když je předáno, jde akontací hýbat přímo tady — změna se přes sdílený
  // stav promítne do celé stránky (splátka, DTI/DSTI, rezerva, časová osa…).
  onChangeDownPayment?: (value: number) => void;
}

export default function PropertyAffordability({ state, onChangeDownPayment }: Props) {
  const price = state.property.targetPrice;
  const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
  const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
  const fixationYears = state.property.fixationYears ?? DEFAULTS.property.fixationYears;
  const dpFraction = downPaymentFraction(state);
  const dpPct = Math.round(dpFraction * 100);
  const dp = requiredDownPayment(price, dpFraction);
  const gap = downPaymentGap(state);
  const dpValue = effectiveDownPayment(state);
  const loanAmount = Math.max(0, price - dpValue);
  const payment = monthlyMortgagePayment(loanAmount, rate, term);
  const months = monthsToSaveDownPayment(state);
  const totalSavings = state.savings.totalSavings;
  const reserve = totalSavings - dpValue;
  const dpOfPrice = price > 0 ? ((dpValue / price) * 100).toFixed(1) : '0';

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Kalkulačka nemovitosti</h3>

      <div className="space-y-3 text-sm">
        <Row label="Cena nemovitosti" value={`${fmt(price)} Kč`} />
        <Row
          label={`Potřebná akontace (${dpPct} %)`}
          value={`${fmt(dp)} Kč`}
          tooltip={
            dpPct === 10
              ? 'Žadateli do 36 let banka půjčí až 90 % ceny (LTV), takže z vlastního stačí 10 %.'
              : 'Kolik banka požaduje zaplatit z vlastních peněz. Obvykle 20 % ceny nemovitosti (LTV 80 %) — zbytek pokryje hypotéka.'
          }
        />
        <Row
          label="Pokryto z vlastních úspor"
          value={`${fmt(dpValue)} Kč`}
          tooltip="Kolik z vašich naspořených peněz vložíte do akontace. Můžete upravit posuvníkem níže — vše se hned přepočítá."
        />
        <Row
          label="Chybějící akontace"
          value={`${fmt(gap)} Kč`}
          highlight={gap > 0 ? 'red' : 'green'}
          tooltip="Rozdíl mezi potřebnou akontací a tím, co pokryjete z úspor. Tuto částku je potřeba ještě naspořit, než se dá o hypotéku požádat."
        />

        {/* Posuvník akontace — hýbe celou stránkou přes sdílený stav */}
        {onChangeDownPayment && totalSavings > 0 && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Kolik dát z úspor na akontaci</span>
              <span className={`text-xs ${Number(dpOfPrice) >= dpPct ? 'text-green-600' : 'text-amber-600'}`}>
                {dpOfPrice} % z ceny
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={totalSavings}
              step={10000}
              value={dpValue}
              onChange={(e) => onChangeDownPayment(Number(e.target.value))}
              aria-label="Akontace z úspor"
              className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0 Kč</span>
              <span>{fmt(totalSavings)} Kč</span>
            </div>
            <div className="flex justify-between text-sm mt-1.5">
              <span className="text-gray-600 dark:text-gray-400">Zbývající rezerva po akontaci:</span>
              <span className={`font-semibold ${reserve <= 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{fmt(reserve)} Kč</span>
            </div>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Vyšší akontace = nižší splátka a DSTI, ale menší rezerva. Sledujte, jak se mění splátka níže, dlaždice v Souhrnu i časová osa jmění.
            </p>
          </div>
        )}

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
