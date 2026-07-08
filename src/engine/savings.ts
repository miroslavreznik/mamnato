import type { WizardState, CustomGoal } from '../types';
import { DEFAULTS } from './defaults';
import { monthlyDisposable, totalMonthlyIncome, totalMonthlyExpenses } from './cashflow';
import { monthlyMortgagePayment, effectiveDownPayment } from './mortgage';

export interface GoalAllocation {
  monthlyAllocation: number;
  monthsNeeded: number;
  achievable: boolean;
  remainingAfter: number;
  suggestedMonths?: number;
  achievableAmount?: number;
}

export function allocateGoals(
  goals: CustomGoal[],
  monthlyDisposableAmount: number
): GoalAllocation[] {
  let remaining = Math.max(0, monthlyDisposableAmount);
  const result: GoalAllocation[] = [];

  for (let i = 0; i < goals.length; i++) {
    const goal = goals[i];
    const requiredMonthly = goal.targetMonths > 0
      ? Math.ceil(goal.targetAmount / goal.targetMonths)
      : Infinity;

    if (remaining <= 0) {
      result.push({
        monthlyAllocation: 0,
        monthsNeeded: Infinity,
        achievable: false,
        remainingAfter: 0,
        suggestedMonths: undefined,
        achievableAmount: 0,
      });
      continue;
    }

    const allocation = Math.min(remaining, requiredMonthly);
    const monthsNeeded = allocation > 0 ? Math.ceil(goal.targetAmount / allocation) : Infinity;
    const achievable = monthsNeeded <= goal.targetMonths;
    const afterThis = Math.max(0, remaining - requiredMonthly);

    result.push({
      monthlyAllocation: allocation,
      monthsNeeded,
      achievable,
      remainingAfter: afterThis,
      suggestedMonths: !achievable && allocation > 0 ? monthsNeeded : undefined,
      achievableAmount: !achievable ? allocation * goal.targetMonths : undefined,
    });

    remaining = afterThis;
  }

  return result;
}

export interface InvestmentProjectionPoint {
  year: number;
  propertyNetWorth: number;
  sp500NetWorth: number;
  rentingCost: number;
}

export interface RetirementProjectionPoint {
  year: number;
  portfolioValue: number;
}

export function savingsProjection(
  state: WizardState,
  months: number = 120
): Array<{ month: number; savings: number }> {
  const disposable = monthlyDisposable(state);
  const initial = effectiveDownPayment(state);
  return Array.from({ length: months + 1 }, (_, i) => ({
    month: i,
    savings: initial + disposable * i,
  }));
}

export function cashFlowAfterPurchase(
  state: WizardState,
  months: number = 120
): Array<{ month: number; currentCashFlow: number; afterPurchaseCashFlow: number }> {
  const currentDisposable = monthlyDisposable(state);
  const mortgage = monthlyMortgagePayment(
    state.property.targetPrice - effectiveDownPayment(state),
    state.property.mortgageRate ?? DEFAULTS.property.mortgageRate,
    state.property.loanTermYears ?? DEFAULTS.property.loanTermYears
  );
  const ownershipCosts = state.property.ownershipCosts ?? DEFAULTS.property.ownershipCosts;
  // After purchase: remove rent + utilities, add mortgage + ownership costs
  const expensesAfter = totalMonthlyExpenses(state)
    - state.expenses.rent - state.expenses.utilities + mortgage + ownershipCosts;
  const disposableAfter = totalMonthlyIncome(state) - expensesAfter;

  // Obě řady vycházejí ze srovnatelné základny — dnešní výše úspor.
  // Když nekoupím, úspory dál rostou disponibilní částkou.
  // Když koupím, utratím akontaci a dál spořím (nižší) disponibilní částkou po koupi.
  const startSavings = state.savings.totalSavings;
  const downPayment = effectiveDownPayment(state);

  return Array.from({ length: months + 1 }, (_, i) => ({
    month: i,
    currentCashFlow: startSavings + currentDisposable * i,
    afterPurchaseCashFlow: (startSavings - downPayment) + disposableAfter * i,
  }));
}

