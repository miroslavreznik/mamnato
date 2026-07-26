import { describe, it, expect } from 'vitest';
import { evaluateOverall } from '../src/engine/summary';
import { calculateDefaultAllocations } from '../src/engine/allocation';
import type { WizardState } from '../src/types';

/**
 * Věty, které appka skládá z čísel, se čtou jako věty.
 *
 * `czkPerMonth()` končí zkratkou „Kč/měs." a patří do dlaždic; ve větě za ním
 * vznikne dvojitá tečka („25 267 Kč/měs.."). Do vět patří `czkMonthly()`,
 * tedy „Kč měsíčně". Bylo to vidět u důchodu, u dítěte i v rozpočtové větě.
 */

const base = { version: '1.0', currentStep: 1, completedSteps: [] as number[] };

const states: Array<[string, WizardState]> = [
  ['jednotlivec s bydlením a důchodem', {
    ...base, mode: 'individual', person1Age: 29,
    income: { person1NetMonthly: 44000 },
    expenses: { rent: 14000, utilities: 3200, existingLoans: 0, insurance: 800, food: 6500, transport: 1500, children: 0, other: 5000 },
    savings: { totalSavings: 380000 }, goals: ['property', 'retirement'],
    property: { targetPrice: 4200000, loanTermYears: 30 },
  } as WizardState],
  ['pár s dítětem jako cílem', {
    ...base, mode: 'couple', person1Age: 33, person2Age: 31,
    income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
    expenses: { rent: 18000, utilities: 4500, existingLoans: 3500, insurance: 1800, food: 11000, transport: 4500, children: 0, other: 8000 },
    savings: { totalSavings: 1350000 }, goals: ['property', 'child', 'retirement'],
    property: { targetPrice: 7900000, loanTermYears: 30 },
  } as WizardState],
  ['rodina s napjatým rozpočtem', {
    ...base, mode: 'family', numberOfChildren: 2, person1Age: 43, person2Age: 41,
    income: { person1NetMonthly: 41000, person2NetMonthly: 29000 },
    expenses: { rent: 16000, utilities: 5500, existingLoans: 6000, insurance: 2200, food: 14000, transport: 5000, children: 7000, other: 4000 },
    savings: { totalSavings: 240000 }, goals: ['property', 'retirement'],
    property: { targetPrice: 6500000, loanTermYears: 30 },
  } as WizardState],
  ['bez cílů', {
    ...base, mode: 'individual',
    income: { person1NetMonthly: 44000 },
    expenses: { rent: 14000, utilities: 3200, existingLoans: 0, insurance: 800, food: 6500, transport: 1500, children: 0, other: 5000 },
    savings: { totalSavings: 380000 }, goals: [],
    property: { targetPrice: 0, loanTermYears: 30 },
  } as WizardState],
];

// Všechny věty, které uživatel v souhrnu přečte.
function sentences(state: WizardState): string[] {
  const s = evaluateOverall(state, calculateDefaultAllocations(state));
  return [
    s.verdict.reason,
    ...s.verdict.questions.map((q) => q.answer),
    ...s.goals.map((g) => g.headline),
    ...s.tips.map((t) => t.text),
  ];
}

describe('věty skládané z čísel', () => {
  it('nekončí dvojitou tečkou po zkratce „Kč/měs."', () => {
    const offenders = states.flatMap(([name, state]) =>
      sentences(state)
        .filter((t) => t.includes('..'))
        .map((t) => `${name}: ${t}`)
    );
    expect(offenders).toEqual([]);
  });

  it('nepoužívají zkratku „/měs." uvnitř věty', () => {
    // Do vět patří „Kč měsíčně", zkratka je pro dlaždice a tabulky.
    const offenders = states.flatMap(([name, state]) =>
      sentences(state)
        .filter((t) => t.includes('/měs.'))
        .map((t) => `${name}: ${t}`)
    );
    expect(offenders).toEqual([]);
  });

  it('nemají mezeru před tečkou ani zdvojenou mezeru', () => {
    const offenders = states.flatMap(([name, state]) =>
      sentences(state)
        .filter((t) => / \./.test(t) || /\s\s/.test(t))
        .map((t) => `${name}: ${t}`)
    );
    expect(offenders).toEqual([]);
  });
});
