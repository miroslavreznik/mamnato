import type { WizardState } from '../types';

// Zbytné (discretionary) výdaje — dají se v případě výpadku příjmů omezit.
// Záměrně konzervativní: pouze kategorie „other" (zábava, dovolená, koníčky, předplatné).
// Ostatní kategorie (nájem, energie, jídlo, doprava, …) považujeme za nezbytné.
export const DISCRETIONARY_FIELDS = ['other'] as const;

export function totalMonthlyIncome(state: WizardState): number {
  return (state.income.person1NetMonthly ?? 0)
    + (state.income.person2NetMonthly ?? 0)
    + (state.income.parentalAllowance ?? 0);
}

export function totalMonthlyExpenses(state: WizardState): number {
  const e = state.expenses;
  return e.rent + e.existingLoans + e.insurance + e.food
    + e.transport + e.children + e.utilities + e.other;
}

export function discretionaryMonthlyExpenses(state: WizardState): number {
  return DISCRETIONARY_FIELDS.reduce((sum, field) => sum + (state.expenses[field] ?? 0), 0);
}

export function necessaryMonthlyExpenses(state: WizardState): number {
  return totalMonthlyExpenses(state) - discretionaryMonthlyExpenses(state);
}

// Kolik měsíců pokryjí úspory nezbytné výdaje, pokud vypadne příjem (runway).
export function emergencyRunwayMonths(state: WizardState): number {
  const necessary = necessaryMonthlyExpenses(state);
  if (necessary <= 0) return Infinity;
  return state.savings.totalSavings / necessary;
}

export function monthlyDisposable(state: WizardState): number {
  return totalMonthlyIncome(state) - totalMonthlyExpenses(state);
}

export function savingsRate(state: WizardState): number {
  const income = totalMonthlyIncome(state);
  return income > 0 ? monthlyDisposable(state) / income : 0;
}
