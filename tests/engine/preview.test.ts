import { describe, it, expect } from 'vitest';
import { previewData } from '../../src/engine/preview';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 40000, person2NetMonthly: 0 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 200000 },
    goals: [],
    property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('previewData', () => {
  it('rozdělí příjem na bydlení, ostatní nezbytné, zbytné a zbytek', () => {
    const p = previewData(makeState());
    const by = Object.fromEntries(p.segments.map((s) => [s.key, s.amount]));
    // Bydlení = nájem + energie, tedy 12 000 + 3 500.
    expect(by.housing).toBe(15500);
    // Ostatní nezbytné = pojistky + jídlo + doprava.
    expect(by.necessary).toBe(10500);
    expect(by.discretionary).toBe(3000);
    expect(by.free).toBe(40000 - 29000);
    expect(p.disposable).toBe(11000);
  });

  it('při schodku je zbytek nula a základ pruhu je součet výdajů', () => {
    // Bez tohohle by poměry v pruhu přetekly přes sto procent a segmenty
    // by se navzájem vytlačily ven.
    const p = previewData(makeState({ income: { person1NetMonthly: 20000, person2NetMonthly: 0 } }));
    expect(p.disposable).toBeLessThan(0);
    expect(p.segments.find((s) => s.key === 'free')!.amount).toBe(0);
    expect(p.total).toBe(29000);

    const sum = p.segments.reduce((s, x) => s + x.amount, 0);
    expect(sum).toBeLessThanOrEqual(p.total);
  });

  it('součet segmentů nepřeleze základ ani při vyrovnaném rozpočtu', () => {
    const p = previewData(makeState({ income: { person1NetMonthly: 29000, person2NetMonthly: 0 } }));
    const sum = p.segments.reduce((s, x) => s + x.amount, 0);
    expect(sum).toBe(p.total);
  });
});
