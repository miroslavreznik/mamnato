import { describe, it, expect } from 'vitest';
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

describe('evaluateOverall', () => {
  it('returns fix_budget when disposable is not positive', () => {
    const state = makeState({ income: { person1NetMonthly: 20000 } });
    const s = evaluateOverall(state, allocs());
    expect(s.status).toBe('fix_budget');
    expect(s.tips.length).toBeGreaterThan(0);
  });

  it('returns not_yet when saving goals exceed disposable', () => {
    // disponibilní = 60 000 − 29 000 = 31 000, cíle chtějí víc
    const state = makeState({ goals: ['property', 'retirement'] });
    const s = evaluateOverall(state, allocs({ downPayment: 25000, retirement: 35000 }));
    expect(s.status).toBe('not_yet');
    expect(s.budget?.fits).toBe(false);
  });

  it('odkládání na akontaci je součástí rozpočtu, splátka ne', () => {
    // Splátka hypotéky je výdaj na bydlení, ne cíl, a v alokacích proto vůbec
    // není. Odkládání na akontaci naopak z rozpočtu ukusuje jako každý cíl.
    const state = makeState({ goals: ['property', 'retirement'] });
    const s = evaluateOverall(state, allocs({ downPayment: 8000, retirement: 5000 }));
    expect(s.budget?.allocated).toBe(13000);
  });

  it('produces a per-goal readiness entry for each active goal', () => {
    const state = makeState({ goals: ['property', 'retirement'] });
    const s = evaluateOverall(state, allocs({ downPayment: 10000, retirement: 5000 }));
    expect(s.goals.map((g) => g.key).sort()).toEqual(['property', 'retirement']);
  });

  it('budget surplus is disposable minus saving allocations', () => {
    const state = makeState({ goals: ['retirement'] });
    const s = evaluateOverall(state, allocs({ retirement: 10000 }));
    // disposable = 31000, allocated = 10000 → surplus 21000
    expect(s.budget?.surplus).toBe(21000);
    expect(s.budget?.fits).toBe(true);
  });

  it('rozpočet vidí i ten, kdo chce jen nemovitost', () => {
    // Odkládání na akontaci je taky závazek, takže rozpočtová věta dává smysl
    // i bez důchodu a dalších cílů. Dřív se schovávala.
    const state = makeState({ goals: ['property'] });
    const s = evaluateOverall(state, allocs({ downPayment: 20000 }));
    expect(s.budget).not.toBeNull();
    expect(s.budget?.allocated).toBe(20000);
  });

  it('gives actionable tips even to non-property users with a comfortable budget', () => {
    const state = makeState({ goals: ['retirement'], income: { person1NetMonthly: 90000 } });
    const s = evaluateOverall(state, allocs({ retirement: 8000 }));
    expect(['good', 'tight']).toContain(s.status);
    expect(s.tips.length).toBeGreaterThan(0);
  });

  it('flags a modest retirement contribution as caution, not automatically good', () => {
    // Malý příspěvek *a* malé úspory. S velkými úsporami je „pozor" špatně:
    // kdo má naspořeno, dosáhne na rentu i s tisícovkou měsíčně.
    const state = makeState({ goals: ['retirement'], person1Age: 55, savings: { totalSavings: 50000 } });
    const s = evaluateOverall(state, allocs({ retirement: 1000 }));
    expect(s.goals.find((g) => g.key === 'retirement')?.status).toBe('caution');
  });

  it('do renty se počítá i to, co už je naspořeno', () => {
    // Dva miliony na účtu a sedm let do důchodu. Dokud projekce začínala od
    // nuly, tvrdila appka, že renta bude „spíš doplněk", i když samotné
    // úspory dají přes sedm tisíc měsíčně.
    const rich = makeState({ goals: ['retirement'], person1Age: 58, savings: { totalSavings: 2200000 } });
    const poor = makeState({ goals: ['retirement'], person1Age: 58, savings: { totalSavings: 0 } });
    const withSavings = evaluateOverall(rich, allocs({ retirement: 6900 }));
    const without = evaluateOverall(poor, allocs({ retirement: 6900 }));

    expect(withSavings.goals.find((g) => g.key === 'retirement')?.status).toBe('good');
    expect(without.goals.find((g) => g.key === 'retirement')?.status).toBe('caution');
  });

  it('adds a parental-leave readiness row and downgrades the verdict when leave goes negative', () => {
    // Rezerva po akontaci (200 000 Kč) schodek za celé volno (~168 000 Kč)
    // pokryje, takže „pozor", ne „nevychází". Verdikt ale zelený být nesmí.
    const state = makeState({
      mode: 'couple',
      goals: ['property', 'child'],
      income: { person1NetMonthly: 45000, person2NetMonthly: 30000 },
      property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
      parentalLeave: { enabled: true, parent: 1, durationMonths: 36, monthlyBenefit: 5000 },
    });
    const s = evaluateOverall(state, allocs({ downPayment: 26000 }));
    const leave = s.goals.find((g) => g.key === 'leave');
    expect(leave?.status).toBe('caution');
    expect(s.status).not.toBe('good');
  });

  it('marks the leave as not workable when savings run out mid-leave', () => {
    const state = makeState({
      mode: 'couple',
      goals: ['property', 'child'],
      income: { person1NetMonthly: 45000, person2NetMonthly: 30000 },
      savings: { totalSavings: 1050000 }, // po akontaci zbyde jen 50 000 Kč
      property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
      parentalLeave: { enabled: true, parent: 1, durationMonths: 36, monthlyBenefit: 5000 },
    });
    const s = evaluateOverall(state, allocs({ downPayment: 26000 }));
    expect(s.goals.find((g) => g.key === 'leave')?.status).toBe('warning');
    expect(s.status).toBe('not_yet');
  });
});

