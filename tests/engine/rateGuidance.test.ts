import { describe, it, expect } from 'vitest';
import { ltv, ltvBandFor, paymentAtRate, ltvRateAdvice, LTV_BANDS } from '../../src/engine/rateGuidance';
import { monthlyMortgagePayment } from '../../src/engine/mortgage';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 36000 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 2000000 },
    goals: ['property'],
    property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('ltv', () => {
  it('is the borrowed share of the price', () => {
    // akontace 1M z ceny 5M → úvěr 4M → LTV 80 %
    const state = makeState({ savings: { totalSavings: 2000000, downPaymentFromSavings: 1000000 } });
    expect(ltv(state)).toBeCloseTo(0.8, 6);
  });

  it('is 0 when the property is fully paid from savings', () => {
    const state = makeState({ savings: { totalSavings: 6000000, downPaymentFromSavings: 5000000 } });
    expect(ltv(state)).toBe(0);
  });

  it('is 0 when no price is set (nothing to compute)', () => {
    expect(ltv(makeState({ property: { targetPrice: 0 } }))).toBe(0);
  });
});

describe('ltvBandFor', () => {
  it('puts an exactly-80 % LTV in the standard band, not the penalised one', () => {
    expect(ltvBandFor(0.8).key).toBe('standard');
    expect(ltvBandFor(0.8).ratePremium).toBe(0);
  });

  it('classifies the remaining bands by upper bound', () => {
    expect(ltvBandFor(0.65).key).toBe('best');
    expect(ltvBandFor(0.7).key).toBe('best');
    expect(ltvBandFor(0.85).key).toBe('high');
    expect(ltvBandFor(0.9).key).toBe('high');
    expect(ltvBandFor(0.95).key).toBe('over');
  });

  it('marks over-90 % LTV as unavailable (ČNB limit)', () => {
    expect(ltvBandFor(0.95).available).toBe(false);
    expect(ltvBandFor(0.9).available).toBe(true);
  });

  it('bands are ordered from cheapest to most expensive', () => {
    const premiums = LTV_BANDS.map((b) => b.ratePremium);
    expect(premiums[0]).toBeLessThan(premiums[1]);
    expect(premiums[1]).toBeLessThan(premiums[2]);
  });
});

describe('paymentAtRate', () => {
  it('models the same loan at a different rate (refixace)', () => {
    const state = makeState({ savings: { totalSavings: 2000000, downPaymentFromSavings: 1000000 } });
    expect(paymentAtRate(state, 0.052)).toBeCloseTo(monthlyMortgagePayment(4000000, 0.052, 30), 6);
    expect(paymentAtRate(state, 0.062)).toBeGreaterThan(paymentAtRate(state, 0.052));
  });
});

describe('ltvRateAdvice', () => {
  it('returns null without a property price', () => {
    expect(ltvRateAdvice(makeState({ property: { targetPrice: 0 } }))).toBeNull();
  });

  it('tells an 85 % LTV borrower what it takes to drop under 80 %', () => {
    // akontace 750k z 5M → úvěr 4,25M → LTV 85 %
    const state = makeState({ savings: { totalSavings: 2000000, downPaymentFromSavings: 750000 } });
    const advice = ltvRateAdvice(state)!;
    expect(advice.band.key).toBe('high');
    expect(advice.nextBand!.key).toBe('standard');
    // do 80 % LTV je potřeba akontace 1M → doplatit 250k
    expect(advice.extraDownPayment).toBe(250000);
    expect(advice.affordable).toBe(true);
    expect(advice.rateDrop).toBeCloseTo(0.003, 6);
    expect(advice.monthlySaving).toBeGreaterThan(0);
  });

  it('flags the top-up as unaffordable when savings do not cover it', () => {
    // úspory jen 800k → na 1M akontace to nestačí
    const state = makeState({ savings: { totalSavings: 800000, downPaymentFromSavings: 750000 } });
    const advice = ltvRateAdvice(state)!;
    expect(advice.extraDownPayment).toBe(250000);
    expect(advice.affordable).toBe(false);
  });

  it('has nothing to suggest in the best band', () => {
    // akontace 2M z 5M → úvěr 3M → LTV 60 %
    const state = makeState({ savings: { totalSavings: 3000000, downPaymentFromSavings: 2000000 } });
    const advice = ltvRateAdvice(state)!;
    expect(advice.band.key).toBe('best');
    expect(advice.nextBand).toBeNull();
    expect(advice.extraDownPayment).toBe(0);
    expect(advice.monthlySaving).toBe(0);
  });

  it('routes an over-limit LTV toward the 90 % band', () => {
    const state = makeState({ savings: { totalSavings: 2000000, downPaymentFromSavings: 100000 } });
    const advice = ltvRateAdvice(state)!;
    expect(advice.band.key).toBe('over');
    expect(advice.band.available).toBe(false);
    expect(advice.nextBand!.key).toBe('high');
    // do 90 % LTV je potřeba akontace 500k → doplatit 400k
    expect(advice.extraDownPayment).toBe(400000);
  });

  it('needs no top-up when already at the band edge', () => {
    // akontace přesně 1M → LTV přesně 80 %, lepší pásmo je do 70 %
    const state = makeState({ savings: { totalSavings: 2000000, downPaymentFromSavings: 1000000 } });
    const advice = ltvRateAdvice(state)!;
    expect(advice.band.key).toBe('standard');
    expect(advice.nextBand!.key).toBe('best');
    // do 70 % LTV je potřeba 1,5M → doplatit 500k
    expect(advice.extraDownPayment).toBe(500000);
  });
});
