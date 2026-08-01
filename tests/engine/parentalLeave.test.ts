import { describe, it, expect } from 'vitest';
import {
  evaluateParentalLeave,
  defaultCaringParent,
  parentalLeaveApplicable,
} from '../../src/engine/parentalLeave';
import { wealthTimeline } from '../../src/engine/wealthTimeline';
import { calculateDefaultAllocations } from '../../src/engine/allocation';
import { expensesAfterPurchase } from '../../src/engine/mortgage';
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
    goals: ['child'],
    property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('parental leave helpers', () => {

  it('default caring parent is the lower earner', () => {
    expect(defaultCaringParent(makeState())).toBe(2); // person2 earns less
    expect(defaultCaringParent(makeState({ income: { person1NetMonthly: 20000, person2NetMonthly: 50000 } }))).toBe(1);
  });

  it('is applicable only for couples/families with a child goal and two incomes', () => {
    expect(parentalLeaveApplicable(makeState())).toBe(true);
    expect(parentalLeaveApplicable(makeState({ goals: ['property'] }))).toBe(false);
    expect(parentalLeaveApplicable(makeState({ mode: 'individual', income: { person1NetMonthly: 45000 } }))).toBe(false);
  });
});

describe('evaluateParentalLeave', () => {
  it('returns null when not enabled', () => {
    expect(evaluateParentalLeave(makeState())).toBeNull();
    expect(evaluateParentalLeave(makeState({ parentalLeave: { enabled: false, parent: 2, durationMonths: 36, monthlyBenefit: 10000 } }))).toBeNull();
  });

  it('replaces the caring parent salary with the benefit during leave', () => {
    const state = makeState({
      goals: ['child'],
      parentalLeave: { enabled: true, parent: 2, durationMonths: 24, monthlyBenefit: 12000 },
    });
    const r = evaluateParentalLeave(state)!;
    // income now = 75000; during leave = 75000 - 30000 (person2) + 12000 = 57000
    expect(r.incomeNow).toBe(75000);
    expect(r.incomeDuringLeave).toBe(57000);
    // Kolik se za volno nenaspoří: výpadek mzdy proti dávce (30 000 − 12 000)
    // a k tomu náklad na dítě, které je tou dobou doma (8 000 dle ČSÚ).
    expect(r.savingsLostTotal).toBe((18000 + 8000) * 24);
    // no property goal → after-purchase disposable is null
    expect(r.disposableDuringLeaveAfterPurchase).toBeNull();
  });

  it('reports reserve coverage of the leave shortfall', () => {
    const state = makeState({
      goals: ['child', 'property'],
      savings: { totalSavings: 1200000, downPaymentFromSavings: 1000000 }, // rezerva 200k
      // Dítě hned: rezerva je pak přesně to, co zbude po akontaci. Kdo ho
      // čeká později, má do té doby naspořeno víc a rezerva je jiná.
      childInMonths: 0,
      parentalLeave: { enabled: true, parent: 1, durationMonths: 36, monthlyBenefit: 5000 },
    });
    const r = evaluateParentalLeave(state)!;
    expect(r.reserveAfter).toBe(200000);
    if (r.shortfallPerMonth > 0) {
      expect(r.monthsCovered).toBe(Math.floor(200000 / r.shortfallPerMonth));
      expect(r.shortfallTotal).toBe(r.shortfallPerMonth * 36);
    }
  });

  it('monthsCovered is null when there is no shortfall', () => {
    const state = makeState({
      goals: ['child'],
      income: { person1NetMonthly: 90000, person2NetMonthly: 60000 },
      parentalLeave: { enabled: true, parent: 2, durationMonths: 24, monthlyBenefit: 15000 },
    });
    const r = evaluateParentalLeave(state)!;
    expect(r.shortfallPerMonth).toBe(0);
    expect(r.monthsCovered).toBeNull();
  });

  it('computes the post-purchase during-leave disposable when buying', () => {
    const state = makeState({
      goals: ['child', 'property'],
      parentalLeave: { enabled: true, parent: 2, durationMonths: 36, monthlyBenefit: 10000 },
    });
    const r = evaluateParentalLeave(state)!;
    expect(r.disposableDuringLeaveAfterPurchase).not.toBeNull();
    // mortgage on a 5M home makes it much tighter than the pre-purchase leave disposable
    expect(r.disposableDuringLeaveAfterPurchase!).toBeLessThan(r.disposableDuringLeave);
  });
});

