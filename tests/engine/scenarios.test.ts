import { describe, it, expect } from 'vitest';
import { evaluateScenario } from '../../src/engine/scenarios';
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

describe('evaluateScenario', () => {
  it('returns cannot_afford_cashflow when expenses exceed income', () => {
    const state = makeState({
      income: { person1NetMonthly: 20000 },
    });
    // expenses = 29000, income = 20000 → disposable = -9000
    expect(evaluateScenario(state).id).toBe('cannot_afford_cashflow');
  });

  it('returns cannot_afford_dsti when DSTI > 45%', () => {
    // Need high mortgage relative to income → high property price, low savings
    const state = makeState({
      income: { person1NetMonthly: 40000 },
      expenses: { rent: 5000, existingLoans: 0, insurance: 1000, food: 4000, transport: 2000, children: 0, utilities: 2000, other: 2000 },
      savings: { totalSavings: 100000 },
      property: { targetPrice: 8000000, mortgageRate: 0.052, loanTermYears: 30 },
    });
    // loan = 7_900_000, monthly payment ≈ 43_250 → DSTI ≈ 43250/40000 > 1.0
    expect(evaluateScenario(state).id).toBe('cannot_afford_dsti');
  });

  it('returns no_savings when months to save > 60', () => {
    const state = makeState({
      income: { person1NetMonthly: 60000 },
      expenses: { rent: 20000, existingLoans: 0, insurance: 2000, food: 10000, transport: 5000, children: 0, utilities: 5000, other: 10000 },
      savings: { totalSavings: 50000 },
      property: { targetPrice: 3000000, mortgageRate: 0.052, loanTermYears: 30 },
    });
    // expenses = 52000, disposable = 8000, gap = 600k-50k = 550k, months = 69 > 60
    // loan = 2_950_000, DSTI ≈ 0.27 < 0.45
    expect(evaluateScenario(state).id).toBe('no_savings');
  });

  it('returns tight_but_possible when DSTI > 35% (but <= 45%)', () => {
    const state = makeState({
      mode: 'couple',
      income: { person1NetMonthly: 35000, person2NetMonthly: 20000 },
      expenses: { rent: 10000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3000, other: 2000 },
      savings: { totalSavings: 1200000 },
      property: { targetPrice: 5500000, mortgageRate: 0.052, loanTermYears: 30 },
    });
    // income = 55000, loan = 4_300_000, payment ≈ 23_530, DSTI ≈ 0.428
    expect(evaluateScenario(state).id).toBe('tight_but_possible');
  });

  it('returns ready_in_1_2_years when gap > 0, months <= 24 and DSTI is comfortable', () => {
    const state = makeState({
      mode: 'couple',
      income: { person1NetMonthly: 40000, person2NetMonthly: 35000 },
      expenses: { rent: 10000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3000, other: 2000 },
      savings: { totalSavings: 900000 },
      property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
    });
    // gap = 1_000_000 - 900_000 = 100_000, disposable = 75000 - 25500 = 49500, months = 3
    // loan = 4_100_000, payment ≈ 22_500 → DSTI ≈ 0.30 (<= 0.35) → ready_in_1_2_years
    expect(evaluateScenario(state).id).toBe('ready_in_1_2_years');
  });

  it('returns tight_but_possible when gap > 0 but saving takes longer (months 25–60)', () => {
    const state = makeState({
      mode: 'couple',
      income: { person1NetMonthly: 50000, person2NetMonthly: 40000 },
      expenses: { rent: 25000, existingLoans: 0, insurance: 3000, food: 15000, transport: 8000, children: 0, utilities: 6000, other: 20000 },
      savings: { totalSavings: 600000 },
      property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
    });
    // income = 90000, expenses = 77000, disposable = 13000
    // gap = 1_000_000 - 600_000 = 400_000, months = ceil(400000/13000) = 31 (in 25–60)
    // loan = 4_400_000, payment ≈ 24_170 → DSTI ≈ 0.27 (<= 0.35)
    // gap > 0 and months > 24 → tight_but_possible
    expect(evaluateScenario(state).id).toBe('tight_but_possible');
  });

  it('returns very_comfortable when DSTI < 25% and DTI < 5', () => {
    const state = makeState({
      mode: 'couple',
      income: { person1NetMonthly: 60000, person2NetMonthly: 50000 },
      expenses: { rent: 10000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3000, other: 2000 },
      savings: { totalSavings: 1500000 },
      property: { targetPrice: 4000000, mortgageRate: 0.052, loanTermYears: 30 },
    });
    // income = 110000, loan = 2_500_000, payment ≈ 13_680, DSTI ≈ 0.124, DTI = 2_500_000 / 1_320_000 ≈ 1.89
    // gap = 800_000 - 1_500_000 = 0
    expect(evaluateScenario(state).id).toBe('very_comfortable');
  });

  it('returns ready_now as default when conditions are moderate', () => {
    const state = makeState({
      mode: 'couple',
      income: { person1NetMonthly: 40000, person2NetMonthly: 30000 },
      expenses: { rent: 10000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3000, other: 2000 },
      savings: { totalSavings: 1200000 },
      property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
    });
    // income = 70000, loan = 3_800_000, payment ≈ 20_800, DSTI ≈ 0.297
    // DTI = 3_800_000 / 840_000 ≈ 4.52 → DTI not < 5? Actually 4.52 < 5 but DSTI 0.297 > 0.25
    // So not very_comfortable, falls to ready_now
    expect(evaluateScenario(state).id).toBe('ready_now');
  });
});
