import type { WizardState } from '../types';
import { monthlyDisposable, savingsRate, emergencyRunwayMonths } from './cashflow';
import { evaluateParentalLeave } from './parentalLeave';
import type { GoalAllocations } from './allocation';
import {
  propertyReadiness,
  reserveReadiness,
  retirementReadiness,
  childReadiness,
  customReadiness,
  leaveReadiness,
  type GoalReadiness,
} from './readiness';
import { buildVerdict, type Verdict, type OverallStatusKey } from './verdict';
import { budgetNow, budgetAfterPurchase, type BudgetView } from './budget';
import { buildTips, type Tip } from './tips';
import { purchaseCashPlan, targetMonthlySurplus } from './purchasePlan';
import { wealthTimeline, type WealthTimelineResult } from './wealthTimeline';

/**
 * Celkové vyhodnocení přehledu: verdikt, stav cílů, rozpočet a tipy.
 *
 * Tenhle soubor jen skládá dohromady výsledky ostatních modulů. Hodnocení
 * jednotlivých cílů je v `readiness.ts`, formulace odpovědi ve `verdict.ts`.
 */

// Zachováno kvůli zpětné kompatibilitě importů napříč aplikací.
export type { GoalReadiness, GoalStatus } from './readiness';
export type { Verdict, VerdictAnswer, OverallStatusKey } from './verdict';
export type { BudgetView } from './budget';
export type { Tip } from './tips';

export interface OverallSummary {
  status: OverallStatusKey;
  icon: string;
  verdict: Verdict;
  tips: Tip[];
  goals: GoalReadiness[];
  /** Rozpočet dnes. Null, když si uživatel nezvolil žádný cíl. */
  budget: BudgetView | null;
  /** Rozpočet po koupi. Null, když nemovitost mezi cíli není. */
  budgetAfter: BudgetView | null;
  purchase: (ReturnType<typeof purchaseCashPlan> & {
    purchaseMonth: number | null;
    earliestCashReadyMonth: number | null;
    downPaymentReadyMonth: number | null;
    projectedClosingCash: number | null;
    monthlySurplusAfterGoals: number;
    monthlyShortfall: number;
  }) | null;
}

const OVERALL_ICON: Record<OverallStatusKey, string> = {
  fix_budget: '⚠️',
  not_yet: '🕒',
  tight: '⚖️',
  good: '✅',
};

export function evaluateOverall(
  state: WizardState,
  allocations: GoalAllocations,
  purchaseTimeline?: WealthTimelineResult
): OverallSummary {
  const disposable = monthlyDisposable(state);
  const runway = emergencyRunwayMonths(state);
  const rate = savingsRate(state);
  const timeline = state.goals.includes('property') ? purchaseTimeline ?? wealthTimeline(state, { allocations }) : null;

  const goals: GoalReadiness[] = [];
  if (timeline) goals.push(propertyReadiness(state, allocations, timeline));
  // Rezerva hned za bydlením: je to podle vlastního slovníčku appky první věc,
  // která má být hotová, takže patří nad dlouhodobé cíle, ne pod ně.
  if (state.goals.includes('reserve')) goals.push(reserveReadiness(state, allocations));
  if (state.goals.includes('retirement')) goals.push(retirementReadiness(state, allocations));
  if (state.goals.includes('child')) goals.push(childReadiness(state, allocations));
  if (state.goals.includes('other')) goals.push(customReadiness(state, allocations));
  const leave = evaluateParentalLeave(state, timeline ?? undefined, allocations);
  const leaveRow = leaveReadiness(state, leave);
  if (leaveRow) goals.push(leaveRow); // schodek během volna → status se sám sníží (warning)

  // Rozpočet ve dvou obdobích, protože koupě ho přepne: nájem vystřídá splátka
  // a odkládání na akontaci skončí. Podrobnosti viz `budget.ts`.
  const budget = state.goals.length > 0 ? budgetNow(state, allocations) : null;
  const budgetAfter = timeline
    ? budgetAfterPurchase(state, allocations, timeline.purchaseMonth ?? timeline.earliestCashReadyMonth ?? 0)
    : null;
  const purchase = timeline && budgetAfter ? {
    ...purchaseCashPlan(state),
    purchaseMonth: timeline.purchaseMonth,
    earliestCashReadyMonth: timeline.earliestCashReadyMonth,
    downPaymentReadyMonth: timeline.earliestDownPaymentMonth,
    projectedClosingCash: timeline.purchaseCashAfterClosing,
    monthlySurplusAfterGoals: budgetAfter.surplus,
    monthlyShortfall: Math.max(0, targetMonthlySurplus(state) - budgetAfter.surplus),
  } : null;

  // Celkový status. Rady „co můžete udělat" se skládají zvlášť v `tips.ts`,
  // aby k sobě verdikt a rady seděly.
  let status: OverallStatusKey;

  if (disposable <= 0 && purchase?.purchaseMonth !== 0) {
    status = 'fix_budget';
  } else if (budget && !budget.fits) {
    status = 'not_yet';
  } else if (purchase && (purchase.purchaseMonth !== 0 || purchase.monthlyShortfall > 0)) {
    // Rozpočet dnes vychází, ale po koupi už ne. Dřív to nikdo nehlídal:
    // splátka se posuzovala jen vůči příjmu (DSTI), takže domácnost s vysokými
    // ostatními výdaji dostala zelenou, přestože by po koupi byla v mínusu.
    status = 'not_yet';
  } else {
    // Rozpočet vychází, status podle nejslabšího cíle a rezervy
    const hasWarning = goals.some((g) => g.status === 'warning');
    const hasCaution = goals.some((g) => g.status === 'caution');
    if (hasWarning) status = 'not_yet';
    else if (hasCaution || runway < 3 || rate < 0.1) status = 'tight';
    else status = 'good';
  }

  const tips = buildTips(state, status, goals, budget, budgetAfter, leave);

  // Proč je to napjaté, ne jen že je. Stejné podmínky, ze kterých se status
  // odvodil; bez nich verdikt psal o chybějícím polštáři i tomu, kdo má
  // rezervu na šest let.
  const verdict = buildVerdict(
    status, goals, state.goals.length > 0, disposable, leave, budget, budgetAfter,
    { thinReserve: runway < 3, lowSavingsRate: rate < 0.1 }, purchase
  );
  return { status, icon: OVERALL_ICON[status], verdict, tips, goals, budget, budgetAfter, purchase };
}
