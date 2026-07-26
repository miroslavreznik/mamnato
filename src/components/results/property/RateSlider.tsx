import type { WizardState } from '../../../types';
import { mortgageRate, mortgagePayment, fixationYears as fixationYearsOf } from '../../../engine/mortgage';
import { ltvRateAdvice, paymentAtRate } from '../../../engine/rateGuidance';
import { czk, czkPerMonth, formatMonths, formatYears, formatRate } from '../../../engine/format';
import Tooltip from '../../ui/Tooltip';
import { StepButton, SliderCard } from './shared';

// Rozsah posuvníku sazby, pokrývá historické minimum i vyšší scénáře.
const RATE_MIN = 0.02;
const RATE_MAX = 0.09;
// Krok krokovacích tlačítek (0,1 p. b.).
const STEP = 0.001;

/**
 * Úroková sazba: druhá hlavní páka splátky, hned po akontaci.
 *
 * Pod posuvníkem je všechno, co sazbu v realitě určuje: pásmo LTV, upozornění
 * na odhad banky (LTV počítáme z ceny, banka ze svého odhadu) a riziko
 * refixace včetně toho, jestli fixace nekončí zrovna během rodičovské.
 */
export default function RateSlider({ state, onChange }: {
  state: WizardState;
  onChange: (value: number) => void;
}) {
  const rate = mortgageRate(state);
  const advice = ltvRateAdvice(state);
  const ltvPct = advice ? Math.round(advice.ltv * 100) : 0;
  const paymentPlus1pp = paymentAtRate(state, rate + 0.01) - mortgagePayment(state);

  const fixationYears = fixationYearsOf(state);
  // Konec fixace uprostřed rodičovské je nejhorší možné načasování: splátka
  // povyskočí zrovna ve chvíli, kdy je rozpočet nejtenčí.
  const leaveMonths = state.parentalLeave?.enabled ? state.parentalLeave.durationMonths : 0;
  const fixationEndsDuringLeave = leaveMonths > 0 && fixationYears * 12 <= leaveMonths;

  const clampStep = (next: number) => Number(next.toFixed(4));

  return (
    <SliderCard>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
          Úroková sazba
          <Tooltip text="Sazbu si nasmlouváte s bankou. Banky ji odstupňovávají podle LTV (jakou část ceny si půjčujete), čím víc dáte z vlastního, tím nižší sazbu obvykle dostanete. Posuňte a uvidíte, jak se změní splátka i celé výsledky." />
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatRate(rate)} % ročně</span>
      </div>

      <div className="flex items-center gap-2">
        <StepButton
          onClick={() => onChange(clampStep(Math.max(RATE_MIN, rate - STEP)))}
          disabled={rate <= RATE_MIN}
          label="Snížit úrokovou sazbu"
        >
          −
        </StepButton>
        <input
          type="range"
          min={RATE_MIN * 100}
          max={RATE_MAX * 100}
          step={0.1}
          value={Number((rate * 100).toFixed(2))}
          onChange={(e) => onChange(clampStep(Number(e.target.value) / 100))}
          aria-label="Úroková sazba"
          className="flex-1 min-w-0 h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 bg-gradient-to-r from-green-400/50 to-red-400/50"
        />
        <StepButton
          onClick={() => onChange(clampStep(Math.min(RATE_MAX, rate + STEP)))}
          disabled={rate >= RATE_MAX}
          label="Zvýšit úrokovou sazbu"
        >
          +
        </StepButton>
      </div>

      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{formatRate(RATE_MIN)} %</span>
        <span>{formatRate(RATE_MAX)} %</span>
      </div>

      {advice && (
        <div className="mt-2 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">Vaše LTV je {ltvPct} %</span>,
            pásmo {advice.band.label}.{' '}
            {advice.band.key === 'best' && 'To je nejlepší pásmo, banky tu nabízejí nejnižší sazby.'}
            {advice.band.key === 'standard' && 'Standardní pásmo: pod 80 % LTV už banky nepřidávají rizikovou přirážku.'}
            {advice.band.key === 'high' && 'Nad 80 % LTV si banky obvykle připlácejí rizikovou přirážku k sazbě.'}
          </p>

          {!advice.band.available && (
            <p className="text-red-600 dark:text-red-400">
              Nad 90 % LTV hypotéku nedostanete (limit ČNB). Je potřeba vyšší akontace.
            </p>
          )}

          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">Pozor na odhad banky:</span>{' '}
            LTV počítáme z ceny, kterou jste zadali. Banka ho ale počítá ze svého odhadu, a ten
            bývá spíš konzervativní. Když odhadce dům ocení níž, spadnete do horšího pásma a
            rozdíl musíte doplatit z vlastních peněz. Vyplatí se nechat si odhad udělat u víc bank.
          </p>

          {advice.nextBand && advice.extraDownPayment > 0 && advice.rateDrop > 0 && (
            <p className={advice.affordable ? 'text-green-700 dark:text-green-400' : ''}>
              <span className="font-medium">Tip:</span>{' '}
              kdybyste do akontace dali o {czk(advice.extraDownPayment)} víc, dostanete se pod{' '}
              {Math.round(advice.nextBand.maxLtv * 100)} % LTV. Tam banky dávají sazbu zhruba o{' '}
              {(advice.rateDrop * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} p. b. nižší,
              splátka by klesla přibližně o {czkPerMonth(advice.monthlySaving)}.
              {!advice.affordable && ' Na to by ale vaše úspory zatím nestačily.'}
            </p>
          )}

          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">Riziko refixace:</span>{' '}
            kdyby sazba za {formatYears(fixationYears)} stoupla o 1 p. b.,
            splátka povyskočí o ~{czkPerMonth(paymentPlus1pp)}.
            {fixationEndsDuringLeave && (
              <>
                {' '}<span className="text-amber-600 dark:text-amber-400">
                  Fixace vám navíc skončí ve chvíli, kdy podle svého plánu můžete být na rodičovské
                  (volno máte nastavené na {formatMonths(leaveMonths)}). Skokové zvýšení splátky by
                  tak padlo do nejtenčího období rozpočtu. Delší fixace tomu předejde, i za cenu
                  o něco vyšší sazby.
                </span>
              </>
            )}
          </p>

          <p className="text-gray-400 dark:text-gray-500">
            Přirážky podle LTV jsou orientační tržní zvyklost. Konkrétní sazbu vždy potvrdí až banka.
          </p>
        </div>
      )}
    </SliderCard>
  );
}
