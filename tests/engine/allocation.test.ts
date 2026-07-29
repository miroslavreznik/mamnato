import { describe, it, expect } from 'vitest';
import { calculateDefaultAllocations, monthsToSaveAtAllocation } from '../../src/engine/allocation';
import { monthlyDisposable } from '../../src/engine/cashflow';
import { downPaymentGap } from '../../src/engine/mortgage';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 60000 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 300000 },
    goals: ['property', 'retirement'],
    property: { targetPrice: 4000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('calculateDefaultAllocations', () => {
  it('nepočítá bydlení dvakrát: splátka není alokace', () => {
    // Disponibilní částka už má odečtený nájem. Kdyby se z ní navíc strhla
    // celá splátka hypotéky, domácnost by platila bydlení dvakrát a na důchod
    // by nezbylo nic, i když reálně zbývá.
    const state = makeState();
    const a = calculateDefaultAllocations(state);
    expect(a.retirement).toBeGreaterThan(0);
    expect(a.downPayment + a.retirement).toBeLessThanOrEqual(monthlyDisposable(state));
  });

  it('velká chybějící akontace se stihne do pěti let, když na to rozpočet má', () => {
    const state = makeState({ savings: { totalSavings: 0 } });
    const a = calculateDefaultAllocations(state);
    expect(monthsToSaveAtAllocation(state, a.downPayment)).toBeLessThanOrEqual(60);
    expect(a.downPayment).toBeLessThanOrEqual(monthlyDisposable(state));
  });

  it('malá chybějící akontace se neroztahuje na pět let', () => {
    // Pět let je strop, ne cíl. Komu chybí 40 000 Kč, tomu appka nabízela
    // 667 Kč měsíčně a termín „za 5 let", což je nesmysl.
    const state = makeState({ savings: { totalSavings: 760000 } });
    const gap = downPaymentGap(state);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(100000);
    const a = calculateDefaultAllocations(state);
    expect(monthsToSaveAtAllocation(state, a.downPayment)).toBeLessThanOrEqual(12);
  });

  it('na akontaci nejde všechno, na ostatní cíle zbývá', () => {
    const state = makeState({ savings: { totalSavings: 760000 } });
    const a = calculateDefaultAllocations(state);
    expect(a.downPayment).toBeLessThan(monthlyDisposable(state));
    expect(a.retirement).toBeGreaterThan(0);
  });

  it('bez cíle nemovitost se na akontaci neodkládá nic', () => {
    const a = calculateDefaultAllocations(makeState({ goals: ['retirement'] }));
    expect(a.downPayment).toBe(0);
  });

  it('pokrytou akontaci není potřeba dospořovat', () => {
    const state = makeState({ savings: { totalSavings: 2000000 } });
    expect(downPaymentGap(state)).toBe(0);
    expect(calculateDefaultAllocations(state).downPayment).toBe(0);
  });

  it('akontace má přednost, ale nikdy si nevezme víc, než co zbývá', () => {
    const state = makeState({ income: { person1NetMonthly: 32000 }, savings: { totalSavings: 0 } });
    const a = calculateDefaultAllocations(state);
    expect(a.downPayment).toBeLessThanOrEqual(monthlyDisposable(state));
    expect(a.retirement).toBeGreaterThanOrEqual(0);
  });
});

describe('monthsToSaveAtAllocation', () => {
  it('počítá z toho, co se opravdu odkládá', () => {
    const state = makeState({ savings: { totalSavings: 0 } });
    const gap = downPaymentGap(state);
    expect(monthsToSaveAtAllocation(state, 10000)).toBe(Math.ceil(gap / 10000));
  });

  it('nulové odkládání znamená nekonečno, ne celou disponibilní částku', () => {
    // Dřív se tu spadlo na výpočet z celé disponibilní částky, což je termín
    // platný jen pro toho, kdo nespoří na nic jiného.
    const state = makeState({ savings: { totalSavings: 0 } });
    expect(monthsToSaveAtAllocation(state, 0)).toBe(Infinity);
  });

  it('pokrytá akontace je hotová ihned', () => {
    const state = makeState({ savings: { totalSavings: 2000000 } });
    expect(monthsToSaveAtAllocation(state, 0)).toBe(0);
  });
});

describe('rozdělení mezi vlastní cíle', () => {
  it('součet nepřesáhne volné peníze ani při nedělitelném zbytku', () => {
    // Zaokrouhlený podíl přestřeloval: ze 44 000 na tři cíle vycházelo
    // 3 × 14 667 = 44 001 a v přehledu stálo „volných zbývá −1 Kč".
    for (const count of [1, 2, 3, 7]) {
      const state = makeState({
        goals: ['other'],
        customGoals: Array.from({ length: count }, (_, i) => ({
          id: `g${i}`, name: `c${i}`, targetAmount: 100000, targetMonths: 12,
        })),
      });
      const a = calculateDefaultAllocations(state);
      const sum = a.custom.reduce((s, v) => s + v, 0);
      expect(a.custom).toHaveLength(count);
      expect(sum).toBeLessThanOrEqual(monthlyDisposable(state));
      expect(a.custom.every((v) => v >= 0)).toBe(true);
    }
  });
});
