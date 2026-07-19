import type { WizardState } from '../types';
import { totalMonthlyIncome, totalMonthlyExpenses } from './cashflow';
import { monthlyMortgagePayment, effectiveDownPayment } from './mortgage';
import { DEFAULTS } from './defaults';

// Rodičovský příspěvek na jedno dítě (od 2024). Rozpočítaný na dobu čerpání
// dává orientační měsíční dávku; mateřská (PPM) na začátku bývá vyšší, proto
// je částka uživatelsky nastavitelná.
export const RODICOVSKA_POOL = 350000;

// Výchozí měsíční příjem během volna = rodičovský příspěvek rozložený na dobu čerpání.
export function defaultMonthlyBenefit(durationMonths: number): number {
  return Math.round(RODICOVSKA_POOL / Math.max(1, durationMonths));
}

export function parentSalary(state: WizardState, parent: 1 | 2): number {
  return parent === 1
    ? state.income.person1NetMonthly ?? 0
    : state.income.person2NetMonthly ?? 0;
}

// Rozumný výchozí pečující rodič = ten s nižším příjmem (menší výpadek).
export function defaultCaringParent(state: WizardState): 1 | 2 {
  const p1 = state.income.person1NetMonthly ?? 0;
  const p2 = state.income.person2NetMonthly ?? 0;
  return p2 > 0 && p2 < p1 ? 2 : 1;
}

export interface LeaveImpact {
  parent: 1 | 2;
  durationMonths: number;
  monthlyBenefit: number;
  lostSalary: number;
  incomeNow: number;
  incomeDuringLeave: number;
  disposableNow: number;
  disposableDuringLeave: number;
  // Disponibilní částka během volna už po koupi (splátka místo nájmu) — jen když je cíl nemovitost
  disposableDuringLeaveAfterPurchase: number | null;
  savingsLostTotal: number; // o kolik méně naspoříte za celé volno
  // Krytí schodku z rezervy: kolik úspor zbyde (po akontaci, když se kupuje),
  // měsíční schodek během volna a kolik měsíců volna rezerva pokryje.
  reserveAfter: number;
  shortfallPerMonth: number; // 0 = během volna žádný schodek
  shortfallTotal: number;
  monthsCovered: number | null; // null = žádný schodek; jinak počet pokrytých měsíců
}

// Mimo React testovatelné vyhodnocení dopadu rodičovské. Vrací null, když
// scénář není zapnutý.
export function evaluateParentalLeave(state: WizardState): LeaveImpact | null {
  const pl = state.parentalLeave;
  if (!pl || !pl.enabled) return null;

  const lostSalary = parentSalary(state, pl.parent);
  const incomeNow = totalMonthlyIncome(state);
  const incomeDuringLeave = incomeNow - lostSalary + pl.monthlyBenefit;
  const expenses = totalMonthlyExpenses(state);

  const disposableNow = incomeNow - expenses;
  const disposableDuringLeave = incomeDuringLeave - expenses;

  let disposableDuringLeaveAfterPurchase: number | null = null;
  if (state.goals.includes('property')) {
    const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
    const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
    const loan = Math.max(0, state.property.targetPrice - effectiveDownPayment(state));
    const mortgage = monthlyMortgagePayment(loan, rate, term);
    const ownership = state.property.ownershipCosts ?? DEFAULTS.property.ownershipCosts;
    // Po koupi mizí nájem + energie, přibývá splátka + náklady na vlastnictví.
    const expensesAfter = expenses - state.expenses.rent - state.expenses.utilities + mortgage + ownership;
    disposableDuringLeaveAfterPurchase = incomeDuringLeave - expensesAfter;
  }

  const savingsLostTotal = Math.max(0, disposableNow - disposableDuringLeave) * pl.durationMonths;

  // Rezerva, ze které se dá schodek během volna krýt. Když se kupuje nemovitost,
  // většina úspor padne na akontaci — počítáme s tím, co zbyde po ní.
  const isBuying = state.goals.includes('property');
  const reserveAfter = Math.max(0, state.savings.totalSavings - (isBuying ? effectiveDownPayment(state) : 0));
  const relevantDisposable = disposableDuringLeaveAfterPurchase ?? disposableDuringLeave;
  const shortfallPerMonth = Math.max(0, -relevantDisposable);
  const shortfallTotal = shortfallPerMonth * pl.durationMonths;
  const monthsCovered = shortfallPerMonth > 0 ? Math.floor(reserveAfter / shortfallPerMonth) : null;

  return {
    parent: pl.parent,
    durationMonths: pl.durationMonths,
    monthlyBenefit: pl.monthlyBenefit,
    lostSalary,
    incomeNow,
    incomeDuringLeave,
    disposableNow,
    disposableDuringLeave,
    disposableDuringLeaveAfterPurchase,
    savingsLostTotal,
    reserveAfter,
    shortfallPerMonth,
    shortfallTotal,
    monthsCovered,
  };
}

// Je scénář rodičovské relevantní (cíl dítě + pár/rodina se dvěma příjmy)?
export function parentalLeaveApplicable(state: WizardState): boolean {
  const twoIncomes = (state.income.person2NetMonthly ?? 0) > 0;
  return state.goals.includes('child') && (state.mode === 'couple' || state.mode === 'family') && twoIncomes;
}
