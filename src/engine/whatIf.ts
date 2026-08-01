import type { WizardState, CustomGoal } from '../types';
import type { GoalAllocations } from './allocation';
import { evaluateOverall, type Verdict } from './summary';
import { withExcludedExpenses, withExcludedGoals, isGoalActive } from './expenseBreakdown';
import { evaluateScenario } from './scenarios';
import { dsti, downPaymentGap } from './mortgage';
import { monthsToSaveAtAllocation } from './allocation';
import { monthlyDisposable } from './cashflow';
import { endSentence, formatMonths } from './format';

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
  excludedGoals: Set<string>,
  customGoals: CustomGoal[]
): GoalAllocations {
  return {
    downPayment: excludedGoals.has('property') ? 0 : allocations.downPayment,
    reserve: excludedGoals.has('reserve') ? 0 : allocations.reserve,
    retirement: excludedGoals.has('retirement') ? 0 : allocations.retirement,
    child: excludedGoals.has('child') ? 0 : allocations.child,
    // Odložené cíle se z pole vyhazují, ne nulují. `withExcludedGoals` je
    // vyhazuje ze stavu taky, a kdyby se tady jen nulovaly, rozešla by se
    // obě pole v indexech a částky by sedly na cizí cíle.
    custom: allocations.custom.filter((_, i) => {
      const goal = customGoals[i];
      return goal ? isGoalActive(excludedGoals, goal.id) : !excludedGoals.has('other');
    }),
  };
}

export function evaluateWhatIf(
  state: WizardState,
  allocations: GoalAllocations,
  excluded: Set<string>,
  excludedGoals: Set<string>
): WhatIfResult | null {
  if (excluded.size === 0 && excludedGoals.size === 0) return null;

  const adjusted = withExcludedGoals(withExcludedExpenses(state, excluded), excludedGoals);
  return compareScenarios(
    state, allocations,
    adjusted, allocationsWithoutGoals(allocations, excludedGoals, state.customGoals ?? [])
  );
}

/**
 * Porovnání dvou hotových scénářů.
 *
 * Vypnuté položky nejsou jediný způsob, jak se dá plánem hýbat: záložka
 * „Co kdyby" nabízí i posuvníky ceny, sazby a délky rodičovské, a ty mění
 * samotný stav, ne jen výdaje. Porovnání proto pracuje se dvěma stavy, ne
 * se seznamem toho, co se vyplo.
 */
export function compareScenarios(
  baselineState: WizardState,
  baselineAllocations: GoalAllocations,
  currentState: WizardState,
  currentAllocations: GoalAllocations
): WhatIfResult {
  const baseline = evaluateOverall(baselineState, baselineAllocations);
  const now = evaluateOverall(currentState, currentAllocations);

  const improved = RANK[now.verdict.answer] > RANK[baseline.verdict.answer];
  const worsened = RANK[now.verdict.answer] < RANK[baseline.verdict.answer];

  return {
    baseline: baseline.verdict,
    now: now.verdict,
    improved,
    worsened,
    hint: buildHint(baselineState, currentState, baselineAllocations, improved),
  };
}

function buildHint(
  state: WizardState,
  adjusted: WizardState,
  allocations: GoalAllocations,
  improved: boolean
): string {
  const generic = 'Na celkovou odpověď to zatím nestačí. Zkuste vypnout i něco dalšího.';
  if (improved || !adjusted.goals.includes('property')) return generic;

  // Splátka nad limit bank je slepá ulička: tohle uživatel škrtáním výdajů
  // nespraví a musí se to říct nahlas, ať nezkouší dál.
  if (evaluateScenario(adjusted).id === 'cannot_afford_dsti') {
    const dstiPct = Math.round(dsti(adjusted) * 100);
    return `Splátka by zabrala ${dstiPct} % čistého příjmu, což je nad tím, co banky obvykle schválí. Tohle škrtáním výdajů nespravíte: pomohla by levnější nemovitost, vyšší akontace, delší splatnost nebo vyšší příjem.`;
  }

  // Chybí akontace: verdikt se sice nehnul, ale úspora zkracuje čekání,
  // což je konkrétní a měřitelný přínos. Počítá se s tím, že ušetřené peníze
  // půjdou právě na akontaci, tedy k tomu, co na ni uživatel odkládá už teď.
  if (downPaymentGap(adjusted) > 0) {
    const freed = Math.max(0, monthlyDisposable(adjusted) - monthlyDisposable(state));
    const before = monthsToSaveAtAllocation(state, allocations.downPayment);
    const after = monthsToSaveAtAllocation(adjusted, allocations.downPayment + freed);
    return after < before
      ? endSentence(`Verdikt se zatím nezměnil, ale chybějící akontaci díky tomu naspoříte za ${formatMonths(after, true)} místo ${formatMonths(before, true)}`)
      : 'Zbývá naspořit akontaci. Na celkovou odpověď to zatím nestačí.';
  }

  return generic;
}
