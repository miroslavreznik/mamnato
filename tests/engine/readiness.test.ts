import { describe, it, expect } from 'vitest';
import { propertyReadiness } from '../../src/engine/readiness';
import { evaluateOverall } from '../../src/engine/summary';
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
    goals: ['property'],
    property: { targetPrice: 4000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

const allocs = (o: Partial<GoalAllocations> = {}): GoalAllocations => ({
  downPayment: 0, retirement: 0, child: 0, custom: [], ...o,
});

describe('propertyReadiness', () => {
  it('pokrytou akontaci pozná', () => {
    const r = propertyReadiness(makeState(), allocs());
    expect(r.headline).toMatch(/Akontaci máte pokrytou/);
  });

  it('neopakuje čísla z dlaždic nad sebou', () => {
    // Splátka, DSTI i termín naspoření jsou v dlaždicích. Věta u cíle říká,
    // co z nich plyne, ne je znovu vypisuje.
    const cases = [
      propertyReadiness(makeState(), allocs()),
      propertyReadiness(makeState({ savings: { totalSavings: 0 } }), allocs({ downPayment: 10000 })),
      propertyReadiness(makeState({ savings: { totalSavings: 0 } }), allocs()),
    ];
    for (const r of cases) {
      expect(r.headline).not.toMatch(/\d/);
    }
  });

  it('u chybějící akontace řekne, že se ještě dospořuje', () => {
    const state = makeState({ savings: { totalSavings: 0 } });
    const r = propertyReadiness(state, allocs({ downPayment: 10000 }));
    expect(r.headline).toMatch(/dospoř/);
  });

  it('nulové odkládání nesmí slibovat termín', () => {
    const state = makeState({ savings: { totalSavings: 0 } });
    const r = propertyReadiness(state, allocs({ downPayment: 0 }));
    expect(r.headline).toMatch(/zatím na ni nic neodkládáte/);
    expect(r.headline).not.toMatch(/naspoříte za/);
  });

  it('splátku nad limit bank pojmenuje jako důvod, ne jako zkratku', () => {
    const state = makeState({ income: { person1NetMonthly: 30000 }, property: { targetPrice: 8000000, mortgageRate: 0.052, loanTermYears: 30 } });
    const r = propertyReadiness(state, allocs({ downPayment: 5000 }));
    expect(r.status).toBe('warning');
    expect(r.headline).toMatch(/nad tím, co banky obvykle schválí/);
  });

  it('je to celá věta, ne odrážka s tečkami', () => {
    const r = propertyReadiness(makeState(), allocs());
    expect(r.headline.endsWith('.')).toBe(true);
    expect(r.headline).not.toContain('·');
  });
});

describe('bydlení mezi cíli', () => {
  it('nemovitost se v přehledu cílů objeví jako cíl', () => {
    // Dřív se odsud vyřazovala, protože se opakovala s dlaždicemi, takže
    // uživatel s hypotékou v seznamu cílů svůj největší závazek neviděl.
    const s = evaluateOverall(makeState({ goals: ['property', 'retirement'] }), allocs({ downPayment: 8000, retirement: 5000 }));
    const property = s.goals.find((g) => g.key === 'property');
    expect(property).toBeDefined();
    expect(property?.label).toBe('Vlastní bydlení');
  });
});
