import { describe, it, expect } from 'vitest';
import { monthlyMortgagePayment, requiredDownPayment, downPaymentGap, downPaymentFraction, youngestApplicantAge, oldestApplicantAge, isUnder36, monthsToSaveDownPayment, postPurchaseRunwayMonths, totalLoanInterest, dti, dsti } from '../../src/engine/mortgage';
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
  it('is 20% of property price by default', () => {
    expect(requiredDownPayment(5500000)).toBe(1100000);
  });

  it('applies a custom fraction (e.g. 10% for under-36 LTV 90%)', () => {
    expect(requiredDownPayment(5500000, 0.10)).toBe(550000);
  });
});

describe('applicant ages', () => {
  it('youngest/oldest ignore unset and non-positive values', () => {
    expect(youngestApplicantAge(makeState())).toBeUndefined();
    expect(youngestApplicantAge(makeState({ person1Age: 40, person2Age: 33 }))).toBe(33);
    expect(oldestApplicantAge(makeState({ person1Age: 40, person2Age: 33 }))).toBe(40);
    // age 0 means "unset"
    expect(youngestApplicantAge(makeState({ person1Age: 0, person2Age: 41 }))).toBe(41);
  });

  it('isUnder36 uses the youngest applicant, falling back to the legacy flag', () => {
    expect(isUnder36(makeState({ person1Age: 40, person2Age: 34 }))).toBe(true); // youngest 34
    expect(isUnder36(makeState({ person1Age: 40 }))).toBe(false);
    expect(isUnder36(makeState({ person1Age: 36 }))).toBe(false); // exactly 36 is not "under"
    // no ages → legacy boolean still honoured (old saved states)
    expect(isUnder36(makeState({ applicantUnder36: true }))).toBe(true);
    expect(isUnder36(makeState())).toBe(false);
  });
});

describe('totalLoanInterest', () => {
  it('is zero for zero loan and zero rate', () => {
    expect(totalLoanInterest(0, 0.052, 30)).toBe(0);
    expect(totalLoanInterest(3600000, 0, 30)).toBeCloseTo(0, 6);
  });

  it('equals total payments minus principal and grows with the loan', () => {
    const interest = totalLoanInterest(5000000, 0.052, 30);
    expect(interest).toBeCloseTo(monthlyMortgagePayment(5000000, 0.052, 30) * 360 - 5000000, 4);
    expect(interest).toBeGreaterThan(totalLoanInterest(4000000, 0.052, 30));
  });
});

describe('effectiveDownPayment default', () => {
  it('defaults to the required minimum, keeping the rest as reserve', () => {
    // savings 1.5M, required 1.1M (20 % z 5.5M) → do akontace jde jen 1.1M
    const state = makeState({ savings: { totalSavings: 1500000 } });
    expect(downPaymentGap(state)).toBe(0);
    // dsti počítá s úvěrem 5.5M − 1.1M = 4.4M (ne 4M)
    const payment = monthlyMortgagePayment(4400000, 0.052, 30);
    expect(dsti(state)).toBeCloseTo(payment / 36000, 3);
  });

  it('is capped by actual savings when below the required minimum', () => {
    const state = makeState({ savings: { totalSavings: 500000 } });
    expect(downPaymentGap(state)).toBe(600000); // 1.1M − 0.5M
  });

  it('an explicit choice always wins over the default', () => {
    const state = makeState({ savings: { totalSavings: 1500000, downPaymentFromSavings: 1400000 } });
    // loan = 5.5M − 1.4M = 4.1M
    const payment = monthlyMortgagePayment(4100000, 0.052, 30);
    expect(dsti(state)).toBeCloseTo(payment / 36000, 3);
  });
});

describe('downPaymentFraction', () => {
  it('is 20% by default and 10% for applicants under 36', () => {
    expect(downPaymentFraction(makeState())).toBe(0.20);
    expect(downPaymentFraction(makeState({ applicantUnder36: true }))).toBe(0.10);
  });

  it('derives from real ages when provided', () => {
    expect(downPaymentFraction(makeState({ person1Age: 30 }))).toBe(0.10);
    expect(downPaymentFraction(makeState({ person1Age: 45, person2Age: 33 }))).toBe(0.10); // youngest 33
    expect(downPaymentFraction(makeState({ person1Age: 45 }))).toBe(0.20);
  });

  it('under-36 halves the required down payment and shrinks the gap', () => {
    const base = makeState({ savings: { totalSavings: 500000 } });
    const younger = makeState({ savings: { totalSavings: 500000 }, applicantUnder36: true });
    // required: 1,100,000 vs 550,000 → gap 600,000 vs 50,000
    expect(downPaymentGap(base)).toBe(600000);
    expect(downPaymentGap(younger)).toBe(50000);
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

describe('postPurchaseRunwayMonths', () => {
  it('is 0 when all savings are spent on the down payment', () => {
    const state = makeState({ savings: { totalSavings: 1100000 } }); // vše na akontaci → žádná rezerva
    expect(postPurchaseRunwayMonths(state)).toBe(0);
  });

  it('is finite and positive when a reserve is kept back', () => {
    const state = makeState({ savings: { totalSavings: 1500000, downPaymentFromSavings: 1100000 } });
    const r = postPurchaseRunwayMonths(state);
    expect(r).toBeGreaterThan(0);
    expect(Number.isFinite(r)).toBe(true);
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
