import { describe, it, expect } from 'vitest';
import { journey } from '../../src/engine/journey';
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

describe('journey', () => {
  it('u rozpočtu bez událostí je celá cesta klidná', () => {
    const j = journey(makeState(), { months: 24 });
    // Nultý bod nemá tok, ten se hodnotí až od prvního měsíce.
    expect(j.tension.slice(1).every((t) => t === 'calm')).toBe(true);
    expect(j.firstNegativeMonth).toBeNull();
  });

  it('napětí se řídí tokem, ne zůstatkem', () => {
    // Vysoké úspory, ale schodek: na křivce zůstatku by to dlouho vypadalo
    // dobře, protože je z čeho brát. Stuha to musí ukázat hned.
    const state = makeState({
      income: { person1NetMonthly: 20000, person2NetMonthly: 0 },
      savings: { totalSavings: 3000000 },
    });
    const j = journey(state, { months: 24 });
    expect(j.tension[1]).toBe('deficit');
    // Úspory jsou pořád vysoké, přesto je stav „schodek".
    expect(j.points[1].cash).toBeGreaterThan(1000000);
  });

  it('napjato je i tehdy, když tok vychází, ale rezerva je pod jedním měsícem', () => {
    const state = makeState({
      savings: { totalSavings: 1000 },
      income: { person1NetMonthly: 35000, person2NetMonthly: 0 },
    });
    const j = journey(state, { months: 3 });
    expect(j.tension[1]).toBe('tense');
    expect(j.points[1].flow).toBeGreaterThan(0);
  });

  it('nejtěsnější místo hledá nejhorší tok, ne propad po akontaci', () => {
    // Koupě jednorázově ukrojí akontaci, takže minimum úspor je hned po ní.
    // Kdyby se „nejtěsnější místo" hledalo podle zůstatku, ukázalo by koupi,
    // i když rozpočet po ní vychází.
    const state = makeState({ goals: ['property'], savings: { totalSavings: 1200000 } });
    const j = journey(state, { months: 120 });
    const purchase = j.events.find((e) => e.key === 'purchase');
    expect(purchase).toBeDefined();
    expect(j.tightest).not.toBeNull();
    expect(j.tightest!.tension).not.toBe('deficit');
  });

  it('u schodku pojmenuje nejtěsnější místo podle události, která mu předchází', () => {
    const state = makeState({
      goals: ['property'],
      savings: { totalSavings: 1200000 },
      // Splátka a náklady vlastnictví po koupi přerostou příjem.
      income: { person1NetMonthly: 30000, person2NetMonthly: 0 },
    });
    const j = journey(state, { months: 120 });
    expect(j.tightest?.tension).toBe('deficit');
    expect(j.tightest?.title).toMatch(/^Po koupi \d{4}$/);
  });

  it('nejnižší bod je vždy poslední událost, ať padne kamkoli', () => {
    const j = journey(makeState({ goals: ['property'] }), { months: 120 });
    expect(j.events.at(-1)?.key).toBe('lowest');
    expect(j.events.at(-1)?.month).toBe(j.minCashMonth);
  });

  it('konec rodičovské se za horizontem nekreslí', () => {
    const state = makeState({
      goals: ['child'],
      parentalLeave: { enabled: true, parent: 2, durationMonths: 36 },
    });
    const short = journey(state, { months: 24, childOffsetMonths: 12 });
    expect(short.events.some((e) => e.key === 'leaveEnd')).toBe(false);
    const long = journey(state, { months: 120, childOffsetMonths: 12 });
    expect(long.events.some((e) => e.key === 'leaveEnd')).toBe(true);
  });

  it('napětí má stejnou délku jako body, aby se dalo barvit po úsecích', () => {
    const j = journey(makeState({ goals: ['property'] }), { months: 60 });
    expect(j.tension).toHaveLength(j.points.length);
  });
});

describe('journey: nejtěsnější místo na startu', () => {
  it('neříká „úspory klesnou", když jen rostou', () => {
    // Bez událostí úspory od začátku jen přibývají, takže nejnižší bod je
    // start. Věta o poklesu by tvrdila něco, co se nestalo.
    const j = journey(makeState({ savings: { totalSavings: 20000 } }), { months: 60 });
    expect(j.minCashMonth).toBe(0);
    expect(j.tightest?.title).toBe('Nejtěsnější je teď');
    expect(j.tightest?.explanation).not.toMatch(/klesn/);
    expect(j.tightest?.explanation).toMatch(/rostou/);
  });

  it('rozliší, jestli startovní rezerva stačí na měsíc výdajů', () => {
    const chudy = journey(makeState({ savings: { totalSavings: 1000 } }), { months: 24 });
    expect(chudy.tightest?.tension).toBe('tense');

    const bohaty = journey(makeState({ savings: { totalSavings: 900000 } }), { months: 24 });
    expect(bohaty.tightest?.tension).toBe('calm');
    expect(bohaty.tightest?.title).toBe('Nejtěsnější je teď');
  });
});
