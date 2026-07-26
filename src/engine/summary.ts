import type { WizardState } from '../types';
import { monthlyDisposable, savingsRate, emergencyRunwayMonths } from './cashflow';
import { evaluateScenario } from './scenarios';
import { evaluateParentalLeave } from './parentalLeave';
import type { GoalAllocations } from './allocation';
import {
  propertyReadiness,
  retirementReadiness,
  childReadiness,
  customReadiness,
  leaveReadiness,
  type GoalReadiness,
} from './readiness';
import { buildVerdict, type Verdict, type OverallStatusKey } from './verdict';
import { budgetNow, budgetAfterPurchase, type BudgetView } from './budget';
import { buildTips, type Tip } from './tips';

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
}

const OVERALL_ICON: Record<OverallStatusKey, string> = {
  fix_budget: '⚠️',
  not_yet: '🕒',
  tight: '⚖️',
  good: '✅',
};

export function evaluateOverall(state: WizardState, allocations: GoalAllocations): OverallSummary {
  const disposable = monthlyDisposable(state);
  const runway = emergencyRunwayMonths(state);
  const rate = savingsRate(state);

  const goals: GoalReadiness[] = [];
  if (state.goals.includes('property')) goals.push(propertyReadiness(state, allocations));
  if (state.goals.includes('retirement')) goals.push(retirementReadiness(state, allocations));
  if (state.goals.includes('child')) goals.push(childReadiness(allocations));
  if (state.goals.includes('other')) goals.push(customReadiness(state, allocations));
  const leaveRow = leaveReadiness(state);
  if (leaveRow) goals.push(leaveRow); // schodek během volna → status se sám sníží (warning)

  // Rozpočet ve dvou obdobích, protože koupě ho přepne: nájem vystřídá splátka
  // a odkládání na akontaci skončí. Podrobnosti viz `budget.ts`.
  const budget = state.goals.length > 0 ? budgetNow(state, allocations) : null;
  const budgetAfter = state.goals.includes('property')
    ? budgetAfterPurchase(state, allocations)
    : null;

  // Celkový status. Rady „co můžete udělat" se skládají zvlášť v `tips.ts`,
  // aby k sobě verdikt a rady seděly.
  let status: OverallStatusKey;

  if (disposable <= 0) {
    status = 'fix_budget';
  } else if (budget && !budget.fits) {
    status = 'not_yet';
  } else if (budgetAfter && !budgetAfter.fits) {
    // Rozpočet dnes vychází, ale po koupi už ne. Dřív to nikdo nehlídal:
    // splátka se posuzovala jen vůči příjmu (DSTI), takže domácnost s vysokými
    // ostatními výdaji dostala zelenou, přestože by po koupi byla v mínusu.
    status = 'not_yet';
  } else {
    // Rozpočet vychází, status podle nejslabšího cíle a rezervy
    const hasWarning = goals.some((g) => g.status === 'warning');
    const hasCaution = goals.some((g) => g.status === 'caution');
    const worstProperty = state.goals.includes('property') && evaluateScenario(state).id === 'cannot_afford_dsti';

    if (hasWarning || worstProperty) status = 'not_yet';
    else if (hasCaution || runway < 3 || rate < 0.1) status = 'tight';
    else status = 'good';
  }

  const leave = evaluateParentalLeave(state);
  const tips = buildTips(state, status, goals, budget, budgetAfter, leave);

  const verdict = buildVerdict(status, goals, state.goals.length > 0, disposable, leave, budget, budgetAfter);
  return { status, icon: OVERALL_ICON[status], verdict, tips, goals, budget, budgetAfter };
}