describe('verdikt „Mám na to?"', () => {
  it('u nevyrovnaného rozpočtu odpoví jasným ne, bez „ale"', () => {
    const state = makeState({ income: { person1NetMonthly: 20000 } });
    const v = evaluateOverall(state, allocs()).verdict;
    expect(v.answer).toBe('no');
    expect(v.headline).toBe('Zatím na to nemáte');
    expect(v.qualifier).toBe('');
  });

  it('když se cíle nevejdou, odpoví ne, ale s cestou ven', () => {
    // cíle spolknou víc, než je disponibilní částka
    const state = makeState({ goals: ['retirement'] });
    const v = evaluateOverall(state, allocs({ retirement: 999000 })).verdict;
    expect(v.answer).toBe('no_but');
    expect(v.qualifier).not.toBe('');
  });

  it('u komfortní situace odpoví ano bez výhrad', () => {
    const state = makeState({
      goals: ['retirement'],
      income: { person1NetMonthly: 120000 },
      savings: { totalSavings: 2000000 },
    });
    const v = evaluateOverall(state, allocs({ retirement: 20000 })).verdict;
    expect(v.answer).toBe('yes');
    expect(v.headline).toBe('Máte na to');
    expect(v.qualifier).toBe('');
  });

  it('bez zvolených cílů odpoví na rozpočet, ne na cíl', () => {
    const state = makeState({ goals: [] });
    const v = evaluateOverall(state, allocs()).verdict;
    expect(v.headline).toMatch(/Rozpočet/);
    expect(v.reason).toMatch(/cíl/i);
  });

  it('varianta s „ale" má vždy doplněk, jasná odpověď nikdy', () => {
    const cases: WizardState[] = [
      makeState({ income: { person1NetMonthly: 20000 } }),
      makeState({ goals: ['retirement'] }),
      makeState({ goals: ['retirement'], income: { person1NetMonthly: 120000 } }),
    ];
    for (const state of cases) {
      const v = evaluateOverall(state, allocs({ retirement: 3000 })).verdict;
      const hasBut = v.answer === 'yes_but' || v.answer === 'no_but';
      expect(hasBut ? v.qualifier.length > 0 : v.qualifier === '').toBe(true);
      expect(v.reason.length).toBeGreaterThan(10);
    }
  });
});

