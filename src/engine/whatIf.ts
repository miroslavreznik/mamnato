import type { WizardState, CustomGoal } from '../types';
import type { GoalAllocations } from './allocation';
import { evaluateOverall, type OverallSummary, type Verdict } from './summary';
import { withExcludedExpenses, withExcludedGoals, isGoalActive } from './expenseBreakdown';
import { evaluateScenario } from './scenarios';
import { dsti } from './mortgage';
import { endSentence, formatMonths } from './format';
import type { WealthTimelineResult } from './wealthTimeline';

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
  currentAllocations: GoalAllocations,
  timelines?: { baseline: WealthTimelineResult; current: WealthTimelineResult },
): WhatIfResult {
  const baseline = evaluateOverall(baselineState, baselineAllocations, timelines?.baseline);
  const now = evaluateOverall(currentState, currentAllocations, timelines?.current);

  const improved = RANK[now.verdict.answer] > RANK[baseline.verdict.answer];
  const worsened = RANK[now.verdict.answer] < RANK[baseline.verdict.answer];

  return {
    baseline: baseline.verdict,
    now: now.verdict,
    improved,
    worsened,
    hint: buildHint(currentState, baseline.purchase, now.purchase, improved),
  };
}

function buildHint(
  adjusted: WizardState,
  baseline: OverallSummary['purchase'],
  current: OverallSummary['purchase'],
  improved: boolean
): string {
  const generic = 'Na celkovou odpověď to zatím nestačí. Zkuste vypnout i něco dalšího.';
  if (improved || !adjusted.goals.includes('property')) return generic;

  // Bankovní vodítko je poměr splátek k příjmu domácnosti.
  if (evaluateScenario(adjusted).id === 'cannot_afford_dsti') {
    const dstiPct = Math.round(dsti(adjusted) * 100);
    return `Splátky by zabraly ${dstiPct} % čistého příjmu a banka může úvěr posoudit obezřetněji. Nižší běžné výdaje pomůžou vašemu rozpočtu, poměr splátek k příjmům se tím nezmění.`;
  }

  if (baseline && current && current.cashGap > 0) {
    const before = baseline.purchaseMonth ?? Infinity;
    const after = current.purchaseMonth ?? Infinity;
    return after < before
      ? endSentence(`Na koupi včetně nákladů a rezervy naspoříte za ${formatMonths(after, true)}${Number.isFinite(before) ? ` místo ${formatMonths(before, true)}` : ''}`)
      : 'Zbývá naspořit hotovost na koupi včetně nákladů a rezervy.';
  }

  return generic;
}
