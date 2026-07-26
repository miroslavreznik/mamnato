import type { WizardState } from '../types';
import type { GoalAllocations } from './allocation';
import { evaluateOverall, type Verdict } from './summary';
import { withExcludedExpenses, withExcludedGoals } from './expenseBreakdown';
import { evaluateScenario } from './scenarios';
import { dsti, downPaymentGap, monthsToSaveDownPayment } from './mortgage';
import { formatMonths } from './format';

/**
 * Režim „co kdyby": co udělá vypnutí výdaje nebo cíle s odpovědí „Mám na to?".
 *
 * Porovnává verdikt beze změn s verdiktem po vypnutí. Nejde jen o čísla:
 * když se verdikt nehne, musí uživatel vědět proč, jinak zbytečně vypíná
 * další a další položky. Některé překážky (hlavně splátka vysoká vůči
 * příjmu) se totiž škrtáním výdajů spravit nedají.
 */

export interface WhatIfResult {
  baseline: Verdict;
  now: Verdict;
  improved: boolean;
  worsened: boolean;
  /** Vysvětlení, když se verdikt nezměnil. */
  hint: string;
}

// Pořadí odpovědí od nejhorší k nejlepší, aby šlo poznat zlepšení a zhoršení.
const RANK = { no: 0, no_but: 1, yes_but: 2, yes: 3 } as const;

export function allocationsWithoutGoals(
  allocations: GoalAllocations,
  excludedGoals: Set<string>
): GoalAllocations {
  return {
    mortgage: excludedGoals.has('property') ? 0 : allocations.mortgage,
    retirement: excludedGoals.has('retirement') ? 0 : allocations.retirement,
    child: excludedGoals.has('child') ? 0 : allocations.child,
    custom: excludedGoals.has('other') ? allocations.custom.map(() => 0) : allocations.custom,
  };
}

export function evaluateWhatIf(
  state: WizardState,
  allocations: GoalAllocations,
  excluded: Set<string>,
  excludedGoals: Set<string>
): WhatIfResult | null {
  if (excluded.size === 0 && excludedGoals.size === 0) return null;

  const baseline = evaluateOverall(state, allocations);
  const adjusted = withExcludedGoals(withExcludedExpenses(state, excluded), excludedGoals);
  const now = evaluateOverall(adjusted, allocationsWithoutGoals(allocations, excludedGoals));

  const improved = RANK[now.verdict.answer] > RANK[baseline.verdict.answer];
  const worsened = RANK[now.verdict.answer] < RANK[baseline.verdict.answer];

  return {
    baseline: baseline.verdict,
    now: now.verdict,
    improved,
    worsened,
    hint: buildHint(state, adjusted, improved),
  };
}

function buildHint(state: WizardState, adjusted: WizardState, improved: boolean): string {
  const generic = 'Na celkovou odpověď to zatím nestačí. Zkuste vypnout i něco dalšího.';
  if (improved || !adjusted.goals.includes('property')) return generic;

  // Splátka nad limit bank je slepá ulička: tohle uživatel škrtáním výdajů
  // nespraví a musí se to říct nahlas, ať nezkouší dál.
  if (evaluateScenario(adjusted).id === 'cannot_afford_dsti') {
    const dstiPct = Math.round(dsti(adjusted) * 100);
    return `Splátka by zabrala ${dstiPct} % čistého příjmu, což je nad tím, co banky obvykle schválí. Tohle škrtáním výdajů nespravíte: pomohla by levnější nemovitost, vyšší akontace, delší splatnost nebo vyšší příjem.`;
  }

  // Chybí akontace: verdikt se sice nehnul, ale úspora zkracuje čekání,
  // což je konkrétní a měřitelný přínos.
  if (downPaymentGap(adjusted) > 0) {
    const before = monthsToSaveDownPayment(state);
    const after = monthsToSaveDownPayment(adjusted);
    return after < before
      ? `Verdikt se zatím nezměnil, ale chybějící akontaci díky tomu naspoříte za ${formatMonths(after, true)} místo ${formatMonths(before, true)}.`
      : 'Zbývá naspořit akontaci. Na celkovou odpověď to zatím nestačí.';
  }

  return generic;
}
