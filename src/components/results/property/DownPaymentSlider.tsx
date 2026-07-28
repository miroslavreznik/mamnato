import type { WizardState } from '../../../types';
import {
  effectiveDownPayment,
  downPaymentFraction,
  loanAmount as loanAmountOf,
  mortgagePayment,
  mortgageRate,
  loanTermYears,
  ownershipCosts as ownershipCostsOf,
  totalProjectCost,
  totalLoanInterest,
  monthlyMortgagePayment,
} from '../../../engine/mortgage';
import { necessaryMonthlyExpenses } from '../../../engine/cashflow';
import { czk, czkPerMonth, formatNumber as fmt, formatRate } from '../../../engine/format';
import { StepButton, SliderCard } from './shared';

// Orientační dlouhodobý výnos akcií pro srovnání alternativy k akontaci.
const STOCK_RETURN = 0.07;
// O kolik se hýbe krokovacími tlačítky a jaký krok má posuvník.
const STEP = 10000;
// Modelová částka, na které se ukazuje, co akontace navíc přinese.
const COMPARISON_STEP = 100000;
// Rezerva, pod kterou už se akontace přestává vyplácet (měsíců výdajů).
const MIN_RESERVE_MONTHS = 6;

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
  const reserve = totalSavings - dpValue;

  const rate = mortgageRate(state);
  const term = loanTermYears(state);
  const loanAmount = loanAmountOf(state);
  const payment = mortgagePayment(state);

  // Bezpečné maximum akontace: po koupi musí zbýt rezerva na šest měsíců
  // nezbytných výdajů (s hypotékou místo nájmu).
  const monthlyNeedAfter = Math.max(
    1,
    necessaryMonthlyExpenses(state) - state.expenses.rent - state.expenses.utilities
      + payment + ownershipCostsOf(state)
  );
  const safeMax = Math.max(0, Math.min(totalSavings, totalSavings - MIN_RESERVE_MONTHS * monthlyNeedAfter));
  const safePct = totalSavings > 0 ? Math.round((safeMax / totalSavings) * 100) : 0;
  const reserveMonths = reserve / monthlyNeedAfter;

  // Co udělá dalších 100 000 Kč akontace: nižší splátka a ušetřené úroky.
  const paymentDelta = loanAmount > COMPARISON_STEP
    ? payment - monthlyMortgagePayment(loanAmount - COMPARISON_STEP, rate, term)
    : payment;
  const interestDelta = totalLoanInterest(loanAmount, rate, term)
    - totalLoanInterest(Math.max(0, loanAmount - COMPARISON_STEP), rate, term);

  // Alternativa: co by zbylé peníze mohly vydělat v akciích vs. jistá úspora
  // na úrocích, kdyby šly do akontace.
  const stockValue = reserve > 0 ? reserve * Math.pow(1 + STOCK_RETURN, term) : 0;
  const interestSavedByReserve = reserve > 0
    ? totalLoanInterest(loanAmount, rate, term) - totalLoanInterest(Math.max(0, loanAmount - reserve), rate, term)
    : 0;

  return (
    <SliderCard>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-ink-label">Kolik dát z úspor na akontaci</span>
        <span className={`text-xs ${dpOfPrice >= dpPct ? 'text-green-600' : 'text-amber-600'}`}>
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
          className="flex-1 min-w-0 h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
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

      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0 Kč</span>
        <span>{czk(totalSavings)}</span>
      </div>

      <div className="flex flex-wrap justify-between gap-x-2 text-sm mt-1.5">
        <span className="text-gray-600 dark:text-gray-400">Zbývající rezerva po akontaci:</span>
        <span className={`font-semibold ${reserve <= 0 ? 'text-red-600' : reserveMonths < MIN_RESERVE_MONTHS ? 'text-amber-600' : 'text-ink'}`}>
          {czk(reserve)}{reserve > 0 && isFinite(reserveMonths) ? ` (~${reserveMonths.toFixed(1)} měs. výdajů)` : ''}
        </span>
      </div>

      {safeMax > 0 ? (
        <p className={`mt-1.5 text-xs ${dpValue > safeMax ? 'text-caution' : 'text-ink-muted'}`}>
          {dpValue > safeMax
            ? `Jste za bezpečnou hranicí. Nad ${czk(safeMax)} akontace zbyde rezerva na méně než ${MIN_RESERVE_MONTHS} měsíců výdajů.`
            : `Bezpečné maximum: ${czk(safeMax)} (zelená zóna), víc by nechalo rezervu pod ${MIN_RESERVE_MONTHS} měsíci výdajů po koupi.`}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-caution">
          Úspory zatím nestačí na akontaci a zároveň {MIN_RESERVE_MONTHS}měsíční rezervu. Jakákoli akontace rezervu ukrojí.
        </p>
      )}

      <div className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-600 space-y-1.5 text-xs text-ink-muted">
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
