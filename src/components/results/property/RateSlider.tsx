import type { WizardState } from '../../../types';
import { mortgageRate, mortgagePayment, fixationYears as fixationYearsOf } from '../../../engine/mortgage';
import { ltvRateAdvice, paymentAfterRefixation } from '../../../engine/rateGuidance';
import { czk, czkMonthly, czkPerMonth, formatYears, formatRate } from '../../../engine/format';
import Tooltip from '../../ui/Tooltip';
import { StepButton, SliderCard } from './shared';
import Disclosure from '../../ui/Disclosure';

// Rozsah posuvníku sazby, pokrývá historické minimum i vyšší scénáře.
const RATE_MIN = 0.02;
const RATE_MAX = 0.09;
// Krok krokovacích tlačítek (0,1 p. b.).
const STEP = 0.001;

/**
 * Úroková sazba: druhá hlavní páka splátky, hned po akontaci.
 *
 * Pod posuvníkem je všechno, co sazbu v realitě určuje: pásmo LTV, upozornění
 * na odhad banky a riziko změny sazby po fixaci.
 */
export default function RateSlider({ state, onChange }: {
  state: WizardState;
  onChange: (value: number) => void;
}) {
  const rate = mortgageRate(state);
  const advice = ltvRateAdvice(state);
  const ltvPct = advice ? Math.round(advice.ltv * 100) : 0;
  const refixedPayment = paymentAfterRefixation(state, rate + 0.01);

  const fixationYears = fixationYearsOf(state);
  const clampStep = (next: number) => Number(next.toFixed(4));

  return (
    <SliderCard>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-ink-label flex items-center">
          Úroková sazba
          <Tooltip text="Sazbu si nasmlouváte s bankou. Banky ji odstupňovávají podle LTV (jakou část ceny si půjčujete), čím víc dáte z vlastního, tím nižší sazbu obvykle dostanete. Posuňte a uvidíte, jak se změní splátka i celé výsledky." />
        </span>
        <span className="text-sm font-semibold text-ink">{formatRate(rate)} % ročně</span>
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
          className="flex-1 min-w-0 h-2 rounded-lg appearance-none cursor-pointer accent-brand bg-gradient-to-r from-ribbon-calm to-ribbon-deficit"
        />
        <StepButton
          onClick={() => onChange(clampStep(Math.min(RATE_MAX, rate + STEP)))}
          disabled={rate >= RATE_MAX}
          label="Zvýšit úrokovou sazbu"
        >
          +
        </StepButton>
      </div>

      <div className="flex justify-between text-xs text-ink-faint mt-1">
        <span>{formatRate(RATE_MIN)} %</span>
        <span>{formatRate(RATE_MAX)} %</span>
      </div>

      {advice && (
        <div className="mt-2 space-y-1.5 text-xs text-ink-muted">
          <p>
            <span className="font-medium text-ink-label">Vaše LTV je {ltvPct} %</span>,
            pásmo {advice.band.label}.{' '}
            {advice.band.key === 'best' && 'To je nejlepší pásmo, banky tu nabízejí nejnižší sazby.'}
            {advice.band.key === 'standard' && 'Standardní pásmo: pod 80 % LTV už banky nepřidávají rizikovou přirážku.'}
            {advice.band.key === 'high' && 'Nad 80 % LTV si banky obvykle připlácejí rizikovou přirážku k sazbě.'}
          </p>

          {!advice.band.available && (
            <p className="text-danger">
              Nad 90 % LTV hypotéku nedostanete (limit ČNB). Je potřeba vyšší akontace.
            </p>
          )}

          <Disclosure summary="Pozor na odhad banky">
            <p className="pb-1">
              Banka porovnává úvěr s hodnotou nemovitosti podle odhadu. Pokud odhad neznáte,
              použijeme kupní cenu. Nižší odhad může zvýšit částku, kterou zaplatíte z vlastních peněz.
            </p>
          </Disclosure>

          {advice.nextBand && advice.extraDownPayment > 0 && advice.rateDrop > 0 && (
            <p className={advice.affordable ? 'text-good' : ''}>
              <span className="font-medium">Tip:</span>{' '}
              kdybyste do akontace dali o {czk(advice.extraDownPayment)} víc, dostanete se pod{' '}
              {Math.round(advice.nextBand.maxLtv * 100)} % LTV. Tam banky dávají sazbu zhruba o{' '}
              {(advice.rateDrop * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} p. b. nižší,
              splátka by klesla přibližně o {czkPerMonth(advice.monthlySaving)}.
              {!advice.affordable && ' Na to by ale vaše úspory zatím nestačily.'}
            </p>
          )}

          {refixedPayment != null && (
            <p>
              Po {formatYears(fixationYears)} fixace by zvýšení sazby o 1 procentní bod zvedlo splátku
              přibližně o {czkMonthly(Math.max(0, refixedPayment - mortgagePayment(state)))}.
            </p>
          )}

          <p className="text-ink-faint">
            Přirážky podle LTV jsou orientační, konkrétní sazbu potvrdí až banka.
          </p>
        </div>
      )}
    </SliderCard>
  );
}
