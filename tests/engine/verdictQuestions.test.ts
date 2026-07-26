import { describe, it, expect } from 'vitest';
import { evaluateOverall } from '../../src/engine/summary';
import type { WizardState } from '../../src/types';
import type { GoalAllocations } from '../../src/engine/allocation';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 60000 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 1200000 },
    goals: ['property', 'retirement'],
    property: { targetPrice: 4000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

const allocs = (o: Partial<GoalAllocations> = {}): GoalAllocations => ({
  downPayment: 0, retirement: 0, child: 0, custom: [], ...o,
});

describe('verdikt jako dvě otázky', () => {
  it('s bydlením se odpověď dělí na dosažitelnost a na to, co zbyde', () => {
    const v = evaluateOverall(makeState(), allocs({ retirement: 5000 })).verdict;
    expect(v.questions.map((q) => q.question)).toEqual([
      'Dosáhnete na vlastní bydlení?',
      'Zbyde vám pak na zbytek?',
    ]);
  });

  it('bez bydlení se nic nedělí, jediná otázka je celý verdikt', () => {
    const v = evaluateOverall(makeState({ goals: ['retirement'] }), allocs({ retirement: 5000 })).verdict;
    expect(v.questions).toEqual([]);
  });

  it('každá otázka má vlastní stav, takže je vidět, která z nich brzdí', () => {
    // Na bydlení domácnost dosáhne, ale po koupi jí na ostatní cíle nezbyde.
    const state = makeState({
      income: { person1NetMonthly: 47000 },
      expenses: { rent: 8000, existingLoans: 0, insurance: 2500, food: 10000, transport: 6000, children: 7000, utilities: 3500, other: 3000 },
    });
    const v = evaluateOverall(state, allocs({ retirement: 2000 })).verdict;
    expect(v.questions[1].status).toBe('warning');
    expect(v.questions[1].answer).toMatch(/nezbylo/);
  });

  it('první otázka odpovídá ano/ne, čísla nechává cíli níž', () => {
    const v = evaluateOverall(makeState(), allocs({ retirement: 5000 })).verdict;
    expect(v.questions[0].answer).toMatch(/^(Ano|Zatím ne)/);
    expect(v.questions[0].answer).not.toMatch(/Kč/);
  });

  it('bez dalších cílů řekne rovnou, kolik po koupi zbyde volných', () => {
    const v = evaluateOverall(makeState({ goals: ['property'] }), allocs()).verdict;
    expect(v.questions[1].answer).toMatch(/Další cíle zatím nemáte zvolené/);
  });
});

describe('druhá otázka u nedosažitelného bydlení', () => {
  it('se ptá podmíněně, aby si odpovědi neodporovaly', () => {
    // „Dosáhnete? Zatím ne" a hned pod tím „Zbyde vám pak? Ano" vypadalo,
    // jako by si appka protiřečila. Druhá otázka mluví o rozpočtu po koupi,
    // ke které by takhle nedošlo.
    const state = makeState({
      goals: ['property', 'retirement'],
      income: { person1NetMonthly: 44000 },
      expenses: { rent: 14000, existingLoans: 0, insurance: 800, food: 6500, transport: 1500, children: 0, utilities: 3200, other: 5000 },
      savings: { totalSavings: 380000 },
      property: { targetPrice: 4200000, mortgageRate: 0.052, loanTermYears: 30 },
      person1Age: 29,
    });
    const v = evaluateOverall(state, allocs({ downPayment: 6500, retirement: 3000 })).verdict;
    expect(v.questions[0].status).toBe('warning');
    expect(v.questions[1].answer).toMatch(/^Kdyby na bydlení došlo: /);
  });

  it('u dosažitelného bydlení odpovídá rovnou', () => {
    const v = evaluateOverall(makeState(), allocs({ retirement: 5000 })).verdict;
    expect(v.questions[0].status).not.toBe('warning');
    expect(v.questions[1].answer).not.toMatch(/Kdyby na bydlení došlo/);
  });
});

describe('podmíněná odpověď se označí', () => {
  it('nese příznak, aby ji šlo vybarvit neutrálně', () => {
    // Zelené „v pořádku" hned pod červeným „nevychází" vypadá, jako by si
    // appka odporovala. Barvu si zaslouží jen odpověď, která opravdu platí.
    const state = makeState({
      goals: ['property', 'retirement'],
      income: { person1NetMonthly: 44000 },
      expenses: { rent: 14000, existingLoans: 0, insurance: 800, food: 6500, transport: 1500, children: 0, utilities: 3200, other: 5000 },
      savings: { totalSavings: 380000 },
      property: { targetPrice: 4200000, mortgageRate: 0.052, loanTermYears: 30 },
      person1Age: 29,
    });
    const v = evaluateOverall(state, allocs({ downPayment: 6500, retirement: 3000 })).verdict;
    expect(v.questions[1].conditional).toBe(true);
    expect(v.questions[0].conditional).toBeUndefined();
  });

  it('platná odpověď příznak nemá', () => {
    const v = evaluateOverall(makeState(), allocs({ retirement: 5000 })).verdict;
    expect(v.questions[1].conditional).toBe(false);
  });
});