describe('napjatý verdikt vysvětluje svůj vlastní důvod', () => {
  it('u tenké rezervy mluví o polštáři', () => {
    const state = makeState({ goals: ['retirement'], savings: { totalSavings: 20000 } });
    const v = evaluateOverall(state, allocs({ retirement: 12000 })).verdict;
    expect(v.answer).toBe('yes_but');
    expect(v.reason).toMatch(/polštář/);
  });

  it('u nízké míry úspor mluví o tom, že po výdajích málo zbývá', () => {
    // Rezerva na pět let, renta v pohodě, ale z příjmu zbývá 8 %.
    const state = makeState({
      goals: ['retirement'],
      person1Age: 40,
      savings: { totalSavings: 3000000 },
      expenses: { rent: 30000, utilities: 5000, existingLoans: 0, insurance: 2000, food: 8000, transport: 5000, children: 0, other: 5000 },
    });
    const v = evaluateOverall(state, allocs({ retirement: 1000 })).verdict;
    expect(v.answer).toBe('yes_but');
    expect(v.reason).toMatch(/zbývá míň než desetina/);
  });

  it('u cíle na hraně pojmenuje ten cíl, ne chybějící rezervu', () => {
    // Rezerva na šest let a čtyřicet procent příjmu stranou. Dřív u toho
    // stálo „bez velkého polštáře, nečekaný výdaj by rozpočet rozhodil",
    // hned vedle dlaždice „rezerva vydrží 78,6 měsíce".
    const state = makeState({
      goals: ['retirement'],
      person1Age: 58,
      savings: { totalSavings: 400000 },
    });
    const v = evaluateOverall(state, allocs({ retirement: 12000 })).verdict;
    expect(v.answer).toBe('yes_but');
    expect(v.reason).not.toMatch(/polštář/);
    expect(v.reason).toMatch(/Důchod/);
  });
});

describe('tvrzení musí platit, ne jen znít dobře', () => {
  it('renta se uvádí v dnešních cenách, ne v korunách roku 2060', () => {
    // Dřív se projekce počítala nominálně: třicátníkovi appka slíbila
    // 95 962 Kč měsíčně, jenže to byly koruny roku 2060. Vedle časové osy,
    // která je v dnešních cenách celá, to bylo dvojí měřítko v jednom
    // přehledu. Hranice „pod 8 000 Kč je to spíš doplněk" se navíc
    // porovnávala s číslem, které dnešními penězi znamenalo necelé tři tisíce.
    const state = makeState({ goals: ['retirement'], person1Age: 31, savings: { totalSavings: 1100000 } });
    const s = evaluateOverall(state, allocs({ retirement: 14910 }));
    const rent = s.goals.find((g) => g.key === 'retirement')!;
    expect(rent.headline).toContain('v dnešních cenách');
    // Reálný výnos 7 % nad 3% inflací dá zhruba polovinu nominální renty.
    // Oddělovač tisíců se liší podle verze ICU (U+00A0 vs U+202F), proto se
    // z věty vytahují jen číslice.
    const amount = Number((rent.headline.match(/na (.+?) Kč měsíčně/)?.[1] ?? '').replace(/\D/g, ''));
    expect(amount).toBeGreaterThan(20000);
    expect(amount).toBeLessThan(70000);
  });

  it('u rodičovské se slibuje nejhorší měsíc, ne průměr za celé volno', () => {
    // Mateřská je vyšší a kratší než rodičovský příspěvek, takže vážený
    // průměr slibuje částku platnou jen prvního půl roku. „Zbyde vám
    // 13 790 Kč" u volna, kde po půl roce zbývá 9 548 Kč, není pravda.
    const state = makeState({
      mode: 'couple',
      goals: ['property', 'child'],
      person1Age: 31,
      person2Age: 29,
      income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
      expenses: { rent: 19000, existingLoans: 0, insurance: 1800, food: 9000, transport: 4000, children: 0, utilities: 4500, other: 5000 },
      savings: { totalSavings: 1100000 },
      property: { targetPrice: 6200000, loanTermYears: 30 },
      parentalLeave: { enabled: true, parent: 2, durationMonths: 36 },
    });
    const leave = evaluateOverall(state, allocs()).goals.find((g) => g.key === 'leave')!;
    expect(leave.headline).toMatch(/nejméně/);
    expect(leave.headline).toMatch(/na mateřské víc/);
  });

  it('věta o cíli na hraně se skloňuje po předložce „u"', () => {
    const state = makeState({
      goals: ['property'],
      person1Age: 42,
      person2Age: 45,
      mode: 'couple',
      income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
      expenses: { rent: 19000, existingLoans: 0, insurance: 1800, food: 9000, transport: 4000, children: 0, utilities: 4500, other: 5000 },
      savings: { totalSavings: 1100000 },
      property: { targetPrice: 6200000, loanTermYears: 30 },
    });
    const v = evaluateOverall(state, allocs({ downPayment: 24850 })).verdict;
    expect(v.reason).toContain('u cíle níže');
    expect(v.reason).not.toContain('u cíl ');
  });
});
