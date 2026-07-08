import { describe, it, expect } from 'vitest';
import { savingsProjection, cashFlowAfterPurchase, investmentComparison, retirementProjection, allocateGoals, fourPercentTarget, yearOfReachingTarget } from '../../src/engine/savings';
import type { CustomGoal } from '../../src/types';
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
    property: { targetPrice: 5500000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('savingsProjection', () => {
  it('starts at current savings and grows linearly', () => {
    const state = makeState();
    const projection = savingsProjection(state, 12);
    expect(projection).toHaveLength(13); // 0..12
    expect(projection[0].savings).toBe(500000);
    expect(projection[12].savings).toBe(500000 + 7000 * 12);
  });

  it('decreases when disposable is negative', () => {
    const state = makeState({ income: { person1NetMonthly: 20000 } });
    const projection = savingsProjection(state, 6);
    expect(projection[6].savings).toBeLessThan(projection[0].savings);
  });
});

describe('cashFlowAfterPurchase', () => {
  it('returns two series starting at month 0', () => {
    const data = cashFlowAfterPurchase(makeState(), 12);
    expect(data).toHaveLength(13);
    expect(data[0].month).toBe(0);
  });

  it('currentCashFlow starts at savings amount', () => {
    const data = cashFlowAfterPurchase(makeState(), 1);
    expect(data[0].currentCashFlow).toBe(500000);
  });

  it('afterPurchaseCashFlow starts at leftover savings after down payment', () => {
    // With a partial down payment, both lines share the same baseline (current savings)
    const state = makeState({ savings: { totalSavings: 800000, downPaymentFromSavings: 500000 } });
    const data = cashFlowAfterPurchase(state, 1);
    // current starts at total savings
    expect(data[0].currentCashFlow).toBe(800000);
    // after purchase starts at savings minus down payment = 300000
    expect(data[0].afterPurchaseCashFlow).toBe(300000);
  });
});

describe('investmentComparison', () => {
  it('returns correct number of data points', () => {
    const data = investmentComparison(makeState(), 0.03, 0.07, 0.03, 30);
    expect(data).toHaveLength(31); // years 0..30
    expect(data[0].year).toBe(0);
    expect(data[30].year).toBe(30);
  });

  it('property net worth starts at savings minus loan gap', () => {
    const state = makeState();
    const data = investmentComparison(state, 0.03, 0.07, 0.03, 30);
    // Year 0: property value = 5500000, remaining loan = 5000000
    // net worth = 5500000 - 5000000 = 500000
    expect(data[0].propertyNetWorth).toBe(500000);
  });

  it('sp500 portfolio starts at down payment', () => {
    const data = investmentComparison(makeState(), 0.03, 0.07, 0.03, 30);
    expect(data[0].sp500NetWorth).toBe(500000);
  });

  it('renting cost starts at 0', () => {
    const data = investmentComparison(makeState(), 0.03, 0.07, 0.03, 30);
    expect(data[0].rentingCost).toBeCloseTo(0);
  });

  it('property net worth grows over time', () => {
    const data = investmentComparison(makeState(), 0.03, 0.07, 0.03, 30);
    expect(data[30].propertyNetWorth).toBeGreaterThan(data[0].propertyNetWorth);
  });
});

describe('retirementProjection', () => {
  it('returns correct number of data points', () => {
    const data = retirementProjection(5000, 30, 0.07);
    expect(data).toHaveLength(31);
  });

  it('starts at 0', () => {
    const data = retirementProjection(5000, 30, 0.07);
    expect(data[0].portfolioValue).toBe(0);
  });

  it('grows over time with positive return', () => {
    const data = retirementProjection(5000, 30, 0.07);
    expect(data[30].portfolioValue).toBeGreaterThan(5000 * 12 * 30);
  });

  it('equals total contributions at 0% return', () => {
    const data = retirementProjection(5000, 10, 0);
    // 5000 * 12 * 10 = 600000
    expect(data[10].portfolioValue).toBe(600000);
  });

  it('with inflation, real values are lower than nominal', () => {
    const nominal = retirementProjection(5000, 30, 0.07);
    const real = retirementProjection(5000, 30, 0.07, 0.03);
    expect(real[30].portfolioValue).toBeLessThan(nominal[30].portfolioValue);
    // Real should still be more than contributions (7% - 3% = ~4% real return)
    expect(real[30].portfolioValue).toBeGreaterThan(5000 * 12 * 30);
  });

  it('cash at 0% with inflation shows purchasing power loss', () => {
    const real = retirementProjection(5000, 10, 0, 0.03);
    // 0% nominal - 3% inflation = negative real return
    // Total contributions = 600000, real value should be less
    expect(real[10].portfolioValue).toBeLessThan(600000);
  });
});

describe('allocateGoals', () => {
  function goal(id: string, amount: number, months: number): CustomGoal {
    return { id, name: id, targetAmount: amount, targetMonths: months };
  }

  it('one goal, sufficient funds → achievable', () => {
    // Need 10000/mo, have 15000
    const result = allocateGoals([goal('a', 120000, 12)], 15000);
    expect(result).toHaveLength(1);
    expect(result[0].achievable).toBe(true);
    expect(result[0].monthlyAllocation).toBe(10000);
    expect(result[0].remainingAfter).toBe(5000);
  });

  it('one goal, insufficient funds → not achievable', () => {
    // Need 10000/mo, have 5000
    const result = allocateGoals([goal('a', 120000, 12)], 5000);
    expect(result[0].achievable).toBe(false);
    expect(result[0].monthlyAllocation).toBe(5000);
    expect(result[0].monthsNeeded).toBe(24); // 120000/5000
  });

  it('two goals, funds for both → both achievable', () => {
    // Goal 1: 60000 in 12mo = 5000/mo, Goal 2: 60000 in 12mo = 5000/mo, disposable 15000
    const result = allocateGoals([goal('a', 60000, 12), goal('b', 60000, 12)], 15000);
    expect(result[0].achievable).toBe(true);
    expect(result[1].achievable).toBe(true);
    expect(result[0].remainingAfter).toBe(10000);
    expect(result[1].remainingAfter).toBe(5000);
  });

  it('two goals, funds only for first → second not achievable with 0 allocation', () => {
    // Goal 1: 120000 in 12mo = 10000/mo, Goal 2: 60000 in 12mo = 5000/mo, disposable 10000
    const result = allocateGoals([goal('a', 120000, 12), goal('b', 60000, 12)], 10000);
    expect(result[0].achievable).toBe(true);
    expect(result[1].achievable).toBe(false);
    expect(result[1].monthlyAllocation).toBe(0);
  });

  it('two goals, funds for first and partial second → second not achievable but has allocation', () => {
    // Goal 1: 60000 in 12mo = 5000/mo, Goal 2: 120000 in 12mo = 10000/mo, disposable 8000
    const result = allocateGoals([goal('a', 60000, 12), goal('b', 120000, 12)], 8000);
    expect(result[0].achievable).toBe(true);
    expect(result[0].monthlyAllocation).toBe(5000);
    expect(result[1].achievable).toBe(false);
    expect(result[1].monthlyAllocation).toBe(3000); // 8000 - 5000
    expect(result[1].monthsNeeded).toBe(40); // 120000/3000
  });

  it('changing order changes achievability', () => {
    // 10000/mo disposable, Goal A: 120000 in 12mo (10000/mo), Goal B: 60000 in 12mo (5000/mo)
    const orderAB = allocateGoals([goal('a', 120000, 12), goal('b', 60000, 12)], 10000);
    expect(orderAB[0].achievable).toBe(true);  // A achievable
    expect(orderAB[1].monthlyAllocation).toBe(0); // B gets nothing

    const orderBA = allocateGoals([goal('b', 60000, 12), goal('a', 120000, 12)], 10000);
    expect(orderBA[0].achievable).toBe(true);  // B achievable
    expect(orderBA[1].achievable).toBe(false); // A not achievable
    expect(orderBA[1].monthlyAllocation).toBe(5000); // A gets leftover
  });
});

describe('fourPercentTarget', () => {
  it('returns monthly income times 300 at default 4% rate', () => {
    expect(fourPercentTarget(30000)).toBe(30000 * 300);
    expect(fourPercentTarget(30000)).toBe((30000 * 12) / 0.04);
  });

  it('respects a custom withdrawal rate', () => {
    expect(fourPercentTarget(30000, 0.05)).toBe((30000 * 12) / 0.05);
  });

  it('returns Infinity for non-positive withdrawal rate', () => {
    expect(fourPercentTarget(30000, 0)).toBe(Infinity);
  });
});

describe('yearOfReachingTarget', () => {
  it('returns the first year the portfolio reaches the target', () => {
    const projection = retirementProjection(10000, 30, 0.07);
    const target = 1000000;
    const year = yearOfReachingTarget(projection, target);
    expect(year).not.toBeNull();
    expect(projection[year!].portfolioValue).toBeGreaterThanOrEqual(target);
    if (year! > 0) {
      expect(projection[year! - 1].portfolioValue).toBeLessThan(target);
    }
  });

  it('returns null when the target is not reached within the horizon', () => {
    const projection = retirementProjection(1000, 5, 0.02);
    expect(yearOfReachingTarget(projection, 100000000)).toBeNull();
  });
});
