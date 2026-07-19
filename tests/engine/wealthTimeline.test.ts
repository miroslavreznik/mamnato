import { describe, it, expect } from 'vitest';
import { wealthTimeline } from '../../src/engine/wealthTimeline';
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
    goals: [],
    property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('wealthTimeline', () => {
  it('grows linearly by disposable when there are no events', () => {
    const state = makeState(); // income 75000, expenses 34000 → +41000/měs
    const tl = wealthTimeline(state, { months: 12 });
    expect(tl.points[0].cash).toBe(800000);
    expect(tl.points[12].cash).toBe(800000 + 41000 * 12);
    expect(tl.purchaseMonth).toBeNull();
    expect(tl.childMonth).toBeNull();
    expect(tl.firstNegativeMonth).toBeNull();
  });

  it('buys immediately when the down payment is covered and cash drops by it', () => {
    const state = makeState({ goals: ['property'] }); // required DP 20 % z 5M = 1M > 800k
    const tl = wealthTimeline(state, { months: 60 });
    // Naspoří 1M: chybí 200k při +41k/měs → koupě ~5. měsíc
    expect(tl.purchaseMonth).toBeGreaterThan(0);
    expect(tl.purchaseMonth).toBeLessThan(8);
    // po koupi je cash menší než před ní (odečtena akontace)
    const m = tl.purchaseMonth!;
    expect(tl.points[m + 1].cash).toBeLessThan(tl.points[m].cash);
  });

  it('child costs and parental leave push cash down and can go negative', () => {
    const state = makeState({
      goals: ['property', 'child'],
      savings: { totalSavings: 1000000 }, // DP hned
      parentalLeave: { enabled: true, parent: 1, durationMonths: 36, monthlyBenefit: 9722 },
    });
    const withLeave = wealthTimeline(state, { months: 60, childOffsetMonths: 6 });
    const noLeave = wealthTimeline({ ...state, parentalLeave: undefined }, { months: 60, childOffsetMonths: 6 });
    expect(withLeave.purchaseMonth).toBe(0);
    expect(withLeave.childMonth).toBe(6);
    expect(withLeave.leaveEndMonth).toBe(42);
    // výpadek příjmu během volna → nižší jmění než bez rodičovské
    expect(withLeave.points[42].cash).toBeLessThan(noLeave.points[42].cash);
  });

  it('never buys when the down payment is unreachable in the horizon', () => {
    const state = makeState({
      goals: ['property'],
      income: { person1NetMonthly: 34500 }, // disposable 500/měs
      savings: { totalSavings: 100000 },
    });
    const tl = wealthTimeline(state, { months: 120 });
    expect(tl.purchaseMonth).toBeNull();
  });
});
