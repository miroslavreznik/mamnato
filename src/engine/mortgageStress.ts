import type { WizardState } from '../types';
import { fixationYears, loanAmount, loanTermYears, mortgagePayment, mortgageRate, plannedDownPayment } from './mortgage';
import { paymentAfterRefixation } from './rateGuidance';
import { evaluateRenovation } from './renovation';
import type { WealthPoint } from './wealthTimeline';

export const REFIX_INCREASE = 0.02;
const REFIX_OBSERVATION_MONTHS = 12;

export interface MortgageStressResult {
  startMonth: number;
  months: number;
  monthlySurplus: number;
  lowestCash: number;
}

export function mortgageStress(
  state: WizardState,
  purchase: { month: number; cash: number },
  points: WealthPoint[],
  incomeLoss: number,
  lossMonths: number,
) {
  const basePayment = mortgagePayment(state);
  const refixedPayment = paymentAfterRefixation(state, mortgageRate(state) + REFIX_INCREASE);
  const refixMonth = purchase.month + fixationYears(state) * 12;
  const renovationEnd = purchase.month + (evaluateRenovation(state)?.months ?? 0);
  const payoffMonth = renovationEnd + loanTermYears(state) * 12;
  const paymentIncrease = refixedPayment == null ? 0 : refixedPayment - basePayment;
  const renovationIncrease = REFIX_INCREASE / 12
    * (loanAmount(state) + Math.max(0, state.property.targetPrice - plannedDownPayment(state))) / 2;

  function project(startMonth: number, months: number, loss: number, refixes: boolean): MortgageStressResult | null {
    const startingCash = startMonth === purchase.month ? purchase.cash : points[startMonth]?.availableCash
      ?? purchase.cash + points.slice(purchase.month + 1, startMonth + 1)
        .reduce((cash, point) => cash + point.flowAfterGoals, 0);
    const period = points.slice(startMonth + 1, startMonth + 1 + months);
    if (period.length === 0) return null;

    let cash = startingCash;
    let lowestCash = cash;
    let monthlySurplus = Infinity;
    for (const point of period) {
      const extra = !refixes || point.month > payoffMonth ? 0
        : point.month <= renovationEnd ? renovationIncrease : paymentIncrease;
      cash += point.flowAfterGoals - loss - extra;
      lowestCash = Math.min(lowestCash, cash);
      monthlySurplus = Math.min(monthlySurplus, point.flowAfterGoals - loss - extra);
    }
    return { startMonth, months: period.length, monthlySurplus, lowestCash };
  }

  return {
    refixedPayment,
    income: project(purchase.month, lossMonths, incomeLoss, false),
    refix: refixedPayment == null ? null : project(refixMonth, REFIX_OBSERVATION_MONTHS, 0, true),
    combined: refixedPayment == null ? null : project(refixMonth, lossMonths, incomeLoss, true),
  };
}
