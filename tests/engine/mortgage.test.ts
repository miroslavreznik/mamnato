import { describe, it, expect } from 'vitest';
import { monthlyMortgagePayment, requiredDownPayment, downPaymentGap, monthsToSaveDownPayment, dti, dsti } from '../../src/engine/mortgage';
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

describe('monthlyMortgagePayment', () => {
  it('calculates annuity correctly for standard loan', () => {
    // 5,000,000 Kč at 5.2% p.a. for 30 years
    const payment = monthlyMortgagePayment(5000000, 0.052, 30);
    // Verified: ~27,401 Kč/month
    expect(payment).toBeCloseTo(27456, -1);
  });

  it('handles 0% interest rate', () => {
    const payment = monthlyMortgagePayment(3600000, 0, 30);
    expect(payment).toBe(10000);
  });

  it('higher rate means higher payment', () => {
    const low = monthlyMortgagePayment(4000000, 0.04, 30);
    const high = monthlyMortgagePayment(4000000, 0.06, 30);
    expect(high).toBeGreaterThan(low);
  });
});

describe('requiredDownPayment', () => {
  it('is 20% of property price', () => {
    expect(requiredDownPayment(5500000)).toBe(1100000);
  });
});

describe('downPaymentGap', () => {
  it('returns 0 when savings exceed required', () => {
    const state = makeState({ savings: { totalSavings: 1500000 } });
    expect(downPaymentGap(state)).toBe(0);
  });

  it('returns gap when savings are insufficient', () => {
    const state = makeState({ savings: { totalSavings: 500000 } });
    // Required: 1,100,000; gap: 600,000
    expect(downPaymentGap(state)).toBe(600000);
  });
});

describe('monthsToSaveDownPayment', () => {
  it('calculates months correctly', () => {
    const state = makeState(); // disposable 7000, gap 600000
    const months = monthsToSaveDownPayment(state);
    expect(months).toBe(Math.ceil(600000 / 7000));
  });

  it('returns Infinity when disposable <= 0', () => {
    const state = makeState({ income: { person1NetMonthly: 20000 } });
    expect(monthsToSaveDownPayment(state)).toBe(Infinity);
  });

  it('returns 0 when no gap', () => {
    const state = makeState({ savings: { totalSavings: 2000000 } });
    expect(monthsToSaveDownPayment(state)).toBe(0);
  });
});

describe('dti', () => {
  it('calculates DTI as loan / annual income', () => {
    const state = makeState();
    // loan = 5500000 - 500000 = 5000000; annual = 36000 * 12 = 432000
    const result = dti(state);
    expect(result).toBeCloseTo(5000000 / 432000, 2);
  });

  it('returns Infinity when income is 0', () => {
    const state = makeState({ income: { person1NetMonthly: 0 } });
    expect(dti(state)).toBe(Infinity);
  });

  it('includes existing debt principal in total debt', () => {
    const state = makeState({ existingDebtPrincipal: 200000 });
    // total debt = 5000000 + 200000 = 5200000; annual = 432000
    expect(dti(state)).toBeCloseTo(5200000 / 432000, 2);
  });

  it('is unchanged when existing debt principal is absent', () => {
    expect(dti(makeState())).toBeCloseTo(dti(makeState({ existingDebtPrincipal: 0 })), 5);
  });
});

describe('dsti', () => {
  it('calculates DSTI as monthly payments / income', () => {
    const state = makeState();
    const result = dsti(state);
    // mortgage ~27401 on 5M, no existing loans, income 36000
    // DSTI = 27401 / 36000 ≈ 0.761
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThan(1);
  });

  it('includes existing loans in calculation', () => {
    const stateNoLoans = makeState();
    const stateWithLoans = makeState({
      expenses: { rent: 12000, existingLoans: 5000, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    });
    expect(dsti(stateWithLoans)).toBeGreaterThan(dsti(stateNoLoans));
  });
});
