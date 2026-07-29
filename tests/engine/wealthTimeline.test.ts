import { describe, it, expect } from 'vitest';
import { wealthTimeline } from '../../src/engine/wealthTimeline';
import { calculateDefaultAllocations, monthsToSaveAtAllocation } from '../../src/engine/allocation';
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

describe('wealthTimeline', () => {
  it('grows linearly by disposable when there are no events', () => {
    const state = makeState(); // income 75000, expenses 34000 → +41000/měs
    const tl = wealthTimeline(state, { months: 12 });
    expect(tl.points[0].cash).toBe(800000);
    expect(tl.points[12].cash).toBe(800000 + 41000 * 12);
    expect(tl.purchaseMonth).toBeNull();
    expect(tl.childMonth).toBeNull();
    expect(tl.firstNegativeMonth).toBeNull();
  });

  it('kupuje se z peněz vyhrazených na akontaci, ne z celého jmění', () => {
    // Chybí 200 000 Kč akontace. Volných je 41 000 Kč měsíčně, ale na
    // akontaci z nich jde jen část (výchozí rozdělení dává půlku, tedy
    // 20 500 Kč), zbytek zůstává volný. Koupě proto nastane po deseti
    // měsících, ne po pěti.
    //
    // Dřív se kupovalo, jakmile na akontaci stačilo *celé* jmění, tedy
    // i peníze odložené na důchod nebo na dítě. Na výsledcích pak stálo
    // „naspoříte za 4 roky a 4 měsíce" a stuha hned pod tím kreslila koupi
    // za rok a dva měsíce.
    const state = makeState({ goals: ['property'] }); // akontace 20 % z 5M = 1M > 800k
    const tl = wealthTimeline(state, { months: 60 });
    expect(tl.purchaseMonth).toBe(10);

    // Termín sedí s tím, co appka slibuje u chybějící akontace.
    const alloc = calculateDefaultAllocations(state);
    expect(tl.purchaseMonth).toBe(monthsToSaveAtAllocation(state, alloc.downPayment));

    // Po koupi je cash menší než před ní, akontace se odečetla.
    const m = tl.purchaseMonth!;
    expect(tl.points[m + 1].cash).toBeLessThan(tl.points[m].cash);
  });

  it('vyšší odkládání na akontaci koupi přiblíží', () => {
    const state = makeState({ goals: ['property'] });
    const slow = wealthTimeline(state, { months: 60, allocations: { downPayment: 5000, retirement: 0, child: 0, custom: [] } });
    const fast = wealthTimeline(state, { months: 60, allocations: { downPayment: 40000, retirement: 0, child: 0, custom: [] } });
    expect(slow.purchaseMonth).toBe(40);
    expect(fast.purchaseMonth).toBe(5);
  });

  it('flow po cílech odečítá to, co na cíle jde, a po koupi už ne akontaci', () => {
    // Jmění může růst, a přesto na cíle nezbývat. Bez tohohle rozdílu
    // barvila stuha klidnou zelenou i tam, kde verdikt hlásil, že po koupi
    // na cíle chybí.
    const state = makeState({ goals: ['property', 'retirement'] });
    const a = { downPayment: 10000, retirement: 8000, child: 0, custom: [] };
    const tl = wealthTimeline(state, { months: 60, allocations: a });
    const before = tl.points[1];
    expect(before.flowAfterGoals).toBe(before.flow - 18000);

    const after = tl.points[tl.purchaseMonth! + 2];
    // Akontace je zaplacená, odkládat se na ni přestává.
    expect(after.flowAfterGoals).toBe(after.flow - 8000);
  });

  it('child costs and parental leave push cash down and can go negative', () => {
    const state = makeState({
      goals: ['property', 'child'],
      savings: { totalSavings: 1000000 }, // DP hned
      parentalLeave: { enabled: true, parent: 1, durationMonths: 36, monthlyBenefit: 9722 },
    });
    const withLeave = wealthTimeline(state, { months: 60, childOffsetMonths: 6 });
    const noLeave = wealthTimeline({ ...state, parentalLeave: undefined }, { months: 60, childOffsetMonths: 6 });
    expect(withLeave.purchaseMonth).toBe(0);
    expect(withLeave.childMonth).toBe(6);
    expect(withLeave.leaveEndMonth).toBe(42);
    // výpadek příjmu během volna → nižší jmění než bez rodičovské
    expect(withLeave.points[42].cash).toBeLessThan(noLeave.points[42].cash);
  });

  it('never buys when the down payment is unreachable in the horizon', () => {
    const state = makeState({
      goals: ['property'],
      income: { person1NetMonthly: 34500 }, // disposable 500/měs
      savings: { totalSavings: 100000 },
    });
    const tl = wealthTimeline(state, { months: 120 });
    expect(tl.purchaseMonth).toBeNull();
  });
});

describe('cíle, které v čase končí', () => {
  it('rezerva na dítě se po narození nepočítá znovu, dítě je pak výdaj', () => {
    // Do narození je rezerva na dítě odkládání stranou. Od narození se dítě
    // platí doopravdy a jeho náklad je mezi výdaji; kdyby se počítalo obojí,
    // platila by domácnost za dítě dvakrát a stuha by hlásila napjatý
    // rozpočet i tam, kde ve skutečnosti vychází.
    const state = makeState({ goals: ['child'], savings: { totalSavings: 300000 } });
    const a = { downPayment: 0, retirement: 0, child: 9000, custom: [] };
    const tl = wealthTimeline(state, { months: 36, childOffsetMonths: 12, allocations: a });

    const before = tl.points[6];
    expect(before.flowAfterGoals).toBe(before.flow - 9000);

    // Po narození už se rezerva neodečítá: náklad na dítě je v `flow`.
    const after = tl.points[20];
    expect(after.flowAfterGoals).toBe(after.flow);
    // A ten náklad se v toku opravdu projevil.
    expect(after.flow).toBeLessThan(before.flow);
  });

  it('odkládání na akontaci končí koupí', () => {
    const state = makeState({ goals: ['property'], savings: { totalSavings: 1000000 } });
    const a = { downPayment: 12000, retirement: 4000, child: 0, custom: [] };
    const tl = wealthTimeline(state, { months: 36, allocations: a });
    expect(tl.purchaseMonth).toBe(0);
    const after = tl.points[3];
    expect(after.flowAfterGoals).toBe(after.flow - 4000);
  });
});
