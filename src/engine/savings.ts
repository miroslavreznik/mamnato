import type { WizardState, CustomGoal } from '../types';
import { DEFAULTS } from './defaults';
import { monthlyDisposable, totalMonthlyIncome } from './cashflow';
import {
  effectiveDownPayment,
  mortgageRate,
  loanTermYears,
  loanAmount,
  mortgagePayment,
  expensesAfterPurchase,
  totalProjectCost,
  ownershipCosts,
} from './mortgage';

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
  /** Hodnota nemovitosti minus zbytek úvěru plus investovaný přebytek. */
  propertyNetWorth: number;
  /** Portfolio nájemníka, který rozdíl v nákladech investuje. */
  rentInvestNetWorth: number;
  /** Jmění nájemníka, který rozdíl neinvestuje: zůstane mu jen to, co měl. */
  rentNoInvestNetWorth: number;
}

export interface RetirementProjectionPoint {
  year: number;
  portfolioValue: number;
}

/**
 * Růst úspor určených na akontaci.
 *
 * `monthly` je to, co na ni uživatel opravdu odkládá. Bez něj se počítá
 * s celou disponibilní částkou, což je teoretické maximum pro toho, kdo
 * nespoří na nic jiného; jako slíbený termín by to lhalo.
 */
export function savingsProjection(
  state: WizardState,
  months: number = 120,
  monthly?: number
): Array<{ month: number; savings: number }> {
  const perMonth = monthly ?? monthlyDisposable(state);
  const initial = effectiveDownPayment(state);
  return Array.from({ length: months + 1 }, (_, i) => ({
    month: i,
    savings: initial + perMonth * i,
  }));
}

export function cashFlowAfterPurchase(
  state: WizardState,
  months: number = 120
): Array<{ month: number; currentCashFlow: number; afterPurchaseCashFlow: number }> {
  const currentDisposable = monthlyDisposable(state);
  // After purchase: remove rent + utilities, add mortgage + ownership costs
  const disposableAfter = totalMonthlyIncome(state) - expensesAfterPurchase(state);

  // Obě řady vycházejí ze srovnatelné základny, dnešní výše úspor.
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

/**
 * Srovnání čistého jmění: koupě versus nájem.
 *
 * Všechny tři čáry jsou **čisté jmění**, aby se daly porovnávat. Dřív byla
 * třetí čára kumulativní útrata za nájem, tedy záporné číslo klesající
 * k milionům, což se na grafu o jmění nedalo číst.
 *
 * Model drží obě strany symetricky:
 *  - startují se stejnou částkou (vlastník ji dá do akontace, nájemník investuje),
 *  - každý měsíc platí vlastník splátku a náklady na vlastnictví, nájemník nájem,
 *  - kdo má ten měsíc nižší náklady, ten rozdíl investuje.
 *
 * Bez té symetrie graf zvýhodňoval vlastnictví: náklady na vlastnictví se
 * nepočítaly vůbec, a když nájem přerostl splátku, nájemníkovi se z portfolia
 * ubíralo, ale vlastníkovi se odpovídající úspora nikam nepřipisovala.
 */
export function investmentComparison(
  state: WizardState,
  propertyAppreciation: number = 0.03,
  sp500Return: number = 0.07,
  rentGrowth: number = 0.03,
  years: number = 30
): InvestmentProjectionPoint[] {
  const downPayment = effectiveDownPayment(state);
  const price = totalProjectCost(state);
  const rate = mortgageRate(state);
  const term = loanTermYears(state);
  const loan = loanAmount(state);
  const payment = mortgagePayment(state);
  const ownership = ownershipCosts(state);
  const monthlyRent = state.expenses.rent + state.expenses.utilities;

  const monthlyR = rate / 12;
  const monthlyReturn = sp500Return / 12;
  const totalMonths = term * 12;

  // Vlastník i nájemník mohou mít přebytek, podle toho, kdo zrovna platí míň.
  let ownerPortfolio = 0;
  let renterPortfolio = downPayment;
  let remainingLoan = loan;

  const result: InvestmentProjectionPoint[] = [];

  for (let year = 0; year <= years; year++) {
    const propertyValue = price * Math.pow(1 + propertyAppreciation, year);

    result.push({
      year,
      propertyNetWorth: Math.round(propertyValue - remainingLoan + ownerPortfolio),
      rentInvestNetWorth: Math.round(renterPortfolio),
      // Kdo rozdíl neinvestuje, tomu zůstane jen to, s čím začínal.
      rentNoInvestNetWorth: Math.round(downPayment),
    });

    for (let m = 0; m < 12; m++) {
      const monthIndex = year * 12 + m;
      if (monthIndex >= years * 12) break;
      // Splaceno se pozná podle počtu měsíců, ne podle zůstatku: po poslední
      // splátce zbývá kvůli plovoucí čárce pár miliardtin koruny, takže
      // podmínka „zůstatek > 0" by platila napořád a vlastník by splácel
      // i po splacení hypotéky.
      const repaid = monthIndex >= totalMonths;
      if (repaid) remainingLoan = 0;

      // Nájem i náklady na vlastnictví rostou stejně: obojí je běžný výdaj
      // na bydlení. Kdyby rostl jen nájem, srovnání by nadržovalo vlastnictví.
      const inflation = Math.pow(1 + rentGrowth, year);
      const currentRent = monthlyRent * inflation;
      // Po splacení hypotéky vlastník splátku neplatí. Dřív se s ní počítalo
      // i po splacení, takže u kratší hypotéky nájemník „investoval" rozdíl
      // proti splátce, která už neexistovala.
      const currentOwnerCost = (repaid ? 0 : payment) + ownership * inflation;

      const diff = currentOwnerCost - currentRent;
      ownerPortfolio = ownerPortfolio * (1 + monthlyReturn) + (diff < 0 ? -diff : 0);
      renterPortfolio = renterPortfolio * (1 + monthlyReturn) + (diff > 0 ? diff : 0);

      if (!repaid) {
        const interest = remainingLoan * monthlyR;
        remainingLoan = Math.max(0, remainingLoan - (payment - interest));
      }
    }
  }

  return result;
}

// Počet let do důchodu z věku žadatele (min. 1 rok). Když věk není znám,
// vrací výchozích 30 let.
export function yearsUntilRetirement(age: number | undefined): number {
  if (age === undefined || age <= 0) return 30;
  return Math.max(1, Math.round(DEFAULTS.retirementAge - age));
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
