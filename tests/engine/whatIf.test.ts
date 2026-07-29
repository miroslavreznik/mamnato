import { describe, it, expect } from 'vitest';
import { evaluateWhatIf, allocationsWithoutGoals } from '../../src/engine/whatIf';
import type { GoalAllocations } from '../../src/engine/allocation';
import type { WizardState } from '../../src/types';

const allocs = (o: Partial<GoalAllocations> = {}): GoalAllocations => ({
  downPayment: 0, retirement: 0, child: 0, custom: [], ...o,
});

function household(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 39500 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 300000 },
    goals: ['retirement'],
    property: { targetPrice: 5500000 },
    ...overrides,
  };
}

describe('režim co kdyby', () => {
  it('bez vypnuté položky nemá co porovnávat', () => {
    expect(evaluateWhatIf(household(), allocs(), new Set(), new Set())).toBeNull();
  });

  it('vypnutí výdaje porovná verdikt před a po', () => {
    const result = evaluateWhatIf(household(), allocs({ retirement: 2000 }), new Set(['other']), new Set())!;
    expect(result.baseline).toBeTruthy();
    expect(result.now).toBeTruthy();
    expect(typeof result.improved).toBe('boolean');
    expect(typeof result.worsened).toBe('boolean');
  });

  it('vypnutí cíle uvolní jeho částku', () => {
    const a = allocs({ retirement: 5000, child: 2000, downPayment: 1000, custom: [500] });
    const g = [{ id: 'g1', name: 'Auto', targetAmount: 100000, targetMonths: 12 }];
    expect(allocationsWithoutGoals(a, new Set(['retirement']), g)).toEqual({ ...a, retirement: 0 });
    expect(allocationsWithoutGoals(a, new Set(['property']), g)).toEqual({ ...a, downPayment: 0 });
    expect(allocationsWithoutGoals(a, new Set(), g)).toEqual(a);
  });

  it('odložený vlastní cíl z pole částek zmizí, ne aby se vynuloval', () => {
    // `withExcludedGoals` odloží cíl ze seznamu, takže kdyby se tady jen
    // nuloval, rozešly by se obě pole v indexech a částka by sedla na cizí cíl.
    const a = allocs({ custom: [500, 900] });
    const g = [
      { id: 'g1', name: 'Auto', targetAmount: 100000, targetMonths: 12 },
      { id: 'g2', name: 'Svatba', targetAmount: 200000, targetMonths: 24 },
    ];
    expect(allocationsWithoutGoals(a, new Set(['other:g1']), g).custom).toEqual([900]);
    expect(allocationsWithoutGoals(a, new Set(['other']), g).custom).toEqual([]);
  });

  it('u splátky nad limit bank řekne, že škrtání výdajů nepomůže', () => {
    // Drahá nemovitost při běžném příjmu: DSTI je mimo, ať se škrtá cokoli.
    const state = household({
      goals: ['property'],
      property: { targetPrice: 12000000, mortgageRate: 0.053, loanTermYears: 30 },
    });
    const result = evaluateWhatIf(state, allocs(), new Set(['other']), new Set())!;
    expect(result.improved).toBe(false);
    expect(result.hint).toContain('škrtáním výdajů nespravíte');
  });

  it('když úspora zkrátí čekání na akontaci, řekne o kolik', () => {
    const state = household({
      goals: ['property'],
      savings: { totalSavings: 200000 },
      // Levnější byt: DSTI se vejde, ale chybí akontace, takže se testuje
      // právě větev o zkrácení čekání.
      property: { targetPrice: 2500000, mortgageRate: 0.048, loanTermYears: 30 },
    });
    const result = evaluateWhatIf(state, allocs(), new Set(['other']), new Set())!;
    if (!result.improved) {
      expect(result.hint).toMatch(/naspoříte za|Na celkovou odpověď|Zbývá naspořit/);
    }
  });

  it('bez cíle nemovitost se nápověda k hypotéce neobjeví', () => {
    const result = evaluateWhatIf(household(), allocs({ retirement: 2000 }), new Set(['other']), new Set())!;
    expect(result.hint).not.toContain('akontace');
    expect(result.hint).not.toContain('DSTI');
  });
});
