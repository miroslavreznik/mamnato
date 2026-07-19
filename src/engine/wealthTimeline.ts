import type { WizardState } from '../types';
import { DEFAULTS, CHILD_COSTS_CZ } from './defaults';
import { totalMonthlyIncome, totalMonthlyExpenses } from './cashflow';
import { monthlyMortgagePayment, requiredDownPayment, downPaymentFraction } from './mortgage';
import { parentSalary } from './parentalLeave';

// Časová osa jmění: měsíc po měsíci simuluje vývoj úspor domácnosti přes
// plánované životní události — spoření na akontaci, koupi (jednorázový pokles
// o akontaci a přechod z nájmu na hypotéku), narození dítěte (náklady dle
// věku) a rodičovskou (výpadek mzdy nahrazený dávkami).
//
// Záměrná zjednodušení: příjmy a výdaje jsou konstantní, výnosy z investic
// a inflaci nepočítáme (konzervativní odhad). Spoření na cíle zůstává součástí
// jmění (peníze se jen přesouvají), proto se tady neodečítá.

export interface WealthPoint {
  month: number;
  cash: number;
}

export interface WealthTimelineResult {
  points: WealthPoint[];
  purchaseMonth: number | null; // null = koupě se v horizontu nekoná
  childMonth: number | null;
  leaveEndMonth: number | null;
  minCash: number;
  minCashMonth: number;
  firstNegativeMonth: number | null;
}

// Měsíční náklady na dítě dle věku (0–18 let; VŠ do časové osy nezahrnujeme).
function childCostAt(ageYears: number): number {
  const bracket = CHILD_COSTS_CZ.find((r) => r.to <= 18 && ageYears >= r.from && ageYears < r.to);
  return bracket?.monthlyCost ?? 0;
}

export function wealthTimeline(
  state: WizardState,
  opts: { months?: number; childOffsetMonths?: number } = {}
): WealthTimelineResult {
  const horizon = opts.months ?? 120;
  const hasProperty = state.goals.includes('property');
  const hasChild = state.goals.includes('child');

  const baseIncome = totalMonthlyIncome(state);
  const baseExpenses = totalMonthlyExpenses(state);
  const rent = state.expenses.rent + state.expenses.utilities;

  // Cílová akontace: požadovaná dle LTV; když si uživatel vyhradil víc, platí jeho volba.
  const price = state.property.targetPrice;
  const required = requiredDownPayment(price, downPaymentFraction(state));
  const chosen = state.savings.downPaymentFromSavings;
  const targetDownPayment = chosen != null ? Math.max(required, chosen) : required;
  const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
  const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
  const ownership = state.property.ownershipCosts ?? DEFAULTS.property.ownershipCosts;
  const mortgage = monthlyMortgagePayment(Math.max(0, price - targetDownPayment), rate, term);

  const childMonth = hasChild ? Math.max(0, Math.round(opts.childOffsetMonths ?? 12)) : null;
  const pl = state.parentalLeave;
  const leaveActive = !!pl?.enabled && childMonth !== null;
  const leaveEndMonth = leaveActive ? childMonth! + pl!.durationMonths : null;

  const points: WealthPoint[] = [];
  let cash = state.savings.totalSavings;
  let purchaseMonth: number | null = null;
  let minCash = cash;
  let minCashMonth = 0;
  let firstNegativeMonth: number | null = null;

  points.push({ month: 0, cash: Math.round(cash) });

  for (let m = 0; m < horizon; m++) {
    // Koupě: jakmile je na cílovou akontaci naspořeno (dynamicky — zohlední
    // i to, že dítě nebo rodičovská spoření zpomalí).
    if (hasProperty && purchaseMonth === null && cash >= targetDownPayment) {
      purchaseMonth = m;
      cash -= targetDownPayment;
    }

    let income = baseIncome;
    if (leaveActive && m >= childMonth! && m < leaveEndMonth!) {
      income = income - parentSalary(state, pl!.parent) + pl!.monthlyBenefit;
    }

    let expenses = baseExpenses;
    if (purchaseMonth !== null) expenses = expenses - rent + mortgage + ownership;
    if (childMonth !== null && m >= childMonth) expenses += childCostAt((m - childMonth) / 12);

    cash += income - expenses;

    if (cash < minCash) {
      minCash = cash;
      minCashMonth = m + 1;
    }
    if (cash < 0 && firstNegativeMonth === null) firstNegativeMonth = m + 1;

    points.push({ month: m + 1, cash: Math.round(cash) });
  }

  return {
    points,
    purchaseMonth,
    childMonth,
    leaveEndMonth,
    minCash: Math.round(minCash),
    minCashMonth,
    firstNegativeMonth,
  };
}
