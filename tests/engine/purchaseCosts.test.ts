import { describe, it, expect } from 'vitest';
import { purchaseOneOffCosts, PURCHASE_COST_ITEMS } from '../../src/engine/purchaseCosts';
import type { WizardState } from '../../src/types';

function state(goals: WizardState['goals']): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 40000 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 1000000 },
    goals,
    property: { targetPrice: 5000000 },
  };
}

describe('jednorázové náklady koupě', () => {
  it('se ukazují jen tomu, kdo kupuje', () => {
    expect(purchaseOneOffCosts(state(['property']))).not.toBeNull();
    expect(purchaseOneOffCosts(state(['retirement']))).toBeNull();
  });

  it('součet odpovídá položkám a střed leží mezi krajemi', () => {
    const costs = purchaseOneOffCosts(state(['property']))!;
    expect(costs.min).toBe(PURCHASE_COST_ITEMS.reduce((s, i) => s + i.min, 0));
    expect(costs.max).toBe(PURCHASE_COST_ITEMS.reduce((s, i) => s + i.max, 0));
    expect(costs.typical).toBeGreaterThan(costs.min);
    expect(costs.typical).toBeLessThan(costs.max);
  });

  it('každá položka má rozpětí i vysvětlení', () => {
    for (const item of PURCHASE_COST_ITEMS) {
      expect(item.min).toBeGreaterThan(0);
      expect(item.max).toBeGreaterThanOrEqual(item.min);
      expect(item.note.length).toBeGreaterThan(20);
    }
  });

  it('neobsahuje zrušenou daň z nabytí nemovitosti', () => {
    const labels = PURCHASE_COST_ITEMS.map((i) => i.label.toLowerCase()).join(' ');
    expect(labels).not.toContain('nabytí');
  });
});
