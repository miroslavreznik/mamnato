import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/store/wizardStore';
import { normalizeState } from '../../src/store/localStorage';
import { decodeStatePayload, encodeStatePayload } from '../../src/store/shareLink';
import { calculateAllocations, calculateDefaultAllocations } from '../../src/engine/allocation';
import { budgetAfterPurchase } from '../../src/engine/budget';
import { expenseCategories } from '../../src/engine/expenseBreakdown';
import { expensesAfterPurchase, necessaryExpensesAfterPurchase, postPurchaseRunwayMonths } from '../../src/engine/mortgage';
import { necessaryMonthlyExpenses } from '../../src/engine/cashflow';
import { investmentComparison } from '../../src/engine/savings';
import { wealthTimeline } from '../../src/engine/wealthTimeline';
import { retirementReadiness } from '../../src/engine/readiness';
import { evaluateOverall } from '../../src/engine/summary';
import { nextStep } from '../../src/engine/nextStep';
import { DEFAULTS } from '../../src/engine/defaults';
import type { WizardState } from '../../src/types';

function plan(overrides: Partial<WizardState> = {}): WizardState {
  return {
    ...createInitialState(),
    income: { person1NetMonthly: 90000 },
    savings: { totalSavings: 1500000 },
    person1Age: 40,
    goals: ['property'],
    property: { targetPrice: 4000000, mortgageRate: 0.05, loanTermYears: 5 },
    ...overrides,
  };
}

describe('energie po koupi', () => {
  it('tentýž účet patří do rozpočtu, rozpisu, rezervy i osy po doplacení hypotéky', () => {
    const without = plan();
    without.expenses.utilities = 0;
    const withEnergy = { ...without, expenses: { ...without.expenses, utilities: 6000 } };
    const a = { downPayment: 0, reserve: 0, retirement: 0, child: 0, custom: [] };
    expect(expensesAfterPurchase(withEnergy) - expensesAfterPurchase(without)).toBeCloseTo(6000);
    expect(necessaryExpensesAfterPurchase(withEnergy) - necessaryExpensesAfterPurchase(without)).toBeCloseTo(6000);
    expect(budgetAfterPurchase(withEnergy, a).disposable).toBeCloseTo(budgetAfterPurchase(without, a).disposable - 6000);
    const housing = (s: WizardState) => expenseCategories(s, true).find(c => c.key === 'housing')!.amount;
    expect(housing(withEnergy) - housing(without)).toBeCloseTo(6000);
    expect(postPurchaseRunwayMonths(withEnergy)).toBeLessThan(postPurchaseRunwayMonths(without));
    const before = wealthTimeline(without, { months: 72, allocations: a });
    const after = wealthTimeline(withEnergy, { months: 72, allocations: a });
    expect(after.purchaseMonth).toBe(0);
    expect(after.mortgagePaidOffMonth).toBe(60);
    for (const month of [1, 59, 61, 72]) {
      expect(after.points[month].flow).toBeCloseTo(before.points[month].flow - 6000);
    }
  });

  it('stejné energie u vlastníka i nájemníka nemění výhodnost investičního srovnání', () => {
    const state = plan();
    const moreEnergy = { ...state, expenses: { ...state.expenses, utilities: 9000 } };
    expect(investmentComparison(moreEnergy, 0.03, 0.07, 0.03, 8)).toEqual(investmentComparison(state, 0.03, 0.07, 0.03, 8));
  });
});

