import { describe, it, expect } from 'vitest';
import { expenseCategories, breakdownSurplus } from '../../src/engine/expenseBreakdown';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 50000 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 500000 },
    goals: ['property'],
    property: { targetPrice: 5500000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('expenseCategories', () => {
  it('now-state housing is rent + utilities', () => {
    const cats = expenseCategories(makeState(), false);
    const housing = cats.find((c) => c.key === 'housing');
    expect(housing?.amount).toBe(12000 + 3500);
    expect(housing?.necessary).toBe(true);
  });

  it('after-purchase housing is mortgage + ownership costs (larger than rent)', () => {
    const now = expenseCategories(makeState(), false).find((c) => c.key === 'housing')!.amount;
    const after = expenseCategories(makeState(), true).find((c) => c.key === 'housing')!.amount;
    expect(after).toBeGreaterThan(now);
  });

  it('omits zero-value categories', () => {
    const cats = expenseCategories(makeState(), false);
    // children = 0 and existingLoans = 0 → excluded
    expect(cats.find((c) => c.key === 'children')).toBeUndefined();
    expect(cats.find((c) => c.key === 'existingLoans')).toBeUndefined();
  });

  it('marks only "other" as discretionary', () => {
    const cats = expenseCategories(makeState(), false);
    expect(cats.find((c) => c.key === 'other')?.necessary).toBe(false);
    expect(cats.filter((c) => c.key !== 'other').every((c) => c.necessary)).toBe(true);
  });
});

describe('breakdownSurplus', () => {
  it('income minus all included categories', () => {
    const state = makeState();
    const cats = expenseCategories(state, false);
    // total expenses = 29000, income 50000 → surplus 21000
    expect(breakdownSurplus(state, cats, new Set())).toBe(21000);
  });

  it('excluded category is added back to surplus', () => {
    const state = makeState();
    const cats = expenseCategories(state, false);
    // exclude 'other' (3000) → surplus 21000 + 3000 = 24000
    expect(breakdownSurplus(state, cats, new Set(['other']))).toBe(24000);
  });

  it('goes negative when expenses exceed income', () => {
    const state = makeState({ income: { person1NetMonthly: 20000 } });
    const cats = expenseCategories(state, false);
    expect(breakdownSurplus(state, cats, new Set())).toBe(20000 - 29000);
  });
});
