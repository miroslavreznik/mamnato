import { describe, expect, it } from 'vitest';
import type { WizardState } from '../../src/types';
import { calculateAllocations } from '../../src/engine/allocation';
import { loanAmount, mortgagePayment } from '../../src/engine/mortgage';
import { maxAffordableProperty, purchaseCashPlan } from '../../src/engine/purchasePlan';
import { evaluateOverall } from '../../src/engine/summary';
import { wealthTimeline } from '../../src/engine/wealthTimeline';

function household(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'couple',
    person1Age: 37, person2Age: 37,
    income: { person1NetMonthly: 45000, person2NetMonthly: 27000 },
    expenses: { rent: 19000, existingLoans: 0, insurance: 1500, food: 11000, transport: 5000, children: 0, utilities: 5500, other: 7000 },
    savings: { totalSavings: 0 },
    goals: ['property'],
    property: { targetPrice: 6000000, mortgageRate: 0.048, loanTermYears: 30 },
    ...overrides,
  };
}

describe('plán koupě', () => {
  it('počítá stejnou splátku a rozpočet při koupi, i když vlastní vklad teprve vznikne', () => {
    const state = household();
    const allocations = calculateAllocations(state);
    const timeline = wealthTimeline(state, { allocations });
    const summary = evaluateOverall(state, allocations, timeline);
    expect(loanAmount(state)).toBe(4800000);
    expect(Math.round(mortgagePayment(state))).toBe(25184);
    expect(summary.purchase?.cashGap).toBeGreaterThan(1200000);
    expect(summary.verdict.headline).toMatch(/^Na koupi dnes chybí/);
    expect(summary.purchase?.purchaseMonth).toBe(timeline.purchaseMonth);
    const month = timeline.purchaseMonth!;
    expect(month).toBeGreaterThan(0);
    expect(timeline.points[month + 1].flowAfterGoals).toBe(11816);
    expect(Math.round(summary.budgetAfter!.surplus)).toBe(11816);
  });

  it('odečte odhad poplatků před výpočtem rezervy a odloží koupi', () => {
    const state = household({ savings: { totalSavings: 1360000 } });
    const plan = purchaseCashPlan(state);
    expect(plan.cashAfterClosing).toBe(138700);
    expect(plan.cashGap).toBeGreaterThan(0);
    const timeline = wealthTimeline(state);
    const allocations = calculateAllocations(state);
    const withoutSaving = wealthTimeline(state, { allocations: { ...allocations, downPayment: 0 } });
    expect(timeline.earliestDownPaymentMonth).toBe(0);
    expect(timeline.purchaseMonth).toBeGreaterThan(0);
    expect(withoutSaving.purchaseMonth).toBeNull();
    expect(timeline.purchaseCashAfterClosing).toBeGreaterThanOrEqual(plan.reserveTarget);
    expect(timeline.purchaseCashAfterClosing).toBe(timeline.points[timeline.purchaseMonth!].availableCash! - 1221300);
  });

  it('spočte vlastní vklad podle bankovního odhadu a investice nechá mimo hotovost', () => {
    const base = household();
    const state = household({
      property: { ...base.property, bankAppraisal: 5500000, purchaseCosts: 0 },
      savings: { totalSavings: 3000000, breakdown: { current: 100000, savingsAccount: 900000, investments: 2000000 } },
    });
    expect(loanAmount(state)).toBe(4400000);
    const plan = purchaseCashPlan(state);
    expect(plan.downPayment).toBe(1600000);
    expect(plan.cashAfterClosing).toBe(-600000);
    expect(plan.oneOffCosts).toBe(0);
    expect(plan.cashGap).toBe(600000 + plan.reserveTarget);
  });

  it('v době rekonstrukce počítá souběh bydlení a po přestěhování používá nové energie', () => {
    const base = household();
    const state = household({
      savings: { totalSavings: 2300000 },
      property: {
        ...base.property, ownedUtilities: 7500,
        renovation: { cost: 400000, months: 3, payingRentMeanwhile: true },
      },
    });
    const timeline = wealthTimeline(state, { months: 380 });
    const withoutRent = wealthTimeline({ ...state, property: { ...state.property,
      renovation: { cost: 400000, months: 3, payingRentMeanwhile: false },
    } });
    expect(timeline.purchaseMonth).toBe(0);
    expect(withoutRent.points[2].flow - timeline.points[2].flow).toBe(24500);
    expect(timeline.points[4].flow).toBe(Math.round(purchaseCashPlan(state).monthlySurplus));
    expect(timeline.mortgagePaidOffMonth).toBe(363);
  });

  it('najde nejvyšší cenu při zvolené rezervě a volném měsíčním rozpočtu', () => {
    const base = household();
    const state = household({
      income: { person1NetMonthly: 50000, person2NetMonthly: 30000 },
      expenses: { ...base.expenses, insurance: 0, food: 33000, transport: 0, existingLoans: 4000, other: 0 },
      savings: { totalSavings: 1550000 },
      property: { ...base.property, ownedUtilities: 6500, ownershipCosts: 0, mortgageRate: 0.05, purchaseCosts: 100000, targetMonthlySurplus: 10000 },
    });
    const result = maxAffordableProperty(state);
    expect(result.price).toBeGreaterThan(6000000);
    const candidate = { ...state, property: { ...state.property, targetPrice: result.price },
      savings: { ...state.savings, downPaymentFromSavings: result.downPayment } };
    const plan = purchaseCashPlan(candidate);
    expect(plan.cashGap).toBe(0);
    expect(plan.monthlySurplus).toBeGreaterThanOrEqual(10000);
    const above = purchaseCashPlan({ ...candidate, property: { ...candidate.property, targetPrice: result.price + 1 } });
    expect(above.cashGap > 0 || above.monthlySurplus < 10000).toBe(true);
  });
});
