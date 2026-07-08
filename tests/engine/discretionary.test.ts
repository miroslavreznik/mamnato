import { describe, it, expect } from 'vitest';
import {
  discretionaryGroupTotals,
  discretionaryBreakdownTotal,
  hasDiscretionaryBreakdown,
  itemKey,
} from '../../src/engine/discretionary';
import { wizardReducer, createInitialState } from '../../src/store/wizardStore';

describe('discretionary breakdown engine', () => {
  it('groups items and sums per group and total', () => {
    const breakdown = {
      [itemKey('leisure', 'dining')]: 2000,
      [itemKey('leisure', 'sport')]: 1000,
      [itemKey('travel', 'abroad')]: 3000,
    };
    const groups = discretionaryGroupTotals(breakdown);
    expect(groups.find((g) => g.key === 'leisure')?.amount).toBe(3000);
    expect(groups.find((g) => g.key === 'travel')?.amount).toBe(3000);
    expect(groups.find((g) => g.key === 'subscriptions')?.amount).toBe(0);
    expect(discretionaryBreakdownTotal(breakdown)).toBe(6000);
  });

  it('hasDiscretionaryBreakdown is false for empty/undefined/all-zero', () => {
    expect(hasDiscretionaryBreakdown(undefined)).toBe(false);
    expect(hasDiscretionaryBreakdown({})).toBe(false);
    expect(hasDiscretionaryBreakdown({ [itemKey('leisure', 'dining')]: 0 })).toBe(false);
    expect(hasDiscretionaryBreakdown({ [itemKey('leisure', 'dining')]: 500 })).toBe(true);
  });
});

describe('reducer discretionary actions', () => {
  it('UPDATE_DISCRETIONARY_ITEM keeps `other` as the sum of items', () => {
    let state = createInitialState();
    state = wizardReducer(state, { type: 'UPDATE_DISCRETIONARY_ITEM', key: itemKey('leisure', 'dining'), value: 2000 });
    expect(state.expenses.other).toBe(2000);
    state = wizardReducer(state, { type: 'UPDATE_DISCRETIONARY_ITEM', key: itemKey('travel', 'abroad'), value: 3500 });
    expect(state.expenses.other).toBe(5500);
    expect(state.expenses.discretionaryBreakdown?.[itemKey('leisure', 'dining')]).toBe(2000);
  });

  it('CLEAR_DISCRETIONARY_BREAKDOWN removes the map but leaves `other` intact', () => {
    let state = createInitialState();
    state = wizardReducer(state, { type: 'UPDATE_DISCRETIONARY_ITEM', key: itemKey('leisure', 'dining'), value: 2000 });
    state = wizardReducer(state, { type: 'CLEAR_DISCRETIONARY_BREAKDOWN' });
    expect(state.expenses.discretionaryBreakdown).toBeUndefined();
    expect(state.expenses.other).toBe(2000);
  });
});
