import type { WizardState } from '../types';
import { DEFAULTS } from './defaults';
import { totalMonthlyIncome, monthlyDisposable } from './cashflow';

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

// Povinná akontace jako podíl ceny: 20 %, u žadatelů do 36 let jen 10 %
// (ČNB umožňuje LTV až 90 %).
export function downPaymentFraction(state: WizardState): number {
  return state.applicantUnder36 ? DEFAULTS.ltvRequiredUnder36 : DEFAULTS.ltvRequired;
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
