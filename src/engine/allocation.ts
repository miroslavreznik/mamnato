import type { WizardState } from '../types';
import { monthlyDisposable } from './cashflow';
import { monthlyMortgagePayment, effectiveDownPayment } from './mortgage';
import { DEFAULTS, CHILD_COSTS_CZ } from './defaults';

export interface GoalAllocations {
  mortgage: number;
  retirement: number;
  child: number;
  custom: number[];
}

export function calculateDefaultAllocations(state: WizardState): GoalAllocations {
  const disposable = monthlyDisposable(state);
  const allocs: GoalAllocations = { mortgage: 0, retirement: 0, child: 0, custom: [] };

  // Mortgage — fixed payment
  if (state.goals.includes('property')) {
    const dp = effectiveDownPayment(state);
    const loanAmount = Math.max(0, state.property.targetPrice - dp);
    const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
    const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
    allocs.mortgage = Math.round(monthlyMortgagePayment(loanAmount, rate, term));
  }

  // Child — weighted average monthly cost for first 18 years
  if (state.goals.includes('child')) {
    let totalMonths = 0;
    let totalCost = 0;
    for (const range of CHILD_COSTS_CZ) {
      if (range.to > 18) continue;
      const months = (range.to - range.from) * 12;
      totalCost += range.monthlyCost * months;
      totalMonths += months;
    }
    allocs.child = totalMonths > 0 ? Math.round(totalCost / totalMonths) : 0;
  }

  // Retirement — remainder capped at 30% of disposable
  if (state.goals.includes('retirement')) {
    const remaining = disposable - allocs.mortgage - allocs.child;
    allocs.retirement = Math.max(0, Math.min(Math.round(remaining), Math.round(disposable * 0.3)));
  }

  // Custom goals — simple split of what's left
  if (state.goals.includes('other') && state.customGoals && state.customGoals.length > 0) {
    const used = allocs.mortgage + allocs.retirement + allocs.child;
    const remaining = Math.max(0, disposable - used);
    const perGoal = state.customGoals.length > 0 ? Math.round(remaining / state.customGoals.length) : 0;
    allocs.custom = state.customGoals.map(() => perGoal);
  }

  return allocs;
}