describe('požadovaná renta', () => {
  it('změna cíle mění připravenost i celkový verdikt při stejné projekci', () => {
    const state = plan({ goals: ['retirement'], retirementRates: { sp500: DEFAULTS.averageCzInflation } });
    state.savings.totalSavings = 3000000 + necessaryMonthlyExpenses(state) * 3;
    const a = { downPayment: 0, reserve: 0, retirement: 1000, child: 0, custom: [] };
    const attainable = { ...state, retirementMonthlyRent: 10000 };
    const missing = { ...state, retirementMonthlyRent: 50000 };
    expect(retirementReadiness(attainable, a).status).toBe('good');
    expect(retirementReadiness(missing, a).status).toBe('warning');
    expect(retirementReadiness(missing, a).headline).toMatch(/Do požadované renty.*chybí/);
    expect(evaluateOverall(attainable, a).verdict.answer).toBe('yes');
    expect(evaluateOverall(missing, a).verdict.answer).toBe('no_but');
    expect(nextStep(missing, a).key).toBe('retirement');
    expect(nextStep(missing, a).why).not.toContain('Plán vychází');
  });

  it('existující kapitál může přesně pokrýt cíl i bez nových vkladů', () => {
    const state = plan({ goals: ['retirement'], retirementRates: { sp500: DEFAULTS.averageCzInflation } });
    state.savings.totalSavings = 3000000 + necessaryMonthlyExpenses(state) * 3;
    const a = { downPayment: 0, reserve: 0, retirement: 0, child: 0, custom: [] };
    expect(retirementReadiness({ ...state, retirementMonthlyRent: 10000 }, a).status).toBe('good');
    expect(nextStep({ ...state, retirementMonthlyRent: 10000 }, a).key).toBe('grow');
    expect(retirementReadiness({ ...state, retirementMonthlyRent: 10001 }, a).status).toBe('warning');
    expect(retirementReadiness({ ...state, retirementMonthlyRent: 0 }, a).status).toBe('good');
  });
});

describe('uložené a sdílené měsíční odkládání', () => {
  const edited = () => plan({
    goals: ['property', 'reserve', 'retirement', 'other'],
    savings: { totalSavings: 0 },
    customGoals: [
      { id: 'auto', name: 'Auto', targetAmount: 120000, targetMonths: 24 },
      { id: 'cesta', name: 'Cesta', targetAmount: 50000, targetMonths: 12 },
    ],
    allocationOverrides: { downPayment: 5000, reserve: 2000, retirement: 0, custom: { auto: 3000, cesta: 0 } },
  });

  it('reload i sdílení zachovají všechny částky včetně explicitních nul', () => {
    const state = edited();
    for (const restored of [normalizeState(JSON.parse(JSON.stringify(state))), decodeStatePayload(encodeStatePayload(state))]) {
      expect(restored!.allocationOverrides).toEqual(state.allocationOverrides);
      expect(calculateAllocations(restored!)).toMatchObject({ downPayment: 5000, reserve: 2000, retirement: 0, custom: [3000, 0] });
    }
  });

  it('částky vlastních cílů sledují identitu i po změně pořadí a vypnutí cíle', () => {
    const state = edited();
    state.customGoals!.reverse();
    expect(calculateAllocations(state).custom).toEqual([0, 3000]);
    state.goals = ['other'];
    expect(calculateAllocations(state)).toMatchObject({ downPayment: 0, reserve: 0, retirement: 0, custom: [0, 3000] });
  });

  it('starší plán dostane výchozí návrh, poškozené částky se zahodí', () => {
    const legacy = plan();
    expect(calculateAllocations(legacy)).toEqual(calculateDefaultAllocations(legacy));
    const restored = normalizeState({ ...edited(), allocationOverrides: {
      downPayment: -1, reserve: Infinity, retirement: '5000',
      custom: { auto: NaN, cesta: 1e12, platny: 1234.5, nula: 0 },
    } })!;
    expect(restored.allocationOverrides).toEqual({ custom: { platny: 1235, nula: 0 } });
    expect(calculateAllocations(restored).downPayment).toBe(calculateDefaultAllocations(restored).downPayment);
  });

  it('výpočet osy používá uložené odkládání bez dalšího parametru', () => {
    const state = plan({ savings: { totalSavings: 700000 }, allocationOverrides: { downPayment: 5000 } });
    expect(wealthTimeline(state, { months: 60 }).purchaseMonth).toBe(20);
    expect(wealthTimeline({ ...state, allocationOverrides: { downPayment: 0 } }, { months: 60 }).purchaseMonth).toBeNull();
  });
});
