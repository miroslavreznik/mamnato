import { describe, it, expect } from 'vitest';
import { evaluateParentalLeave } from '../../src/engine/parentalLeave';
import { evaluateOverall } from '../../src/engine/summary';
import type { GoalAllocations } from '../../src/engine/allocation';
import type { WizardState } from '../../src/types';

const allocs = (o: Partial<GoalAllocations> = {}): GoalAllocations => ({
  downPayment: 0, retirement: 0, child: 0, custom: [], ...o,
});

/**
 * Scénář z reálného použití: dva vysoké příjmy, drahá nemovitost a rodičovská,
 * na které zůstane doma ten s vyšším příjmem. Během volna vzniká měsíční
 * schodek, ale po akontaci zbývá rezerva, která ho pokryje několikrát.
 *
 * Appka na to dřív odpovídala „Zatím na to nemáte", protože verdikt viděl jen
 * to minusové číslo a rezervu ignoroval, i když ji sama o pár řádků níž
 * správně spočítala.
 */
function buyingCoupleOnLeave(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'couple',
    income: { person1NetMonthly: 57000, person2NetMonthly: 100000 },
    expenses: { rent: 22000, existingLoans: 0, insurance: 2000, food: 12000, transport: 4000, children: 0, utilities: 6000, other: 8000 },
    savings: { totalSavings: 4800000, downPaymentFromSavings: 2510000 },
    goals: ['property', 'child'],
    property: { targetPrice: 12500000, mortgageRate: 0.053, loanTermYears: 30, fixationYears: 3 },
    parentalLeave: { enabled: true, parent: 2, durationMonths: 36, monthlyBenefit: 9722 },
    ...overrides,
  };
}

describe('krytí schodku během rodičovské', () => {
  it('spočítá, co z rezervy zbyde a na kolik měsíců to potom vystačí', () => {
    const leave = evaluateParentalLeave(buyingCoupleOnLeave())!;
    expect(leave.shortfallPerMonth).toBeGreaterThan(0);
    expect(leave.coversWholeLeave).toBe(true);
    expect(leave.reserveLeftAfterLeave).toBe(leave.reserveAfter - leave.shortfallTotal);
    expect(leave.runwayMonthsAfterLeave).toBeGreaterThan(3);
  });

  it('rezerva, která nestačí na celé volno, se pozná', () => {
    const state = buyingCoupleOnLeave({
      savings: { totalSavings: 2700000, downPaymentFromSavings: 2510000 },
    });
    const leave = evaluateParentalLeave(state)!;
    expect(leave.coversWholeLeave).toBe(false);
    expect(leave.monthsCovered).toBeLessThan(leave.durationMonths);
    expect(leave.reserveLeftAfterLeave).toBe(0);
  });

  it('bez schodku je volno pokryté z definice', () => {
    const state = buyingCoupleOnLeave({
      parentalLeave: { enabled: true, parent: 1, durationMonths: 12, monthlyBenefit: 29166 },
    });
    const leave = evaluateParentalLeave(state)!;
    expect(leave.shortfallPerMonth).toBe(0);
    expect(leave.coversWholeLeave).toBe(true);
    expect(leave.monthsCovered).toBeNull();
  });
});

describe('verdikt při schodku na rodičovské', () => {
  it('pokrytý schodek neshodí verdikt na „Zatím na to nemáte"', () => {
    const s = evaluateOverall(buyingCoupleOnLeave(), allocs());
    expect(s.verdict.headline).toBe('Máte na to');
    expect(s.verdict.answer).toBe('yes_but');
    expect(s.verdict.qualifier).toContain('úspor');
    // Cíl je „pozor", ne „nevychází": funguje to, jen to stojí úspory.
    expect(s.goals.find((g) => g.key === 'leave')?.status).toBe('caution');
  });

  it('zdůvodnění uvede měsíční i celkový schodek a co zbyde', () => {
    const s = evaluateOverall(buyingCoupleOnLeave(), allocs());
    const leave = evaluateParentalLeave(buyingCoupleOnLeave())!;
    const czk = (n: number) => Math.round(n).toLocaleString('cs-CZ');
    expect(s.verdict.reason).toContain(czk(leave.shortfallPerMonth));
    expect(s.verdict.reason).toContain(czk(leave.shortfallTotal));
    expect(s.verdict.reason).toContain(czk(leave.reserveLeftAfterLeave));
  });

  it('nepokrytý schodek verdikt shodí, a řekne na kolik měsíců rezerva stačí', () => {
    const state = buyingCoupleOnLeave({
      savings: { totalSavings: 2700000, downPaymentFromSavings: 2510000 },
    });
    const s = evaluateOverall(state, allocs());
    expect(s.verdict.headline).toBe('Zatím na to nemáte');
    expect(s.verdict.reason).toMatch(/rezerva vydrží \d+ z 36 měsíců/i);
    expect(s.goals.find((g) => g.key === 'leave')?.status).toBe('warning');
  });

  it('tenká rezerva po volnu drží „pozor", ale řekne to nahlas', () => {
    // Rezerva schodek pokryje, ale skoro nic po ní nezbyde.
    // Schodek nově zahrnuje i náklad na dítě (8 000 Kč × 36 měsíců), takže
    // rezerva musí být o tolik vyšší, aby scénář zůstal ten samý.
    const state = buyingCoupleOnLeave({
      savings: { totalSavings: 3460000 + 8000 * 36, downPaymentFromSavings: 2510000 },
    });
    const leave = evaluateParentalLeave(state)!;
    expect(leave.coversWholeLeave).toBe(true);
    expect(leave.runwayMonthsAfterLeave).toBeLessThan(3);

    const s = evaluateOverall(state, allocs());
    expect(s.goals.find((g) => g.key === 'leave')?.status).toBe('caution');
    expect(s.goals.find((g) => g.key === 'leave')?.headline).toContain('na nečekané výdaje málo');
  });

  it('rada odpovídá tomu, jestli na schodek máte z čeho brát', () => {
    const covered = evaluateOverall(buyingCoupleOnLeave(), allocs());
    expect(covered.tips.some((t) => t.text.includes('dotovat z úspor'))).toBe(true);

    const state = buyingCoupleOnLeave({
      savings: { totalSavings: 2700000, downPaymentFromSavings: 2510000 },
    });
    const short = evaluateOverall(state, allocs());
    expect(short.tips.some((t) => t.text.includes('na který rezerva nestačí'))).toBe(true);
  });
});
