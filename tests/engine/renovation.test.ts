import { describe, it, expect } from 'vitest';
import { evaluateRenovation, renovationWithOverrun, RENOVATION_OVERRUN } from '../../src/engine/renovation';
import { totalProjectCost, loanAmount, mortgagePayment, requiredDownPayment, downPaymentFraction } from '../../src/engine/mortgage';
import type { WizardState } from '../../src/types';

// Scénář z reálného použití: koupě za 10 M, rekonstrukce za 2,5 M,
// devět měsíců se platí nájem i hypotéka současně.
function renovator(overrides: Partial<WizardState['property']> = {}, rest: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'couple',
    income: { person1NetMonthly: 57000, person2NetMonthly: 100000 },
    expenses: { rent: 22000, existingLoans: 0, insurance: 2000, food: 12000, transport: 4000, children: 0, utilities: 6000, other: 8000 },
    savings: { totalSavings: 4800000, downPaymentFromSavings: 2510000 },
    goals: ['property'],
    property: {
      targetPrice: 10000000,
      mortgageRate: 0.053,
      loanTermYears: 30,
      renovation: { cost: 2500000, months: 9, payingRentMeanwhile: true },
      ...overrides,
    },
    ...rest,
  };
}

describe('rekonstrukce v celkové investici', () => {
  it('se přičítá k ceně, protože banka půjčuje proti hodnotě po rekonstrukci', () => {
    const state = renovator();
    expect(totalProjectCost(state)).toBe(12500000);
    expect(loanAmount(state)).toBe(12500000 - 2510000);
  });

  it('zvyšuje i požadovanou akontaci', () => {
    const withRenovation = renovator();
    const without = renovator({ renovation: undefined });
    const dpWith = requiredDownPayment(totalProjectCost(withRenovation), downPaymentFraction(withRenovation));
    const dpWithout = requiredDownPayment(totalProjectCost(without), downPaymentFraction(without));
    expect(dpWith).toBeGreaterThan(dpWithout);
  });

  it('bez rekonstrukce se nic nemění', () => {
    const state = renovator({ renovation: undefined });
    expect(totalProjectCost(state)).toBe(10000000);
    expect(evaluateRenovation(state)).toBeNull();
  });
});

describe('postupné čerpání během rekonstrukce', () => {
  it('platí se jen úrok z vyčerpané části, ne plná anuita', () => {
    const phase = evaluateRenovation(renovator())!;
    expect(phase.interestOnlyStart).toBeLessThan(phase.fullPayment);
    expect(phase.interestOnlyEnd).toBeLessThan(phase.fullPayment);
  });

  it('úrok roste, jak se čerpá na rekonstrukci', () => {
    const phase = evaluateRenovation(renovator())!;
    expect(phase.interestOnlyEnd).toBeGreaterThan(phase.interestOnlyStart);
    // Průměr leží mezi začátkem a koncem (rovnoměrné čerpání).
    expect(phase.interestOnlyAverage).toBeCloseTo((phase.interestOnlyStart + phase.interestOnlyEnd) / 2, 6);
  });

  it('na začátku se úročí jen to, co šlo na koupi', () => {
    const state = renovator();
    const phase = evaluateRenovation(state)!;
    const drawnAtPurchase = 10000000 - 2510000;
    expect(phase.interestOnlyStart).toBeCloseTo((drawnAtPurchase * 0.053) / 12, 6);
  });

  it('na konci se úročí celý úvěr včetně rekonstrukce', () => {
    const phase = evaluateRenovation(renovator())!;
    expect(phase.interestOnlyEnd).toBeCloseTo((loanAmount(renovator()) * 0.053) / 12, 6);
  });
});

describe('souběh nájmu a hypotéky', () => {
  it('nájem a energie se počítají navíc, dokud se nedostěhuje', () => {
    const paying = evaluateRenovation(renovator())!;
    const notPaying = evaluateRenovation(renovator({
      renovation: { cost: 2500000, months: 9, payingRentMeanwhile: false },
    }))!;
    expect(paying.housingDuringRenovation - notPaying.housingDuringRenovation).toBe(22000 + 6000);
  });

  it('souběh sníží volnou částku, ale při vysokém příjmu ji nedostane do mínusu', () => {
    const phase = evaluateRenovation(renovator())!;
    expect(phase.disposableDuringRenovation).toBeGreaterThan(0);
    expect(phase.disposableDuringRenovation).toBeLessThan(
      renovator().income.person1NetMonthly + (renovator().income.person2NetMonthly ?? 0)
    );
  });

  it('při nízkém příjmu souběh rozpočet potopí', () => {
    const poor = renovator({}, { income: { person1NetMonthly: 30000, person2NetMonthly: 25000 } });
    const phase = evaluateRenovation(poor)!;
    expect(phase.disposableDuringRenovation).toBeLessThan(0);
  });

  it('platba během rekonstrukce může být nižší než cílový stav', () => {
    // Postupné čerpání šetří víc, než kolik stojí nájem navíc.
    const phase = evaluateRenovation(renovator({
      renovation: { cost: 2500000, months: 9, payingRentMeanwhile: false },
    }))!;
    expect(phase.housingDuringRenovation).toBeLessThan(phase.fullPayment);
    expect(phase.totalExtraCost).toBe(0);
  });
});

describe('prodražení rekonstrukce', () => {
  it('počítá s obvyklou rezervou navíc', () => {
    expect(renovationWithOverrun(renovator())).toBe(Math.round(2500000 * (1 + RENOVATION_OVERRUN)));
  });

  it('bez rekonstrukce je nula', () => {
    expect(renovationWithOverrun(renovator({ renovation: undefined }))).toBe(0);
  });
});

describe('splátka po dočerpání', () => {
  it('odpovídá plné anuitě z celého úvěru', () => {
    const state = renovator();
    expect(evaluateRenovation(state)!.fullPayment).toBe(mortgagePayment(state));
  });
});