describe('dítě je součástí rodičovské, ne až po ní', () => {
  const par = (): WizardState => makeState({
    mode: 'couple',
    goals: ['property', 'child'],
    person1Age: 30,
    person2Age: 30,
    income: { person1NetMonthly: 45000, person2NetMonthly: 38000 },
    expenses: { rent: 17000, utilities: 4000, food: 8000, transport: 3500, insurance: 1500, existingLoans: 0, children: 0, other: 4000 },
    savings: { totalSavings: 900000 },
    property: { targetPrice: 5500000, loanTermYears: 30 },
    parentalLeave: { enabled: true, parent: 2, durationMonths: 36 },
  });

  it('to, co zbyde během rodičovské, sedí s časovou osou', () => {
    // Karta rodičovské tvrdila „zbyde nejméně 9 253 Kč" o rodině, které
    // časová osa hned vedle počítala 1 253 Kč. Obojí bylo aritmeticky
    // správně, jenže jedno z těch čísel mluvilo o rodičovské bez dítěte.
    const state = par();
    const leave = evaluateParentalLeave(state)!;
    const tl = wealthTimeline(state, { childOffsetMonths: 12, allocations: calculateDefaultAllocations(state) });
    // Měsíc 24 padne doprostřed rodičovské, do fáze rodičovského příspěvku.
    const naOse = tl.points.find((p) => p.month === 24)!.flow;
    expect(Math.round(leave.worstMonthlyDisposable)).toBe(Math.round(naOse));
  });

  it('náklad na dítě je ten z tabulky ČSÚ, ne odhad', () => {
    const state = par();
    const leave = evaluateParentalLeave(state)!;
    // Nejhorší měsíc je ve fázi rodičovského příspěvku: příjem domácnosti
    // bez mzdy pečujícího rodiče, plus dávka, minus výdaje po koupi
    // a minus 8 000 Kč na dítě do tří let.
    const rodicovska = leave.phases.find((p) => p.key === 'rodicovska')!;
    const rucne = leave.incomeNow - leave.lostSalary + rodicovska.monthlyBenefit
      - expensesAfterPurchase(state) - 8000;
    expect(Math.round(leave.worstMonthlyDisposable)).toBe(Math.round(rucne));
  });
});

describe('termín dítěte mění dopad rodičovské', () => {
  // Pár, který na akontaci zatím nedosáhne: do koupě bydlí v nájmu.
  const par = (childInMonths: number): WizardState => makeState({
    mode: 'couple',
    goals: ['property', 'child'],
    income: { person1NetMonthly: 48000, person2NetMonthly: 36000 },
    expenses: { rent: 18000, existingLoans: 0, insurance: 1500, food: 8000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 400000 },
    property: { targetPrice: 6000000, mortgageRate: 0.048, loanTermYears: 30 },
    childInMonths,
    parentalLeave: { enabled: true, parent: 2, durationMonths: 36 },
  });

  it('čím později dítě, tím větší rezerva na volno', () => {
    // Do příchodu dítěte se spoří, takže výpadek příjmu je z čeho krýt.
    // Dokud se termín držel jen v obrazovce, věta u cíle se posunem
    // puntíku vůbec nezměnila.
    const brzy = evaluateParentalLeave(par(6))!;
    const pozdeji = evaluateParentalLeave(par(60))!;
    expect(pozdeji.reserveAfter).toBeGreaterThan(brzy.reserveAfter);
    expect(pozdeji.reserveLeftAfterLeave).toBeGreaterThan(brzy.reserveLeftAfterLeave);
  });

  it('dítě před koupí znamená nájem, po koupi splátku', () => {
    // Rozhoduje to o výdajích během volna, tedy i o tom, jestli schodek vůbec
    // nastane. Splátka bývá výrazně vyšší než nájem.
    const predKoupi = evaluateParentalLeave(par(6))!;
    const poKoupi = evaluateParentalLeave(par(120))!;
    expect(poKoupi.worstMonthlyDisposable).toBeLessThan(predKoupi.worstMonthlyDisposable);
  });

  it('bez zadaného termínu platí rok', () => {
    const bezTerminu = { ...par(12) };
    delete bezTerminu.childInMonths;
    expect(evaluateParentalLeave(bezTerminu)!.reserveAfter)
      .toBe(evaluateParentalLeave(par(12))!.reserveAfter);
  });
});
