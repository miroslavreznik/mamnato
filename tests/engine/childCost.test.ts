import { describe, it, expect } from 'vitest';
import { calculateChildCosts } from '../../src/engine/childCost';

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
