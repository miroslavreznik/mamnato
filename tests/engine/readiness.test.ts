import { describe, it, expect } from 'vitest';
import { propertyReadiness, customReadiness, retirementReadiness } from '../../src/engine/readiness';
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

describe('rezerva po zaplacení akontace', () => {
  it('koupě, po které nezbyde rezerva, není „v pořádku"', () => {
    // Scénář hypotéky rezervu nezná, sleduje jen dostupnost úvěru. Bez
    // tohohle kroku dostal cíl zelenou i ten, komu po akontaci nezbyde nic.
    const state = makeState({ savings: { totalSavings: 800000 } });
    const r = propertyReadiness(state, allocs());
    expect(r.status).toBe('caution');
    expect(r.headline).toMatch(/nezbyla rezerva na nečekané výdaje/);
  });

  it('kdo si rezervu nechá, zelenou neztrácí', () => {
    const state = makeState({ savings: { totalSavings: 2000000 } });
    const r = propertyReadiness(state, allocs());
    expect(r.status).toBe('good');
    expect(r.headline).not.toMatch(/rezerva/);
  });
});

describe('customReadiness', () => {
  const goals = [
    { id: 'a', name: 'Auto', targetAmount: 120000, targetMonths: 12 },   // 10 000/měs.
    { id: 'b', name: 'Svatba', targetAmount: 60000, targetMonths: 12 },  // 5 000/měs.
  ];

  it('posuzuje každý cíl podle jeho vlastní částky', () => {
    const state = makeState({ goals: ['other'], customGoals: goals });
    const r = customReadiness(state, allocs({ custom: [10000, 5000] }));
    expect(r.status).toBe('good');
    expect(r.headline).toContain('2 z 2');
  });

  it('cíl bez peněz nevyjde, i když je vedle něj cíl s přebytkem', () => {
    // Tohle je celý rozdíl proti dřívějšku: peníze se mezi cíle nepřelévají
    // podle pořadí, každý má tu částku, kterou u něj uživatel nastavil.
    const state = makeState({ goals: ['other'], customGoals: goals });
    const r = customReadiness(state, allocs({ custom: [50000, 0] }));
    expect(r.status).toBe('caution');
    expect(r.headline).toContain('1 z 2');
  });

  it('bez peněz nevyjde nic', () => {
    const state = makeState({ goals: ['other'], customGoals: goals });
    expect(customReadiness(state, allocs({ custom: [0, 0] })).status).toBe('warning');
  });

  it('chybějící částka se bere jako nula, ne jako neomezená', () => {
    const state = makeState({ goals: ['other'], customGoals: goals });
    const r = customReadiness(state, allocs({ custom: [10000] }));
    expect(r.headline).toContain('1 z 2');
  });
});

describe('věta o důchodu stojí na výnosu, který jde přepsat', () => {
  const sporici = (rates?: Record<string, number>): WizardState => ({
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'individual',
    income: { person1NetMonthly: 60000 },
    expenses: { rent: 15000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 300000 },
    goals: ['retirement'],
    person1Age: 35,
    property: { targetPrice: 5000000 },
    retirementRates: rates,
  });
  const alloc = { downPayment: 0, retirement: 5000, child: 0, custom: [] };

  it('nižší výnos v tabulce znamená nižší rentu ve větě', () => {
    // Dokud si sazby držela karta, ukazovala tabulka portfolio při 4 %,
    // zatímco verdikt vedle mluvil o sedmi.
    const sedm = retirementReadiness(sporici(), alloc);
    const ctyri = retirementReadiness(sporici({ sp500: 0.04 }), alloc);
    expect(ctyri.headline).not.toBe(sedm.headline);
    expect(ctyri.headline).toContain('4 %');
    expect(sedm.headline).toContain('7 %');
  });

  it('předpoklad je ve větě napsaný', () => {
    expect(retirementReadiness(sporici(), alloc).headline).toMatch(/při výnosu .* ročně/);
  });
});
