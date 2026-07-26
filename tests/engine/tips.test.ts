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

// Domácnost, které rozpočet dnes vychází, ale po koupi ne.
const tightAfterPurchase = () => makeState({
  income: { person1NetMonthly: 47000 },
  expenses: { rent: 8000, existingLoans: 0, insurance: 2500, food: 10000, transport: 6000, children: 7000, utilities: 3500, other: 3000 },
});

describe('rady pod verdiktem', () => {
  it('cíl, který nevychází, dostane vlastní radu', () => {
    // Dřív u každého s nemovitostí přepsal všechny rady scénář bydlení,
    // takže „na důchod nespoříte nic" zůstalo bez rady.
    const s = evaluateOverall(makeState(), allocs({ retirement: 0 }));
    expect(s.goals.find((g) => g.key === 'retirement')?.status).toBe('warning');
    expect(s.tips.some((t) => t.includes('Na důchod zatím nejde nic'))).toBe(true);
  });

  it('rada odpovídá tomu, co blokuje verdikt', () => {
    const s = evaluateOverall(tightAfterPurchase(), allocs({ retirement: 2000 }));
    expect(s.status).toBe('not_yet');
    expect(s.tips[0]).toMatch(/Po koupi by rozpočet nevyšel/);
  });

  it('scénář bydlení radí jen tomu, komu bydlení opravdu drhne', () => {
    // Komu cíl vychází, tomu by radil k problému, který nemá.
    const s = evaluateOverall(makeState({ goals: ['property'] }), allocs());
    const property = s.goals.find((g) => g.key === 'property');
    if (property?.status === 'good') {
      expect(s.tips.some((t) => t.includes('snížit cenu nemovitosti'))).toBe(false);
    }
  });

  it('rad není víc, než kolik jich někdo přečte', () => {
    const s = evaluateOverall(makeState({ goals: ['property', 'retirement', 'child', 'other'] }), allocs());
    expect(s.tips.length).toBeLessThanOrEqual(4);
  });

  it('u záporného rozpočtu se radí jen s rozpočtem', () => {
    const s = evaluateOverall(makeState({ income: { person1NetMonthly: 20000 } }), allocs());
    expect(s.status).toBe('fix_budget');
    expect(s.tips.every((t) => !t.includes('nemovitost'))).toBe(true);
  });
});

describe('odůvodnění verdiktu', () => {
  it('rozlišuje „dnes to nevychází" a „nevyjde to po koupi"', () => {
    // Dřív oběma případům odpovídalo „cíle se nevejdou do disponibilní
    // částky", i tomu, komu se dnes vejdou pohodlně.
    const s = evaluateOverall(tightAfterPurchase(), allocs({ retirement: 2000 }));
    expect(s.budget?.fits).toBe(true);
    expect(s.verdict.reason).toMatch(/Dnes rozpočet vychází/);
    expect(s.verdict.qualifier).toMatch(/o koupi, ne o dnešku/);
  });

  it('víc cílů skloňuje množným číslem', () => {
    // Dřív z toho vycházelo „na cíl Důchod a Vlastní cíle", dva cíle
    // v jednotném čísle.
    const s = evaluateOverall(
      makeState({
        goals: ['retirement', 'other'],
        customGoals: [{ id: 'a', name: 'Auto', targetAmount: 900000, targetMonths: 6 }],
      }),
      allocs({ retirement: 0, custom: [0] })
    );
    expect(s.goals.filter((g) => g.status === 'warning')).toHaveLength(2);
    expect(s.verdict.reason).toMatch(/Naráží to na cíle Důchod a Vlastní cíle/);
  });

  it('jeden cíl skloňuje jednotným číslem', () => {
    const s = evaluateOverall(makeState({ goals: ['retirement'] }), allocs({ retirement: 0 }));
    expect(s.verdict.reason).toMatch(/Naráží to na cíl Důchod/);
  });
});

describe('rezerva po koupi', () => {
  it('nulová rezerva po akontaci dostane vlastní radu', () => {
    // Dřív to appka řekla jen šedým číslem v dlaždici „Rezerva po koupi
    // vydrží 0,0 měs.", což je z celého přehledu ta nejrizikovější věc.
    const s = evaluateOverall(makeState({ savings: { totalSavings: 800000 } }), allocs());
    expect(s.tips.some((t) => t.includes('nezbyla rezerva na nečekané výdaje'))).toBe(true);
  });

  it('komu rezerva zbyde, tomu se o ní neradí', () => {
    const s = evaluateOverall(makeState({ savings: { totalSavings: 2000000 } }), allocs({ retirement: 5000 }));
    expect(s.tips.some((t) => t.includes('nezbyla rezerva'))).toBe(false);
  });
});
