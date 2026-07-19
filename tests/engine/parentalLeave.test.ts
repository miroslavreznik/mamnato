import { describe, it, expect } from 'vitest';
import {
  evaluateParentalLeave,
  defaultMonthlyBenefit,
  defaultCaringParent,
  parentalLeaveApplicable,
  RODICOVSKA_POOL,
} from '../../src/engine/parentalLeave';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'couple',
    income: { person1NetMonthly: 45000, person2NetMonthly: 30000 },
    expenses: { rent: 15000, existingLoans: 0, insurance: 1500, food: 8000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 800000 },
    goals: ['child'],
    property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('parental leave helpers', () => {
  it('default benefit spreads the rodičovská pool over the duration', () => {
    expect(defaultMonthlyBenefit(36)).toBe(Math.round(RODICOVSKA_POOL / 36));
  });

  it('default caring parent is the lower earner', () => {
    expect(defaultCaringParent(makeState())).toBe(2); // person2 earns less
    expect(defaultCaringParent(makeState({ income: { person1NetMonthly: 20000, person2NetMonthly: 50000 } }))).toBe(1);
  });

  it('is applicable only for couples/families with a child goal and two incomes', () => {
    expect(parentalLeaveApplicable(makeState())).toBe(true);
    expect(parentalLeaveApplicable(makeState({ goals: ['property'] }))).toBe(false);
    expect(parentalLeaveApplicable(makeState({ mode: 'individual', income: { person1NetMonthly: 45000 } }))).toBe(false);
  });
});

describe('evaluateParentalLeave', () => {
  it('returns null when not enabled', () => {
    expect(evaluateParentalLeave(makeState())).toBeNull();
    expect(evaluateParentalLeave(makeState({ parentalLeave: { enabled: false, parent: 2, durationMonths: 36, monthlyBenefit: 10000 } }))).toBeNull();
  });

  it('replaces the caring parent salary with the benefit during leave', () => {
    const state = makeState({
      goals: ['child'],
      parentalLeave: { enabled: true, parent: 2, durationMonths: 24, monthlyBenefit: 12000 },
    });
    const r = evaluateParentalLeave(state)!;
    // income now = 75000; during leave = 75000 - 30000 (person2) + 12000 = 57000
    expect(r.incomeNow).toBe(75000);
    expect(r.incomeDuringLeave).toBe(57000);
    // savings lost total = (lostSalary - benefit) * months = (30000-12000)*24
    expect(r.savingsLostTotal).toBe(18000 * 24);
    // no property goal → after-purchase disposable is null
    expect(r.disposableDuringLeaveAfterPurchase).toBeNull();
  });

  it('reports reserve coverage of the leave shortfall', () => {
    const state = makeState({
      goals: ['child', 'property'],
      savings: { totalSavings: 1200000, downPaymentFromSavings: 1000000 }, // rezerva 200k
      parentalLeave: { enabled: true, parent: 1, durationMonths: 36, monthlyBenefit: 5000 },
    });
    const r = evaluateParentalLeave(state)!;
    expect(r.reserveAfter).toBe(200000);
    if (r.shortfallPerMonth > 0) {
      expect(r.monthsCovered).toBe(Math.floor(200000 / r.shortfallPerMonth));
      expect(r.shortfallTotal).toBe(r.shortfallPerMonth * 36);
    }
  });

  it('monthsCovered is null when there is no shortfall', () => {
    const state = makeState({
      goals: ['child'],
      income: { person1NetMonthly: 90000, person2NetMonthly: 60000 },
      parentalLeave: { enabled: true, parent: 2, durationMonths: 24, monthlyBenefit: 15000 },
    });
    const r = evaluateParentalLeave(state)!;
    expect(r.shortfallPerMonth).toBe(0);
    expect(r.monthsCovered).toBeNull();
  });

  it('computes the post-purchase during-leave disposable when buying', () => {
    const state = makeState({
      goals: ['child', 'property'],
      parentalLeave: { enabled: true, parent: 2, durationMonths: 36, monthlyBenefit: 10000 },
    });
    const r = evaluateParentalLeave(state)!;
    expect(r.disposableDuringLeaveAfterPurchase).not.toBeNull();
    // mortgage on a 5M home makes it much tighter than the pre-purchase leave disposable
    expect(r.disposableDuringLeaveAfterPurchase!).toBeLessThan(r.disposableDuringLeave);
  });
});
