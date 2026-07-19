import type { WizardState } from '../types';
import { DEFAULTS } from './defaults';
import { totalMonthlyIncome, monthlyDisposable, necessaryMonthlyExpenses } from './cashflow';

export function monthlyMortgagePayment(
  loanAmount: number,
  annualRate: number,
  termYears: number
): number {
  const r = annualRate / 12;
  const n = termYears * 12;
  if (r === 0) return loanAmount / n;
  return loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function effectiveDownPayment(state: WizardState): number {
  return state.savings.downPaymentFromSavings ?? state.savings.totalSavings;
}

// Věk žadatelů (kladné hodnoty), seřazeno není potřeba.
function applicantAges(state: WizardState): number[] {
  return [state.person1Age, state.person2Age].filter(
    (a): a is number => typeof a === 'number' && a > 0
  );
}

export function youngestApplicantAge(state: WizardState): number | undefined {
  const ages = applicantAges(state);
  return ages.length ? Math.min(...ages) : undefined;
}

export function oldestApplicantAge(state: WizardState): number | undefined {
  const ages = applicantAges(state);
  return ages.length ? Math.max(...ages) : undefined;
}

// Splňuje žadatel podmínku „do 36 let" pro vyšší LTV? Rozhoduje nejmladší
// žadatel; když věk není zadán, použije se starší přepínač (zpětná kompatibilita).
export function isUnder36(state: WizardState): boolean {
  const youngest = youngestApplicantAge(state);
  if (youngest !== undefined) return youngest < 36;
  return !!state.applicantUnder36;
}

// Povinná akontace jako podíl ceny: 20 %, u žadatelů do 36 let jen 10 %
// (ČNB umožňuje LTV až 90 %).
export function downPaymentFraction(state: WizardState): number {
  return isUnder36(state) ? DEFAULTS.ltvRequiredUnder36 : DEFAULTS.ltvRequired;
}

export function requiredDownPayment(
  propertyPrice: number,
  fraction: number = DEFAULTS.ltvRequired
): number {
  return propertyPrice * fraction;
}

export function downPaymentGap(state: WizardState): number {
  const required = requiredDownPayment(state.property.targetPrice, downPaymentFraction(state));
  return Math.max(0, required - effectiveDownPayment(state));
}

export function monthsToSaveDownPayment(state: WizardState): number {
  const gap = downPaymentGap(state);
  if (gap === 0) return 0;
  const disposable = monthlyDisposable(state);
  if (disposable <= 0) return Infinity;
  return Math.ceil(gap / disposable);
}

// Kolik měsíců vydrží rezerva PO koupi: po zaplacení akontace zbyde méně úspor
// a místo nájmu se platí (obvykle vyšší) hypotéka + náklady na vlastnictví.
export function postPurchaseRunwayMonths(state: WizardState): number {
  const reserveAfter = Math.max(0, state.savings.totalSavings - effectiveDownPayment(state));
  const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
  const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
  const loan = Math.max(0, state.property.targetPrice - effectiveDownPayment(state));
  const mortgage = monthlyMortgagePayment(loan, rate, term);
  const ownership = state.property.ownershipCosts ?? DEFAULTS.property.ownershipCosts;
  const necessaryAfter =
    necessaryMonthlyExpenses(state) - state.expenses.rent - state.expenses.utilities + mortgage + ownership;
  if (necessaryAfter <= 0) return Infinity;
  return reserveAfter / necessaryAfter;
}

export function dti(state: WizardState): number {
  const newLoan = state.property.targetPrice - effectiveDownPayment(state);
  // Limit ČNB se vztahuje na celkový dluh, tedy vč. zůstatku stávajících úvěrů.
  const totalDebt = newLoan + (state.existingDebtPrincipal ?? 0);
  const annualIncome = totalMonthlyIncome(state) * 12;
  return annualIncome > 0 ? totalDebt / annualIncome : Infinity;
}

export function dsti(state: WizardState): number {
  const mortgage = monthlyMortgagePayment(
    state.property.targetPrice - effectiveDownPayment(state),
    state.property.mortgageRate ?? DEFAULTS.property.mortgageRate,
    state.property.loanTermYears ?? DEFAULTS.property.loanTermYears
  );
  const totalPayments = mortgage + state.expenses.existingLoans;
  const income = totalMonthlyIncome(state);
  return income > 0 ? totalPayments / income : Infinity;
}
