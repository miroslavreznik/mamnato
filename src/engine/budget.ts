import type { WizardState } from '../types';
import type { GoalAllocations } from './allocation';
import { monthlyDisposable, totalMonthlyIncome } from './cashflow';
import { expensesAfterPurchase } from './mortgage';

/**
 * Měsíční rozpočet ve dvou obdobích: „dnes" a „po koupi".
 *
 * Koupě rozpočet přepne, ne jen zatíží. Nájem zmizí a místo něj přijde
 * splátka s náklady na vlastnictví; zároveň skončí odkládání na akontaci,
 * protože ta je v tu chvíli zaplacená. Jedno číslo tyhle dvě různé situace
 * popsat neumí: appka dřív ukazovala jen rozpočet „dnes" a uživatel tak
 * neviděl, co s ním koupě udělá, přestože kvůli ní celý plán počítá.
 */
export interface BudgetView {
  /** Kolik měsíčně zbývá po výdajích. */
  disposable: number;
  /** Kolik z toho ukusují cíle. */
  allocated: number;
  /** Volné peníze po výdajích i cílech. */
  surplus: number;
  /** Vejdou se cíle do disponibilní částky? */
  fits: boolean;
}

// Cíle mimo bydlení. Koupě s nimi nehýbe, spoří se dál stejně.
//
// Rezerva je mezi nimi schválně: u kupujícího se poměřuje výdaji **po** koupi,
// takže po zaplacení akontace teprve nabírá smysl, ne aby skončila.
function nonHousingGoals(a: GoalAllocations): number {
  return a.reserve + a.retirement + a.child + a.custom.reduce((s, v) => s + v, 0);
}

function view(disposable: number, allocated: number): BudgetView {
  const surplus = disposable - allocated;
  return { disposable, allocated, surplus, fits: surplus >= 0 };
}

/** Rozpočet dnes: nájem mezi výdaji, akontace mezi cíli. */
export function budgetNow(state: WizardState, allocations: GoalAllocations): BudgetView {
  return view(monthlyDisposable(state), allocations.downPayment + nonHousingGoals(allocations));
}

/**
 * Rozpočet po koupi: nájem nahradí splátka s náklady na vlastnictví.
 * Energie zůstávají, odkládání na akontaci končí.
 */
export function budgetAfterPurchase(state: WizardState, allocations: GoalAllocations): BudgetView {
  const disposable = totalMonthlyIncome(state) - expensesAfterPurchase(state);
  return view(disposable, nonHousingGoals(allocations));
}

/**
 * Omezí ruční změnu jednoho cíle na společný měsíční balík.
 *
 * Snížit částku jde vždy. Zvýšit ji jde jen o skutečně volné peníze po všech
 * ostatních cílech. Jedno pole tak nemůže přidělit stejnou korunu podruhé a
 * potichu poslat součet cílů nad to, co po výdajích zbývá.
 */
export function clampGoalAllocation(
  current: number,
  requested: number,
  budget: BudgetView
): number {
  const next = Math.max(0, Math.round(requested));
  const now = Math.max(0, Math.round(current));
  if (next <= now) return next;
  return Math.min(next, now + Math.max(0, Math.floor(budget.surplus)));
}
