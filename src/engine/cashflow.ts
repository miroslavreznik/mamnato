import type { WizardState } from '../types';

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

export function monthlyDisposable(state: WizardState): number {
  return totalMonthlyIncome(state) - totalMonthlyExpenses(state);
}

export function savingsRate(state: WizardState): number {
  const income = totalMonthlyIncome(state);
  return income > 0 ? monthlyDisposable(state) / income : 0;
}
