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
  mortgage: 0, retirement: 0, child: 0, custom: [], ...o,
});

describe('evaluateOverall', () => {
  it('returns fix_budget when disposable is not positive', () => {
    const state = makeState({ income: { person1NetMonthly: 20000 } });
    const s = evaluateOverall(state, allocs());
    expect(s.status).toBe('fix_budget');
    expect(s.tips.length).toBeGreaterThan(0);
  });

  it('returns not_yet when saving goals exceed disposable', () => {
    // disposable = 60000 - 29000 = 31000; saving goals over that (mortgage is NOT a saving)
    const state = makeState({ goals: ['property', 'retirement'] });
    const s = evaluateOverall(state, allocs({ mortgage: 25000, retirement: 35000 }));
    expect(s.status).toBe('not_yet');
    expect(s.budget?.fits).toBe(false);
  });

  it('excludes mortgage from the budget (it is a housing expense, not a saving)', () => {
    const state = makeState({ goals: ['property', 'retirement'] });
    const s = evaluateOverall(state, allocs({ mortgage: 25000, retirement: 5000 }));
    // allocated = retirement only = 5000, not 30000
    expect(s.budget?.allocated).toBe(5000);
  });

  it('produces a per-goal readiness entry for each active goal', () => {
    const state = makeState({ goals: ['property', 'retirement'] });
    const s = evaluateOverall(state, allocs({ mortgage: 10000, retirement: 5000 }));
    expect(s.goals.map((g) => g.key).sort()).toEqual(['property', 'retirement']);
  });

  it('budget surplus is disposable minus saving allocations', () => {
    const state = makeState({ goals: ['retirement'] });
    const s = evaluateOverall(state, allocs({ retirement: 10000 }));
    // disposable = 31000, allocated = 10000 → surplus 21000
    expect(s.budget?.surplus).toBe(21000);
    expect(s.budget?.fits).toBe(true);
  });

  it('has no budget block when there are no saving goals', () => {
    // property alone → affordability judged separately, no saving budget
    const state = makeState({ goals: ['property'] });
    const s = evaluateOverall(state, allocs({ mortgage: 20000 }));
    expect(s.budget).toBeNull();
  });

  it('gives actionable tips even to non-property users with a comfortable budget', () => {
    const state = makeState({ goals: ['retirement'], income: { person1NetMonthly: 90000 } });
    const s = evaluateOverall(state, allocs({ retirement: 8000 }));
    expect(['good', 'tight']).toContain(s.status);
    expect(s.tips.length).toBeGreaterThan(0);
  });

  it('flags a modest retirement contribution as caution, not automatically good', () => {
    const state = makeState({ goals: ['retirement'], person1Age: 55 });
    const s = evaluateOverall(state, allocs({ retirement: 1000 }));
    expect(s.goals.find((g) => g.key === 'retirement')?.status).toBe('caution');
  });

  it('adds a parental-leave readiness row and downgrades the verdict when leave goes negative', () => {
    const state = makeState({
      mode: 'couple',
      goals: ['property', 'child'],
      income: { person1NetMonthly: 45000, person2NetMonthly: 30000 },
      property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
      parentalLeave: { enabled: true, parent: 1, durationMonths: 36, monthlyBenefit: 5000 },
    });
    const s = evaluateOverall(state, allocs({ mortgage: 26000 }));
    const leave = s.goals.find((g) => g.key === 'leave');
    expect(leave?.status).toBe('warning');
    expect(s.status).not.toBe('good');
  });
});
