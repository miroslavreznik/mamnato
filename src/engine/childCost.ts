import type { WizardState } from '../types';
import { CHILD_COSTS_CZ } from './defaults';

/**
 * Měsíční náklad na dítě v daném věku (v letech), dle tabulky ČSÚ.
 *
 * Vysokoškolské pásmo (18–26) se počítá, jen když si ho uživatel zapne
 * (`childCosts.includeUniversity`): dospělé dítě na VŠ je jiná úvaha než
 * dítě, které živíte, a většině plánů do rozpočtu nepatří.
 *
 * Bylo to schované jako privátní funkce v `wealthTimeline`, takže karta
 * rodičovské o nákladech na dítě nevěděla a tvrdila, kolik rodině zbyde,
 * jako by to dítě nestálo nic.
 */
export function monthlyChildCostAtAge(
  ageYears: number,
  opts: { costs?: Partial<Record<string, number>>; includeUniversity?: boolean } = {}
): number {
  const maxAge = opts.includeUniversity ? 26 : 18;
  const bracket = CHILD_COSTS_CZ.find((r) => r.to <= maxAge && ageYears >= r.from && ageYears < r.to);
  if (!bracket) return 0;
  return opts.costs?.[bracket.label] ?? bracket.monthlyCost;
}

/**
 * Totéž, ale rovnou z plánu: s upravenou tabulkou nákladů a s počtem dětí.
 *
 * Tabulku i počet dětí jde přepsat v kartě „Náklady na dítě". Dokud si to
 * karta držela sama, ukazovala náklady na dvě děti a časová osa vedle ní
 * počítala jedno; obojí bylo na téže obrazovce a nešlo poznat, které z toho
 * platí pro verdikt.
 *
 * Počítá se, že děti přijdou zhruba naráz (dvojčata nebo blízcí sourozenci).
 * Rozestup by osa modelovat neuměla a předstírat přesnost, kterou nemá, je
 * horší než tohle zjednodušení; karta ho říká nahlas.
 */
export function monthlyChildCost(state: WizardState, ageYears: number): number {
  const c = state.childCosts;
  return monthlyChildCostAtAge(ageYears, { costs: c?.byAge, includeUniversity: c?.includeUniversity })
    * Math.max(1, Math.round(c?.children ?? 1));
}

export interface ChildCostResult {
  monthlyAverage: number;
  totalCost: number;
  yearlyBreakdown: Array<{ year: number; monthlyCost: number }>;
}

export function calculateChildCosts(
  numberOfChildren: number,
  horizonYears: number,
  includeUniversity: boolean,
  customCosts?: Partial<Record<string, number>>
): ChildCostResult {
  const maxAge = includeUniversity ? 26 : 18;
  const years = Math.min(horizonYears, maxAge);

  const yearlyBreakdown: Array<{ year: number; monthlyCost: number }> = [];
  let totalMonths = 0;
  let totalCost = 0;

  for (let year = 0; year < years; year++) {
    const age = year;
    const range = CHILD_COSTS_CZ.find((r) => age >= r.from && age < r.to);
    if (!range) continue;
    const cost = (customCosts?.[range.label] ?? range.monthlyCost) * numberOfChildren;
    yearlyBreakdown.push({ year, monthlyCost: cost });
    totalCost += cost * 12;
    totalMonths += 12;
  }

  const monthlyAverage = totalMonths > 0 ? Math.round(totalCost / totalMonths) : 0;

  return { monthlyAverage, totalCost, yearlyBreakdown };
}
