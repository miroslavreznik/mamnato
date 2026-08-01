import { describe, it, expect } from 'vitest';
import { calculateChildCosts, monthlyChildCost } from '../../src/engine/childCost';
import { calculateDefaultAllocations } from '../../src/engine/allocation';
import { wealthTimeline } from '../../src/engine/wealthTimeline';
import type { WizardState } from '../../src/types';

describe('calculateChildCosts', () => {
  it('calculates costs for 1 child, 18 years', () => {
    const result = calculateChildCosts(1, 18, false);
    expect(result.yearlyBreakdown).toHaveLength(18);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.monthlyAverage).toBeGreaterThan(0);
    // 0-3: 8000*3*12 = 288000, 3-6: 10000*3*12 = 360000, 6-15: 12000*9*12 = 1296000, 15-18: 14000*3*12 = 504000
    expect(result.totalCost).toBe(288000 + 360000 + 1296000 + 504000);
  });

  it('includes university when flag is set', () => {
    const without = calculateChildCosts(1, 18, false);
    const withUni = calculateChildCosts(1, 26, true);
    expect(withUni.totalCost).toBeGreaterThan(without.totalCost);
    expect(withUni.yearlyBreakdown).toHaveLength(26);
  });

  it('scales with number of children', () => {
    const one = calculateChildCosts(1, 18, false);
    const two = calculateChildCosts(2, 18, false);
    expect(two.totalCost).toBe(one.totalCost * 2);
    // monthlyAverage rounds after dividing, so allow ±1 for rounding
    expect(Math.abs(two.monthlyAverage - one.monthlyAverage * 2)).toBeLessThanOrEqual(1);
  });

  it('respects custom costs', () => {
    const result = calculateChildCosts(1, 3, false, { '0–3 roky': 5000 });
    expect(result.totalCost).toBe(5000 * 12 * 3);
  });

  it('returns zero for zero horizon', () => {
    const result = calculateChildCosts(1, 0, false);
    expect(result.totalCost).toBe(0);
    expect(result.monthlyAverage).toBe(0);
    expect(result.yearlyBreakdown).toHaveLength(0);
  });
});

describe('náklady na dítě jsou jedny pro celou appku', () => {
  const rodina = (childCosts?: WizardState['childCosts']): WizardState => ({
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'couple',
    income: { person1NetMonthly: 48000, person2NetMonthly: 36000 },
    expenses: { rent: 18000, existingLoans: 0, insurance: 1500, food: 8000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 400000 },
    goals: ['child'],
    property: { targetPrice: 6000000, mortgageRate: 0.048, loanTermYears: 30 },
    childCosts,
  });

  it('dvě děti stojí dvakrát tolik, a to i na časové ose', () => {
    // Karta si počet dětí držela sama, takže ukazovala náklady na dvě děti
    // a osa vedle ní počítala jedno.
    expect(monthlyChildCost(rodina({ children: 2 }), 1))
      .toBe(2 * monthlyChildCost(rodina(), 1));

    const jedno = wealthTimeline(rodina(), { months: 60, childOffsetMonths: 0 });
    const dve = wealthTimeline(rodina({ children: 2 }), { months: 60, childOffsetMonths: 0 });
    expect(dve.points[12].flow).toBeLessThan(jedno.points[12].flow);
  });

  it('přepsaná částka u pásma platí i pro rozpočet', () => {
    const draha = rodina({ byAge: { '0–3 roky': 20000 } });
    expect(monthlyChildCost(draha, 1)).toBe(20000);
    expect(calculateDefaultAllocations(draha).child)
      .toBeGreaterThan(calculateDefaultAllocations(rodina()).child);
  });

  it('bez zapnuté vysoké školy se po osmnáctinách neplatí nic', () => {
    expect(monthlyChildCost(rodina(), 20)).toBe(0);
    expect(monthlyChildCost(rodina({ includeUniversity: true }), 20)).toBeGreaterThan(0);
  });
});
