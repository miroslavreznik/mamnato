import { describe, it, expect } from 'vitest';
import { normalizeState } from '../../src/store/localStorage';

describe('normalizeState', () => {
  it('rejects non-state shapes', () => {
    expect(normalizeState(null)).toBeNull();
    expect(normalizeState(42)).toBeNull();
    expect(normalizeState({})).toBeNull();
    expect(normalizeState({ income: {}, expenses: {} })).toBeNull(); // no goals array
  });

  it('fills missing numeric fields with defaults instead of NaN/undefined', () => {
    const s = normalizeState({
      income: { person1NetMonthly: 40000 },
      expenses: { rent: 15000 }, // most fields missing
      goals: ['property'],
    })!;
    expect(s).not.toBeNull();
    expect(s.income.person1NetMonthly).toBe(40000);
    expect(s.expenses.rent).toBe(15000);
    // missing fields defaulted to finite numbers
    expect(Number.isFinite(s.expenses.food)).toBe(true);
    expect(Number.isFinite(s.expenses.other)).toBe(true);
    expect(Number.isFinite(s.property.targetPrice)).toBe(true);
    expect(s.version).toBe('1.0');
  });

  it('coerces stringy numbers and drops invalid ones', () => {
    const s = normalizeState({
      income: { person1NetMonthly: '38000' },
      expenses: { rent: 'abc', food: 5000 },
      goals: ['property'],
    })!;
    expect(s.income.person1NetMonthly).toBe(38000); // coerced
    expect(s.expenses.food).toBe(5000);
    expect(Number.isFinite(s.expenses.rent)).toBe(true); // 'abc' → default, not NaN
  });

  it('keeps only valid goals and normalizes custom goals', () => {
    const s = normalizeState({
      income: { person1NetMonthly: 40000 },
      expenses: { rent: 15000 },
      goals: ['property', 'garbage', 'other'],
      customGoals: [
        { id: 'a', name: 'Auto', targetAmount: 300000, targetMonths: 24 },
        { name: 'no id', targetAmount: '100000', targetMonths: 0 },
      ],
    })!;
    expect(s.goals).toEqual(['property', 'other']);
    expect(s.customGoals).toHaveLength(2);
    expect(s.customGoals![0]).toMatchObject({ id: 'a', name: 'Auto', targetAmount: 300000 });
    expect(typeof s.customGoals![1].id).toBe('string'); // generated
    expect(s.customGoals![1].targetAmount).toBe(100000); // coerced
    expect(s.customGoals![1].targetMonths).toBe(1); // min 1
  });

  it('preserves discretionary breakdown but strips non-numbers', () => {
    const s = normalizeState({
      income: { person1NetMonthly: 40000 },
      expenses: { rent: 15000, discretionaryBreakdown: { 'leisure.dining': 2000, 'leisure.sport': 'x', 'travel.abroad': 0 } },
      goals: [],
    })!;
    expect(s.expenses.discretionaryBreakdown).toEqual({ 'leisure.dining': 2000 });
  });
});
