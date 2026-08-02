import type { WizardState } from '../../../types';
import {
  effectiveDownPayment,
  downPaymentFraction,
  loanAmount as loanAmountOf,
  mortgageRate,
  loanTermYears,
  totalProjectCost,
} from '../../../engine/mortgage';
import {
  downPaymentTradeoff, STOCK_RETURN, COMPARISON_STEP, reserveMonthsForTradeoff,
} from '../../../engine/downPayment';
import { czk, czkPerMonth, decimal, formatNumber as fmt, formatRate } from '../../../engine/format';
import { StepButton, SliderCard } from './shared';

// O kolik se hýbe krokovacími tlačítky a jaký krok má posuvník.
// Zbytek konstant (výnos akcií, modelová částka, minimální rezerva) je
// v `engine/downPayment.ts` u výpočtu, který je používá.
const STEP = 10000;

/**
 * Kolik z úspor dát na akontaci.
 *
 * Posuvník hýbe celou stránkou přes sdílený stav, takže se hned přepočítá
 * splátka, DSTI i verdikt. Kolem něj jsou tři věci, které rozhodování mění:
 * bezpečná hranice (aby zbyla rezerva), cena každých dalších 100 000 Kč
 * a srovnání s alternativou nechat peníze v investicích.
 */
export default function DownPaymentSlider({ state, onChange }: {
  state: WizardState;
  onChange: (value: number) => void;
}) {
  const totalSavings = state.savings.totalSavings;
  if (totalSavings <= 0) return null;

  const projectCost = totalProjectCost(state);
  const dpValue = effectiveDownPayment(state);
  const dpPct = Math.round(downPaymentFraction(state) * 100);
  const dpOfPrice = projectCost > 0 ? (dpValue / projectCost) * 100 : 0;

  const rate = mortgageRate(state);
  const term = loanTermYears(state);
  const loanAmount = loanAmountOf(state);

  // Matematika kolem posuvníku je v enginu: rozhoduje o největší jednorázové
  // částce v plánu a patří k ní testy, ne jen prohlížeč.
  const {
    reserve, reserveMonths, safeMax, safePct,
    paymentDelta, interestDelta, stockValue, interestSavedByReserve,
  } = downPaymentTradeoff(state);
  // Kolik měsíců výdajů má po koupi zbýt. S cílem „nouzová rezerva" platí
  // uživatelovo číslo, jinak doporučených šest.
  const minReserveMonths = reserveMonthsForTradeoff(state);

  return (
    <SliderCard>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-ink-label">Kolik dát z úspor na akontaci</span>
        <span className={`text-xs ${dpOfPrice >= dpPct ? 'text-good' : 'text-caution'}`}>
          {dpOfPrice.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} % z ceny
        </span>
      </div>

      <div className="flex items-center gap-2">
        <StepButton onClick={() => onChange(Math.max(0, dpValue - STEP))} disabled={dpValue <= 0} label="Snížit akontaci">
          −
        </StepButton>
        <input
          type="range"
          min={0}
          max={totalSavings}
          step={STEP}
          value={dpValue}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Akontace z úspor"
          className="flex-1 min-w-0 h-2 rounded-lg appearance-none cursor-pointer accent-brand"
          style={{
            background: `linear-gradient(to right, rgba(16,185,129,0.45) 0%, rgba(16,185,129,0.45) ${safePct}%, rgba(245,158,11,0.5) ${safePct}%, rgba(245,158,11,0.5) 100%)`,
          }}
        />
        <StepButton
          onClick={() => onChange(Math.min(totalSavings, dpValue + STEP))}
          disabled={dpValue >= totalSavings}
          label="Zvýšit akontaci"
        >
          +
        </StepButton>
      </div>

      <div className="flex justify-between text-xs text-ink-faint mt-1">
        <span>0 Kč</span>
        <span>{czk(totalSavings)}</span>
      </div>

      <div className="flex flex-wrap justify-between gap-x-2 text-sm mt-1.5">
        <span className="text-ink-body">Zbývající rezerva po akontaci:</span>
        <span className={`font-semibold ${reserve <= 0 ? 'text-danger' : reserveMonths < minReserveMonths ? 'text-caution' : 'text-ink'}`}>
          {czk(reserve)}{reserve > 0 && isFinite(reserveMonths) ? ` (~${decimal(reserveMonths)} měs. výdajů)` : ''}
        </span>
      </div>

      {safeMax > 0 ? (
        <p className={`mt-1.5 text-xs ${dpValue > safeMax ? 'text-caution' : 'text-ink-muted'}`}>
          {dpValue > safeMax
            ? `Jste za bezpečnou hranicí. Nad ${czk(safeMax)} akontace zbyde rezerva na méně než ${minReserveMonths} měsíců výdajů.`
            : `Bezpečné maximum: ${czk(safeMax)} (zelená zóna), víc by nechalo rezervu pod ${minReserveMonths} měsíci výdajů po koupi.`}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-caution">
          Úspory zatím nestačí na akontaci a zároveň {minReserveMonths}měsíční rezervu. Jakákoli akontace rezervu ukrojí.
        </p>
      )}

      <div className="mt-2.5 pt-2.5 border-t border-line space-y-1.5 text-xs text-ink-muted">
        <p>
          <span className="font-medium text-ink-label">Každých +{fmt(COMPARISON_STEP)} Kč akontace:</span>{' '}
          splátka −{czkPerMonth(paymentDelta)} a na úrocích za {term} let ušetříte ~{czk(interestDelta)},
          jistý efekt ve výši úrokové sazby ({formatRate(rate)} %).
        </p>
        {reserve > 0 && loanAmount > 0 && (
          <p>
            <span className="font-medium text-ink-label">Alternativa:</span>{' '}
            zbylých {czk(reserve)} mimo akontaci by v akciích (~{Math.round(STOCK_RETURN * 100)} % ročně)
            mohlo za {term} let vyrůst na ~{czk(stockValue)} (bez záruky). Stejná částka v akontaci by
            ušetřila jistých ~{czk(interestSavedByReserve)} na úrocích.
          </p>
        )}
        <p className="text-ink-faint">
          Vyšší akontace = nižší splátka a DSTI, ale menší rezerva. Vše níže i v Souhrnu se přepočítává živě.
        </p>
      </div>
    </SliderCard>
  );
}
