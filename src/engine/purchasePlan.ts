import type { WizardState } from '../types';
import { monthlyIncomeAt, totalMonthlyExpenses } from './cashflow';
import {
  clampDownPayment, expensesAfterPurchase, liquidSavings, loanTermYears,
  minimumDownPayment, monthlyMortgagePayment, mortgageRate, necessaryExpensesAfterPurchase,
  ownedUtilities, ownershipCosts, plannedDownPayment, totalProjectCost,
} from './mortgage';
import { purchaseClosingCosts } from './purchaseCosts';
import { evaluateRenovation } from './renovation';
import { reserveTargetMonths } from './reserve';

export function targetMonthlySurplus(state: WizardState): number {
  return state.property.targetMonthlySurplus ?? (state.mortgageFlow === 'price' ? 5000 : 0);
}

/** Peníze pro samotnou koupi a pro první měsíce s novým bydlením. */
export function purchaseCashPlan(state: WizardState, month = 0) {
  const downPayment = plannedDownPayment(state);
  const oneOffCosts = purchaseClosingCosts(state);
  const reserveMonths = reserveTargetMonths(state);
  const reserveTarget = Math.ceil(Math.max(0, necessaryExpensesAfterPurchase(state)) * reserveMonths);
  const cashAfterClosing = liquidSavings(state) - downPayment - oneOffCosts;
  const renovation = evaluateRenovation(state);
  // Během rekonstrukce lze na bydlení vydávat víc, než kolik zbývá ze mzdy.
  // Potřebný polštář počítáme navíc k rezervě, která má zbýt po nastěhování.
  const renovationExpenses = renovation
    ? totalMonthlyExpenses(state) - state.expenses.rent - state.expenses.utilities + renovation.housingDuringRenovation
    : 0;
  let renovationBalance = 0;
  let renovationBuffer = 0;
  for (let offset = 0; renovation && offset < renovation.months; offset++) {
    renovationBalance += monthlyIncomeAt(state, month + offset) - renovationExpenses;
    renovationBuffer = Math.max(renovationBuffer, -renovationBalance);
  }
  renovationBuffer = Math.ceil(renovationBuffer);
  const cashRequired = downPayment + oneOffCosts + reserveTarget + renovationBuffer;
  const moveIn = month + (renovation?.months ?? 0);
  const stableMonth = Math.max(moveIn, state.income.parentalAllowanceRemainingMonths ?? 0);
  const monthlySurplus = monthlyIncomeAt(state, stableMonth) - expensesAfterPurchase(state);
  return {
    downPayment,
    oneOffCosts,
    reserveTarget,
    reserveMonths,
    renovationBuffer,
    cashRequired,
    cashGap: Math.max(0, cashRequired - liquidSavings(state)),
    cashAfterClosing,
    monthlySurplus,
  };
}

export interface AffordableProperty {
  price: number;
  downPayment: number;
  limiting: 'cash' | 'monthly' | 'both';
}

/** Nejvyšší cena, při které hotovost i měsíční přebytek pokryjí zvolený plán. */
export function maxAffordableProperty(state: WizardState): AffordableProperty {
  const monthlyPerCrown = monthlyMortgagePayment(1, mortgageRate(state), loanTermYears(state));
  // Rozpočet pro hledání má vydržet i po skončení již pobírané dávky.
  const income = monthlyIncomeAt(state, state.income.parentalAllowanceRemainingMonths ?? 0);
  const available = liquidSavings(state);
  const months = state.income.parentalAllowanceRemainingMonths ?? 0;
  const withoutHousing = totalMonthlyExpenses(state) - state.expenses.rent - state.expenses.utilities;
  const minSurplus = targetMonthlySurplus(state);

  const atPrice = (price: number) => {
    const candidate: WizardState = { ...state, property: { ...state.property, targetPrice: price } };
    const project = totalProjectCost(candidate);
    const paymentRoom = income - withoutHousing - ownershipCosts(candidate) - ownedUtilities(candidate) - minSurplus;
    const loanByBudget = Math.max(0, Math.floor(paymentRoom / monthlyPerCrown));
    const downPayment = Math.max(minimumDownPayment(candidate), project - loanByBudget);
    const cashPlan = purchaseCashPlan({ ...candidate, savings: {
      ...candidate.savings, downPaymentFromSavings: clampDownPayment(candidate, downPayment),
    } }, months);
    const cashFits = downPayment <= available && cashPlan.cashRequired <= available;
    const monthlyFits = paymentRoom >= 0;
    return { downPayment, cashFits, monthlyFits, needsMoreEquity: downPayment > minimumDownPayment(candidate) };
  };

  let low = 0;
  // Všechen příjem na splátku plus všechny úspory je absolutní strop.
  let high = Math.max(1, Math.floor(available + income / monthlyPerCrown) + 1);
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const check = atPrice(mid);
    if (check.cashFits && check.monthlyFits) low = mid;
    else high = mid;
  }
  const best = atPrice(low);
  const above = atPrice(low + 1);
  const limiting = !above.monthlyFits && !above.cashFits ? 'both'
    : !above.monthlyFits ? 'monthly'
      : above.needsMoreEquity ? 'both' : 'cash';
  return { price: low, downPayment: low > 0 ? best.downPayment : 0, limiting };
}
