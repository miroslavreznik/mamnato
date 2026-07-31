import { CHILD_COSTS_CZ } from './defaults';

/**
 * Měsíční náklad na dítě v daném věku (v letech), dle tabulky ČSÚ.
 *
 * Vysokoškolské pásmo (18–26) sem záměrně nepatří: používá se to tam, kde se
 * počítá běžný rozpočet domácnosti s dítětem, a dospělé dítě na VŠ je jiná
 * úvaha než dítě, které živíte.
 *
 * Bylo to schované jako privátní funkce v `wealthTimeline`, takže karta
 * rodičovské o nákladech na dítě nevěděla a tvrdila, kolik rodině zbyde,
 * jako by to dítě nestálo nic.
 */
export function monthlyChildCostAtAge(ageYears: number): number {
  const bracket = CHILD_COSTS_CZ.find((r) => r.to <= 18 && ageYears >= r.from && ageYears < r.to);
  return bracket?.monthlyCost ?? 0;
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
