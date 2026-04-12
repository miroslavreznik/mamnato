import { describe, it, expect } from 'vitest';
import { totalMonthlyIncome, totalMonthlyExpenses, monthlyDisposable, savingsRate } from '../../src/engine/cashflow';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 36000 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 500000 },
    goals: ['property'],
    property: { targetPrice: 5500000 },
    ...overrides,
  };
}

describe('totalMonthlyIncome', () => {
  it('returns person1 income for individual', () => {
    expect(totalMonthlyIncome(makeState())).toBe(36000);
  });

  it('sums both incomes for couple', () => {
    const state = makeState({
      mode: 'couple',
      income: { person1NetMonthly: 36000, person2NetMonthly: 30000 },
    });
    expect(totalMonthlyIncome(state)).toBe(66000);
  });

  it('includes parental allowance for family', () => {
    const state = makeState({
      mode: 'family',
      income: { person1NetMonthly: 36000, person2NetMonthly: 25000, parentalAllowance: 13000 },
    });
    expect(totalMonthlyIncome(state)).toBe(74000);
  });
});

describe('totalMonthlyExpenses', () => {
  it('sums all expense categories', () => {
    expect(totalMonthlyExpenses(makeState())).toBe(29000);
  });

  it('includes children expenses for family', () => {
    const state = makeState({
      expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 8000, utilities: 3500, other: 3000 },
    });
    expect(totalMonthlyExpenses(state)).toBe(37000);
  });
});

describe('monthlyDisposable', () => {
  it('returns income minus expenses', () => {
    expect(monthlyDisposable(makeState())).toBe(7000);
  });

  it('returns negative when expenses exceed income', () => {
    const state = makeState({
      income: { person1NetMonthly: 20000 },
    });
    expect(monthlyDisposable(state)).toBe(-9000);
  });
});

describe('savingsRate', () => {
  it('returns correct percentage', () => {
    const rate = savingsRate(makeState());
    expect(rate).toBeCloseTo(7000 / 36000, 5);
  });

  it('returns 0 when income is 0', () => {
    const state = makeState({ income: { person1NetMonthly: 0 } });
    expect(savingsRate(state)).toBe(0);
  });
});
