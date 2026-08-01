import { describe, it, expect } from 'vitest';
import { budgetNow, budgetAfterPurchase } from '../../src/engine/budget';
import { evaluateOverall } from '../../src/engine/summary';
import { mortgagePayment, ownershipCosts } from '../../src/engine/mortgage';
import type { WizardState } from '../../src/types';
import type { GoalAllocations } from '../../src/engine/allocation';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 60000 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 1200000 },
    goals: ['property', 'retirement'],
    property: { targetPrice: 4000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

const allocs = (o: Partial<GoalAllocations> = {}): GoalAllocations => ({
  downPayment: 0, reserve: 0, retirement: 0, child: 0, custom: [], ...o,
});

describe('budgetNow', () => {
  it('počítá odkládání na akontaci mezi cíli', () => {
    const state = makeState();
    const b = budgetNow(state, allocs({ downPayment: 8000, reserve: 0, retirement: 5000 }));
    // disponibilní = 60 000 − 29 000 = 31 000
    expect(b.disposable).toBe(31000);
    expect(b.allocated).toBe(13000);
    expect(b.surplus).toBe(18000);
    expect(b.fits).toBe(true);
  });

  it('cíle nad rámec disponibilní částky se nevejdou', () => {
    const b = budgetNow(makeState(), allocs({ retirement: 40000 }));
    expect(b.fits).toBe(false);
    expect(b.surplus).toBe(-9000);
  });
});

describe('budgetAfterPurchase', () => {
  it('nájem a energie nahradí splátka s náklady na vlastnictví', () => {
    const state = makeState();
    const b = budgetAfterPurchase(state, allocs({ retirement: 5000 }));
    const expected = 60000 - (29000 - 12000 - 3500 + mortgagePayment(state) + ownershipCosts(state));
    expect(b.disposable).toBeCloseTo(expected, 6);
  });

  it('na akontaci se po koupi už neodkládá', () => {
    const state = makeState();
    const withSaving = budgetAfterPurchase(state, allocs({ downPayment: 8000, reserve: 0, retirement: 5000 }));
    const without = budgetAfterPurchase(state, allocs({ retirement: 5000 }));
    expect(withSaving.allocated).toBe(5000);
    expect(withSaving.allocated).toBe(without.allocated);
  });

  it('bydlení se nepočítá dvakrát: splátka je výdaj, ne cíl', () => {
    const state = makeState();
    const b = budgetAfterPurchase(state, allocs({ retirement: 5000 }));
    expect(b.disposable + 5000).toBeCloseTo(b.disposable + b.allocated, 6);
    expect(b.allocated).toBe(5000);
  });
});

describe('evaluateOverall: dvě období rozpočtu', () => {
  it('bez cíle nemovitost žádný rozpočet po koupi není', () => {
    const s = evaluateOverall(makeState({ goals: ['retirement'] }), allocs({ retirement: 5000 }));
    expect(s.budget).not.toBeNull();
    expect(s.budgetAfter).toBeNull();
  });

  it('s cílem nemovitost dostane uživatel obě období', () => {
    const s = evaluateOverall(makeState(), allocs({ downPayment: 8000, reserve: 0, retirement: 5000 }));
    expect(s.budget?.disposable).toBe(31000);
    expect(s.budgetAfter).not.toBeNull();
    expect(s.budgetAfter!.disposable).toBeLessThan(s.budget!.disposable);
  });

  it('rozpočet, který dnes vychází a po koupi ne, není v pořádku', () => {
    // Splátka sama o sobě projde přes DSTI, ale s ostatními výdaji už
    // domácnost po koupi skončí v mínusu. Dřív tohle nikdo nehlídal.
    // Dnes zbývá 7 000 Kč, cíle chtějí 2 000. Po koupi ale nájem 8 000
    // nahradí splátka ~17 600 plus 3 300 na vlastnictví, a rozpočet spadne
    // do mínusu. DSTI přitom zůstává na 37 %, tedy pod limitem bank.
    const state = makeState({
      income: { person1NetMonthly: 47000 },
      expenses: { rent: 8000, existingLoans: 0, insurance: 2500, food: 10000, transport: 6000, children: 7000, utilities: 3500, other: 3000 },
      savings: { totalSavings: 1200000 },
    });
    const s = evaluateOverall(state, allocs({ retirement: 2000 }));
    expect(s.budget?.fits).toBe(true);
    expect(s.budgetAfter?.fits).toBe(false);
    expect(s.status).toBe('not_yet');
  });
});