export function investmentComparison(
  state: WizardState,
  propertyAppreciation: number = 0.03,
  sp500Return: number = 0.07,
  rentGrowth: number = 0.03,
  years: number = 30
): InvestmentProjectionPoint[] {
  const downPayment = effectiveDownPayment(state);
  const price = state.property.targetPrice;
  const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
  const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
  const loanAmount = Math.max(0, price - downPayment);
  const mortgagePayment = monthlyMortgagePayment(loanAmount, rate, term);
  const monthlyRent = state.expenses.rent + state.expenses.utilities;
  const monthlyR = rate / 12;
  const totalMonths = term * 12;

  const monthlySpReturn = sp500Return / 12;
  const result: InvestmentProjectionPoint[] = [];

  let sp500Portfolio = downPayment;
  let cumulativeRent = 0;
  let remainingLoan = loanAmount;

  for (let year = 0; year <= years; year++) {
    const propertyValue = price * Math.pow(1 + propertyAppreciation, year);
    const propertyNetWorth = propertyValue - remainingLoan;

    result.push({
      year,
      propertyNetWorth: Math.round(propertyNetWorth),
      sp500NetWorth: Math.round(sp500Portfolio),
      rentingCost: Math.round(-cumulativeRent),
    });

    // Simulate 12 months
    for (let m = 0; m < 12; m++) {
      const monthIndex = year * 12 + m;
      if (monthIndex >= years * 12) break;

      // Rent grows annually
      const currentRent = monthlyRent * Math.pow(1 + rentGrowth, year);

      // SP500: invest the difference (mortgage - rent) if positive, else deduct
      const monthlyDiff = mortgagePayment - currentRent;
      sp500Portfolio = sp500Portfolio * (1 + monthlySpReturn) + monthlyDiff;

      // Cumulative rent
      cumulativeRent += currentRent;

      // Amortize loan
      if (remainingLoan > 0 && monthIndex < totalMonths) {
        const interest = remainingLoan * monthlyR;
        const principal = mortgagePayment - interest;
        remainingLoan = Math.max(0, remainingLoan - principal);
      }
    }
  }

  return result;
}

// Cílová hodnota portfolia pro požadovanou měsíční rentu dle pravidla bezpečného výběru.
// Při 4 % ročně: portfolio × 0,04 = roční renta → portfolio = měsíční renta × 12 / 0,04 (= × 300).
export function fourPercentTarget(monthlyIncome: number, withdrawalRate: number = 0.04): number {
  if (withdrawalRate <= 0) return Infinity;
  return (monthlyIncome * 12) / withdrawalRate;
}

// První rok, kdy hodnota portfolia dosáhne cílové částky; null pokud v horizontu nedosaženo.
export function yearOfReachingTarget(
  projection: RetirementProjectionPoint[],
  target: number
): number | null {
  const point = projection.find((p) => p.portfolioValue >= target);
  return point ? point.year : null;
}

export function retirementProjection(
  monthlyContribution: number,
  years: number,
  annualReturn: number,
  inflation?: number
): RetirementProjectionPoint[] {
  // Fisher equation: realReturn = (1 + nominal) / (1 + inflation) - 1
  const effectiveReturn = inflation
    ? (1 + annualReturn) / (1 + inflation) - 1
    : annualReturn;
  const monthlyReturn = effectiveReturn / 12;
  const result: RetirementProjectionPoint[] = [];
  let portfolio = 0;

  for (let year = 0; year <= years; year++) {
    result.push({ year, portfolioValue: Math.round(portfolio) });

    for (let m = 0; m < 12; m++) {
      if (year * 12 + m >= years * 12) break;
      portfolio = portfolio * (1 + monthlyReturn) + monthlyContribution;
    }
  }

  return result;
}
