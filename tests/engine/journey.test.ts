import { describe, it, expect } from 'vitest';
import { journey, beyondView } from '../../src/engine/journey';
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

describe('nejtěsnější místo a stuha si neodporují', () => {
  it('když stuha zežloutne kvůli cílům, karta to řekne taky', () => {
    // Rozpočet vychází, úspory rostou, rezerva je velká. Přesto na cíle
    // nezbývá. Dřív karta hlásila „plán drží po celou dobu" a stuha vedle
    // ní byla jantarová.
    const state = makeState({ goals: ['retirement'], savings: { totalSavings: 2000000 } });
    const j = journey(state, { allocations: { downPayment: 0, retirement: 99000, child: 0, custom: [] } });
    expect(j.tension.some((t) => t === 'tense')).toBe(true);
    expect(j.tightest?.tension).toBe('tense');
    expect(j.tightest?.explanation).toContain('na cíle by chybělo');
  });

  it('když na cíle zbývá, zůstává karta i stuha klidná', () => {
    const state = makeState({ goals: ['retirement'], savings: { totalSavings: 2000000 } });
    const j = journey(state, { allocations: { downPayment: 0, retirement: 1000, child: 0, custom: [] } });
    expect(j.tension.every((t) => t === 'calm')).toBe(true);
    expect(j.tightest?.tension).toBe('calm');
  });
});

describe('práh na schodku cílů', () => {
  it('rozdíl v řádu desetikorun není napětí', () => {
    // Bez prahu obarvila stuha třetinu horizontu jantarovou kvůli sedmnácti
    // korunám a karta u ní hlásila poplach.
    const state = makeState({ savings: { totalSavings: 2000000 } });
    const disposable = 41000;
    const j = journey(state, { allocations: { downPayment: 0, retirement: disposable + 20, child: 0, custom: [] } });
    expect(j.tension.every((t) => t === 'calm')).toBe(true);
    expect(j.tightest?.tension).toBe('calm');
  });

  it('schodek nad prahem napětím je', () => {
    const state = makeState({ savings: { totalSavings: 2000000 } });
    const disposable = 41000;
    // Práh je 1 % z příjmu 75 000, tedy 750 Kč.
    const j = journey(state, { allocations: { downPayment: 0, retirement: disposable + 2000, child: 0, custom: [] } });
    expect(j.tension.some((t) => t === 'tense')).toBe(true);
    expect(j.tightest?.tension).toBe('tense');
  });
});

describe('cesta sahá až k důchodu', () => {
  it('bez zadaného horizontu se řídí věkem, ne pevnými deseti lety', () => {
    const j = journey(makeState({ person1Age: 30 }));
    expect(j.horizonMonths).toBe(35 * 12);
    expect(j.points[j.points.length - 1].month).toBe(35 * 12);
  });

  it('doplacení hypotéky je událost na cestě jako každá jiná', () => {
    // Konec splácení je největší skok v rozpočtu za celý plán a do
    // desetiletého okna se nikdy nevešel: nejkratší hypotéka je patnáctiletá.
    const state = makeState({
      goals: ['property'],
      person1Age: 30,
      savings: { totalSavings: 1500000 },
      property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 15 },
    });
    const j = journey(state);
    const payoff = j.events.find((e) => e.key === 'payoff');
    const purchase = j.events.find((e) => e.key === 'purchase');
    expect(payoff).toBeDefined();
    expect(payoff!.month).toBe(purchase!.month + 15 * 12);
    expect(payoff!.label).toBe('Splaceno');
  });

  it('u krátkého horizontu se doplacení nekreslí', () => {
    const state = makeState({
      goals: ['property'],
      person1Age: 62, // horizont spadne na minimum, tedy deset let
      savings: { totalSavings: 1500000 },
      property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 15 },
    });
    expect(journey(state).events.some((e) => e.key === 'payoff')).toBe(false);
  });
});

describe('co zůstane mimo zobrazený úsek', () => {
  const buyer = () => makeState({
    goals: ['property'],
    person1Age: 30,
    savings: { totalSavings: 1500000 },
    property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 15 },
  });

  it('u celého plánu mlčí', () => {
    const j = journey(buyer());
    expect(beyondView(j, j.horizonMonths)).toBeNull();
  });

  it('jmenuje událost, která se do výřezu nevešla', () => {
    const j = journey(buyer());
    const note = beyondView(j, 120);
    expect(note).toMatch(/hypotéka splacena/);
  });

  it('napjaté místo za výřezem má přednost před událostmi', () => {
    // Bez tohohle si stuha a karta odporovaly: v deseti letech klidná zelená
    // a vedle ní karta „Po koupi 2042, rozpočet by byl v mínusu".
    const state = makeState({
      goals: ['property', 'child'],
      person1Age: 30,
      savings: { totalSavings: 300000 },
      property: { targetPrice: 8000000, mortgageRate: 0.052, loanTermYears: 30 },
    });
    const j = journey(state, { childOffsetMonths: 180 });
    expect(j.tightest!.tension).not.toBe('calm');
    expect(j.tightest!.month).toBeGreaterThan(120);
    expect(beyondView(j, 120)).toContain(j.tightest!.title);
  });

  it('klidný plán bez událostí za výřezem nic nedodává', () => {
    const j = journey(makeState({ savings: { totalSavings: 2000000 }, person1Age: 30 }));
    expect(beyondView(j, 120)).toBeNull();
  });
})
