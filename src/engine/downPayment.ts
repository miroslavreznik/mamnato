import type { WizardState } from '../types';
import {
  effectiveDownPayment,
  loanAmount as loanAmountOf,
  mortgagePayment,
  mortgageRate,
  loanTermYears,
  necessaryExpensesAfterPurchase,
  totalLoanInterest,
  monthlyMortgagePayment,
} from './mortgage';
import { reserveTargetMonths } from './reserve';

/**
 * Kolik dát z úspor na akontaci: čísla, ze kterých se to rozhoduje.
 *
 * Celý tenhle výpočet vznikl uvnitř posuvníku v `DownPaymentSlider`, včetně
 * vlastní konstanty výnosu akcií. Byla to matematika v komponentě, kterou
 * nešlo otestovat jinak než přes prohlížeč, a přitom rozhoduje o největší
 * jednorázové částce v celém plánu.
 *
 * Tři věci mění rozhodnutí a každá táhne jinam:
 *
 *  - **Bezpečné maximum**: po koupi musí zbýt rezerva na nezbytné výdaje.
 *    Nad tuhle hranici se akontace nevyplácí, i když by snížila splátku.
 *  - **Cena dalších sto tisíc**: o kolik klesne splátka a kolik se ušetří
 *    na úrocích. To je jistý výnos.
 *  - **Alternativa**: co by tytéž peníze mohly udělat v akciích. To je
 *    nejistý výnos, a proto se ukazuje vedle toho jistého, ne místo něj.
 */

/** Orientační dlouhodobý výnos akcií pro srovnání alternativy k akontaci. */
export const STOCK_RETURN = 0.07;

/** Modelová částka, na které se ukazuje, co akontace navíc přinese. */
export const COMPARISON_STEP = 100000;

/**
 * Rezerva, pod kterou se akontace přestává vyplácet (měsíců výdajů).
 *
 * Šest je horní konec doporučeného pásma 3–6: u největší jednorázové částky
 * v celém plánu je namístě opatrnější konec. Kdo si ale zapne cíl „nouzová
 * rezerva" a nastaví si vlastní počet měsíců, má platit **jeho** číslo:
 * jinak by mu posuvník v Bydlení počítal bezpečné maximum proti šesti
 * měsícům, zatímco karta cíle vedle hlásí dvanáct.
 */
export const MIN_RESERVE_MONTHS = 6;

/** Kolik měsíců výdajů má po koupi zbýt, podle plánu uživatele. */
export function reserveMonthsForTradeoff(state: WizardState): number {
  return state.goals.includes('reserve')
    ? reserveTargetMonths(state)
    : MIN_RESERVE_MONTHS;
}

export interface DownPaymentTradeoff {
  /** Nezbytné měsíční výdaje po koupi (splátka a vlastnictví místo nájmu). */
  monthlyNeedAfter: number;
  /** Co po akontaci zbyde v úsporách. */
  reserve: number;
  /** Na kolik měsíců ta rezerva vystačí. */
  reserveMonths: number;
  /** Nejvyšší akontace, po které ještě zbyde rezerva na `MIN_RESERVE_MONTHS`. */
  safeMax: number;
  /** Totéž jako podíl z úspor, pro popisek posuvníku. */
  safePct: number;
  /** O kolik klesne splátka za dalších `COMPARISON_STEP` akontace. */
  paymentDelta: number;
  /** Kolik se tím ušetří na úrocích za celou dobu splácení. */
  interestDelta: number;
  /** Kolik by ze zbylé rezervy bylo v akciích na konci splatnosti. */
  stockValue: number;
  /** Kolik úroků by se ušetřilo, kdyby ta rezerva šla do akontace. */
  interestSavedByReserve: number;
}

export function downPaymentTradeoff(state: WizardState): DownPaymentTradeoff {
  const totalSavings = state.savings.totalSavings;
  const dpValue = effectiveDownPayment(state);
  const reserve = Math.max(0, totalSavings - dpValue);

  const rate = mortgageRate(state);
  const term = loanTermYears(state);
  const loan = loanAmountOf(state);
  const payment = mortgagePayment(state);

  // Nezbytné výdaje po koupi. Minimum 1, aby dělení nikdy nespadlo.
  const monthlyNeedAfter = Math.max(1, necessaryExpensesAfterPurchase(state));

  const safeMax = Math.max(0, Math.min(totalSavings, totalSavings - reserveMonthsForTradeoff(state) * monthlyNeedAfter));

  return {
    monthlyNeedAfter,
    reserve,
    reserveMonths: reserve / monthlyNeedAfter,
    safeMax,
    safePct: totalSavings > 0 ? Math.round((safeMax / totalSavings) * 100) : 0,
    paymentDelta: loan > COMPARISON_STEP
      ? payment - monthlyMortgagePayment(loan - COMPARISON_STEP, rate, term)
      : payment,
    interestDelta: totalLoanInterest(loan, rate, term)
      - totalLoanInterest(Math.max(0, loan - COMPARISON_STEP), rate, term),
    stockValue: reserve > 0 ? reserve * Math.pow(1 + STOCK_RETURN, term) : 0,
    interestSavedByReserve: reserve > 0
      ? totalLoanInterest(loan, rate, term) - totalLoanInterest(Math.max(0, loan - reserve), rate, term)
      : 0,
  };
}
