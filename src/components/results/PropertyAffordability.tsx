import type { WizardState } from '../../types';
import {
  requiredDownPayment,
  downPaymentGap,
  downPaymentFraction,
  effectiveDownPayment,
  mortgageRate,
  loanTermYears,
  loanAmount as loanAmountOf,
  mortgagePayment,
  fixationYears as fixationYearsOf,
  totalProjectCost,
} from '../../engine/mortgage';
import { monthsToSaveAtAllocation } from '../../engine/allocation';
import { formatMonths, formatYears, czk, czkPerMonth, formatRate } from '../../engine/format';
import { Row } from './property/shared';
import DownPaymentSlider from './property/DownPaymentSlider';
import MonthlySavingSlider from './property/MonthlySavingSlider';
import RateSlider from './property/RateSlider';
import OneOffCosts from './property/OneOffCosts';

interface Props {
  state: WizardState;
  // Když je předáno, jde akontací hýbat přímo tady, změna se přes sdílený
  // stav promítne do celé stránky (splátka, DTI/DSTI, rezerva, časová osa…).
  onChangeDownPayment?: (value: number) => void;
  // Totéž pro úrokovou sazbu, druhá páka, která nejvíc hýbe splátkou.
  onChangeRate?: (value: number) => void;
  // Měsíční odkládání na chybějící akontaci. Je to cíl jako každý jiný,
  // proto se z něj počítá i čas na naspoření a ukusuje z rozpočtu.
  monthlySaving?: number;
  onChangeMonthlySaving?: (value: number) => void;
}

/**
 * Karta nemovitosti: přehled čísel a dvě páky, kterými jde hýbat.
 *
 * Samotné bloky (posuvník akontace, posuvník sazby, jednorázové náklady) jsou
 * v `./property/`. Každý si čísla dopočítá sám z enginu, takže se sem
 * neprotahují desítkami propů a jde je číst i upravovat samostatně.
 */
export default function PropertyAffordability({
  state,
  onChangeDownPayment,
  onChangeRate,
  monthlySaving = 0,
  onChangeMonthlySaving,
}: Props) {
  const projectCost = totalProjectCost(state);
  const dpFraction = downPaymentFraction(state);
  const dpPct = Math.round(dpFraction * 100);
  const dp = requiredDownPayment(projectCost, dpFraction);
  const gap = downPaymentGap(state);
  const months = monthsToSaveAtAllocation(state, monthlySaving);
  const fixationYears = fixationYearsOf(state);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Kalkulačka nemovitosti</h3>

      <div className="space-y-3 text-sm">
        <Row label="Cena nemovitosti" value={czk(state.property.targetPrice)} />
        <Row
          label={`Potřebná akontace (${dpPct} %)`}
          value={czk(dp)}
          tooltip={
            dpPct === 10
              ? 'Žadateli do 36 let banka půjčí až 90 % ceny (LTV), takže z vlastního stačí 10 %.'
              : 'Kolik banka požaduje zaplatit z vlastních peněz. Obvykle 20 % ceny nemovitosti (LTV 80 %), zbytek pokryje hypotéka.'
          }
        />
        <Row
          label="Pokryto z vlastních úspor"
          value={czk(effectiveDownPayment(state))}
          tooltip="Kolik z vašich naspořených peněz vložíte do akontace. Můžete upravit posuvníkem níže. Vše se hned přepočítá."
        />
        <Row
          label="Chybějící akontace"
          value={czk(gap)}
          highlight={gap > 0 ? 'red' : 'green'}
          tooltip="Rozdíl mezi potřebnou akontací a tím, co pokryjete z úspor. Tuto částku je potřeba ještě naspořit, než se dá o hypotéku požádat."
        />

        {onChangeDownPayment && <DownPaymentSlider state={state} onChange={onChangeDownPayment} />}
        {onChangeMonthlySaving && (
          <MonthlySavingSlider state={state} value={monthlySaving} onChange={onChangeMonthlySaving} />
        )}
        {onChangeRate && <RateSlider state={state} onChange={onChangeRate} />}

        <div className="border-t dark:border-gray-600 pt-3" />

        <Row label="Výše hypotéky" value={czk(loanAmountOf(state))} />
        <Row label="Odhadovaná měsíční splátka" value={czkPerMonth(mortgagePayment(state))} bold />
        {!onChangeRate && <Row label="Úroková sazba" value={`${formatRate(mortgageRate(state))} % ročně`} />}
        <Row label="Délka hypotéky" value={`${loanTermYears(state)} let`} />
        <Row label="Fixace sazby" value={formatYears(fixationYears)} />

        {gap > 0 && months !== Infinity && (
          <>
            <div className="border-t dark:border-gray-600 pt-3" />
            <Row
              label="Čas na naspoření chybějící akontace"
              value={formatMonths(months)}
              tooltip={`Chybějící akontace (${czk(gap)}) dělená tím, co na ni měsíčně odkládáte (${czkPerMonth(monthlySaving)}). Částku změníte posuvníkem výše.`}
            />
          </>
        )}
        {months === Infinity && gap > 0 && (
          <>
            <div className="border-t dark:border-gray-600 pt-3" />
            <p className="text-amber-600 dark:text-amber-400 text-sm">
              Dokud na akontaci nic měsíčně neodkládáte, chybějících {czk(gap)} nenaspoříte.
              Nastavte částku posuvníkem výše.
            </p>
          </>
        )}
      </div>

      <OneOffCosts state={state} />

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        <span className="font-semibold">Nezapomeňte na refixaci.</span>{' '}
        Za {formatYears(fixationYears)} vám končí fixace úrokové sazby.
        Zhruba rok předem začněte porovnávat nabídky refinancování u jiných bank. Po skončení fixace lze hypotéku bez sankce přenést jinam.
      </div>
    </div>
  );
}
