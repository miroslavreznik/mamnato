import { CHILD_COSTS_CZ } from './defaults';

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
