import { describe, it, expect } from 'vitest';
import { plannedChildren, monthlyChildCost } from '../../src/engine/childCost';
import { leavePhases, ppmWeeks, rodicovskaPool, PPM_WEEKS, PPM_WEEKS_MULTIPLE, RODICOVSKA_POOL, RODICOVSKA_POOL_MULTIPLE } from '../../src/engine/parentalLeave';
import { evaluateTaxRelief, CHILD_TAX_CREDIT } from '../../src/engine/taxRelief';
import { childGoalLabel, goalsTabLabel } from '../../src/engine/goalNames';
import { childReadiness } from '../../src/engine/readiness';
import { journey } from '../../src/engine/journey';
import { calculateDefaultAllocations, type GoalAllocations } from '../../src/engine/allocation';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'couple',
    income: { person1NetMonthly: 48000, person2NetMonthly: 36000 },
    expenses: { rent: 18000, existingLoans: 0, insurance: 1500, food: 8000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 600000 },
    goals: ['child'],
    property: { targetPrice: 6000000, mortgageRate: 0.048, loanTermYears: 30 },
    person1Age: 32, person2Age: 30,
    parentalLeave: { enabled: true, parent: 2, durationMonths: 36 },
    childInMonths: 12,
    ...overrides,
  };
}
const twins = (o: Partial<WizardState> = {}) => makeState({ childCosts: { children: 2 }, ...o });
const alloc = (o: Partial<GoalAllocations> = {}): GoalAllocations =>
  ({ downPayment: 0, reserve: 0, retirement: 0, child: 0, custom: [], ...o });

describe('počet dětí platí pro celý plán', () => {
  it('výchozí je jedno dítě, nastavení platí i mimo kartu nákladů', () => {
    expect(plannedChildren(makeState())).toBe(1);
    expect(plannedChildren(twins())).toBe(2);
    // Uložený nesmysl nesmí rozhodit zbytek.
    expect(plannedChildren(makeState({ childCosts: { children: 0 } }))).toBe(1);
  });

  it('náklady se násobí počtem dětí', () => {
    expect(monthlyChildCost(twins(), 1)).toBe(monthlyChildCost(makeState(), 1) * 2);
  });

  it('dávky během volna jdou za týmž předpokladem jako náklady', () => {
    // Model počítá, že děti přijdou naráz. Dokud byl balík pevných 350 000 Kč
    // a mateřská 28 týdnů, platil plán se dvěma dětmi dvojnásobné výdaje,
    // ale příspěvek dostával na jedno.
    expect(ppmWeeks(makeState())).toBe(PPM_WEEKS);
    expect(ppmWeeks(twins())).toBe(PPM_WEEKS_MULTIPLE);
    expect(rodicovskaPool(makeState())).toBe(RODICOVSKA_POOL);
    expect(rodicovskaPool(twins())).toBe(RODICOVSKA_POOL_MULTIPLE);

    const one = leavePhases(makeState());
    const two = leavePhases(twins());
    expect(two[0].months).toBeGreaterThan(one[0].months);
    expect(two[0].label).toContain(String(PPM_WEEKS_MULTIPLE));
    // Vyšší balík na kratší zbytek volna: příspěvek je měsíčně vyšší.
    expect(two[1].monthlyBenefit).toBeGreaterThan(one[1].monthlyBenefit);
  });

  it('ručně zadaná dávka odhad dál přebíjí, i u dvou dětí', () => {
    const state = twins({ parentalLeave: { enabled: true, parent: 2, durationMonths: 36, monthlyBenefit: 20000 } });
    const phases = leavePhases(state);
    expect(phases).toHaveLength(1);
    expect(phases[0].monthlyBenefit).toBe(20000);
  });

  it('daňové zvýhodnění zná pořadí dětí, ne jen to první', () => {
    const one = evaluateTaxRelief(makeState())!;
    const two = evaluateTaxRelief(twins())!;
    const credit = (r: typeof one) => r.items.find((i) => i.key === 'child')!;
    expect(credit(one).yearly).toBe(CHILD_TAX_CREDIT[0]);
    expect(credit(two).yearly).toBe(CHILD_TAX_CREDIT[0] + CHILD_TAX_CREDIT[1]);
    expect(credit(two).label).toContain('2 děti');
  });

  it('u rodiny se plánované děti přičtou k těm, které už doma jsou', () => {
    const family = twins({ mode: 'family', numberOfChildren: 1, expenses: { ...makeState().expenses, children: 8000 } });
    const relief = evaluateTaxRelief(family)!;
    const credit = relief.items.find((i) => i.key === 'child')!;
    expect(credit.yearly).toBe(CHILD_TAX_CREDIT[0] + CHILD_TAX_CREDIT[1] + CHILD_TAX_CREDIT[2]);
    expect(relief.childCreditAlreadyClaimed).toBe(true);
    expect(relief.plannedChildren).toBe(2);
  });

  it('popisky mluví v množném čísle', () => {
    expect(childGoalLabel(makeState())).toBe('Dítě');
    expect(childGoalLabel(twins())).toBe('Děti');
    expect(goalsTabLabel(twins())).toBe('Děti');
    expect(childReadiness(twins(), alloc({ child: 20000 })).label).toBe('Děti / rodina');
    expect(childReadiness(twins(), alloc({ child: 20000 })).headline).toContain('na 2 děti');
  });

  it('puntík na časové ose se jmenuje podle počtu dětí', () => {
    const event = (s: WizardState) =>
      journey(s, { allocations: calculateDefaultAllocations(s) }).events.find((e) => e.key === 'child')!;
    expect(event(makeState()).label).toBe('Dítě');
    expect(event(twins()).label).toBe('Děti');
    expect(event(twins()).detail).toBe('Děti a rodičovská');
  });

  it('věta u cíle nemluví o odkládání, které uživatel nezadává', () => {
    // Částka je vážený průměr z tabulky nákladů, ne jeho rozhodnutí.
    const r = childReadiness(makeState(), alloc({ child: 11333 }));
    expect(r.headline).not.toContain('Odkládáte');
    expect(r.headline).toContain('v průměru');
  });
});
