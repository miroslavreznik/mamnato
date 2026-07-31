import { describe, it, expect } from 'vitest';
import { savingsProjection, investmentComparison, retirementProjection, retirementStartingCapital, goalProgress, fourPercentTarget, yearOfReachingTarget, yearsUntilRetirement } from '../../src/engine/savings';
import { necessaryMonthlyExpenses } from '../../src/engine/cashflow';
import { effectiveDownPayment, necessaryExpensesAfterPurchase } from '../../src/engine/mortgage';
import type { CustomGoal } from '../../src/types';
import type { WizardState } from '../../src/types';

describe('yearsUntilRetirement', () => {
  it('is 65 minus age, at least 1', () => {
    expect(yearsUntilRetirement(35)).toBe(30);
    expect(yearsUntilRetirement(64)).toBe(1);
    expect(yearsUntilRetirement(70)).toBe(1); // never below 1
  });
  it('falls back to 30 when age is unknown', () => {
    expect(yearsUntilRetirement(undefined)).toBe(30);
    expect(yearsUntilRetirement(0)).toBe(30);
  });
});

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: { person1NetMonthly: 36000 },
    expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 6000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 500000 },
    goals: ['property'],
    property: { targetPrice: 5500000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('savingsProjection', () => {
  it('starts at current savings and grows linearly', () => {
    const state = makeState();
    const projection = savingsProjection(state, 12);
    expect(projection).toHaveLength(13); // 0..12
    expect(projection[0].savings).toBe(500000);
    expect(projection[12].savings).toBe(500000 + 7000 * 12);
  });

  it('decreases when disposable is negative', () => {
    const state = makeState({ income: { person1NetMonthly: 20000 } });
    const projection = savingsProjection(state, 6);
    expect(projection[6].savings).toBeLessThan(projection[0].savings);
  });
});

describe('investmentComparison', () => {
  it('returns correct number of data points', () => {
    const data = investmentComparison(makeState(), 0.03, 0.07, 0.03, 30);
    expect(data).toHaveLength(31); // years 0..30
    expect(data[0].year).toBe(0);
    expect(data[30].year).toBe(30);
  });

  it('property net worth starts at savings minus loan gap', () => {
    const state = makeState();
    const data = investmentComparison(state, 0.03, 0.07, 0.03, 30);
    // Year 0: property value = 5500000, remaining loan = 5000000
    // net worth = 5500000 - 5000000 = 500000
    expect(data[0].propertyNetWorth).toBe(500000);
  });

  it('všechny tři varianty startují na stejné částce', () => {
    // Bez společného startu by se čáry nedaly porovnávat: vlastník dá akontaci
    // do nemovitosti, nájemník ji investuje, třetí ji nechá ležet.
    const data = investmentComparison(makeState(), 0.03, 0.07, 0.03, 30);
    expect(data[0].rentInvestNetWorth).toBe(500000);
    expect(data[0].rentNoInvestNetWorth).toBe(500000);
    expect(data[0].propertyNetWorth).toBe(500000);
  });

  it('kdo rozdíl neinvestuje, tomu jmění neroste', () => {
    const data = investmentComparison(makeState(), 0.03, 0.07, 0.03, 30);
    expect(data[30].rentNoInvestNetWorth).toBe(data[0].rentNoInvestNetWorth);
  });

  it('náklady na vlastnictví se vlastníkovi počítají', () => {
    // Bez nich by srovnání nadržovalo koupi: nájemník platí celý nájem,
    // ale vlastníkovi by fond oprav, pojištění a daň nikdo neúčtoval.
    const withCosts = investmentComparison(makeState({
      property: { targetPrice: 5500000, mortgageRate: 0.05, loanTermYears: 30, ownershipCosts: 8000 },
    }), 0.03, 0.07, 0.03, 30);
    const withoutCosts = investmentComparison(makeState({
      property: { targetPrice: 5500000, mortgageRate: 0.05, loanTermYears: 30, ownershipCosts: 0 },
    }), 0.03, 0.07, 0.03, 30);
    // Vyšší náklady na vlastnictví → nájemník investuje víc.
    expect(withCosts[30].rentInvestNetWorth).toBeGreaterThan(withoutCosts[30].rentInvestNetWorth);
  });

  it('po splacení hypotéky začne spořit vlastník', () => {
    // Kratší hypotéka než horizont: posledních 15 let už vlastník splátku
    // neplatí, takže mu přebytek roste. Dřív se kvůli reziduu z plovoucí
    // čárky „splácelo" i po splacení a vlastníkovi nepřibývalo nic.
    const short = makeState({
      property: { targetPrice: 5500000, mortgageRate: 0.05, loanTermYears: 15, ownershipCosts: 4000 },
    });
    const data = investmentComparison(short, 0.03, 0.07, 0.03, 30);
    const propertyOnly = 5500000 * Math.pow(1.03, 30);
    expect(data[30].propertyNetWorth).toBeGreaterThan(propertyOnly);
  });

  it('property net worth grows over time', () => {
    const data = investmentComparison(makeState(), 0.03, 0.07, 0.03, 30);
    expect(data[30].propertyNetWorth).toBeGreaterThan(data[0].propertyNetWorth);
  });
});

describe('retirementProjection', () => {
  it('returns correct number of data points', () => {
    const data = retirementProjection(5000, 30, 0.07);
    expect(data).toHaveLength(31);
  });

  it('starts at 0', () => {
    const data = retirementProjection(5000, 30, 0.07);
    expect(data[0].portfolioValue).toBe(0);
  });

  it('grows over time with positive return', () => {
    const data = retirementProjection(5000, 30, 0.07);
    expect(data[30].portfolioValue).toBeGreaterThan(5000 * 12 * 30);
  });

  it('equals total contributions at 0% return', () => {
    const data = retirementProjection(5000, 10, 0);
    // 5000 * 12 * 10 = 600000
    expect(data[10].portfolioValue).toBe(600000);
  });

  it('with inflation, real values are lower than nominal', () => {
    const nominal = retirementProjection(5000, 30, 0.07);
    const real = retirementProjection(5000, 30, 0.07, 0.03);
    expect(real[30].portfolioValue).toBeLessThan(nominal[30].portfolioValue);
    // Real should still be more than contributions (7% - 3% = ~4% real return)
    expect(real[30].portfolioValue).toBeGreaterThan(5000 * 12 * 30);
  });

  it('cash at 0% with inflation shows purchasing power loss', () => {
    const real = retirementProjection(5000, 10, 0, 0.03);
    // 0% nominal - 3% inflation = negative real return
    // Total contributions = 600000, real value should be less
    expect(real[10].portfolioValue).toBeLessThan(600000);
  });
});

describe('goalProgress', () => {
  function goal(amount: number, months: number): CustomGoal {
    return { id: 'g', name: 'g', targetAmount: amount, targetMonths: months };
  }

  it('částka stačí na termín', () => {
    // 120 000 za 12 měsíců potřebuje 10 000 měsíčně, dává se 12 000.
    const p = goalProgress(goal(120000, 12), 12000);
    expect(p.requiredMonthly).toBe(10000);
    expect(p.monthsNeeded).toBe(10);
    expect(p.achievable).toBe(true);
    expect(p.missingMonthly).toBe(0);
  });

  it('částka na termín nestačí a řekne, kolik chybí', () => {
    const p = goalProgress(goal(120000, 12), 5000);
    expect(p.achievable).toBe(false);
    expect(p.monthsNeeded).toBe(24);
    expect(p.missingMonthly).toBe(5000);
    expect(p.reachableAmount).toBe(60000);
  });

  it('nula je platná odpověď, ne chybějící údaj', () => {
    // Cíl, na který se nic nedává, se sám nenaspoří. Nesmí z toho vypadnout
    // dělení nulou ani „vyjde v termínu".
    const p = goalProgress(goal(120000, 12), 0);
    expect(p.achievable).toBe(false);
    expect(p.monthsNeeded).toBe(Infinity);
    expect(p.reachableAmount).toBe(0);
    expect(p.missingMonthly).toBe(10000);
  });

  it('cíl nezávisí na ostatních cílech ani na jejich pořadí', () => {
    // Tohle je celý rozdíl proti dřívějšímu rozdělování balíku podle pořadí:
    // částka u cíle je jeho, ať jich je vedle kolik chce.
    const a = goalProgress(goal(60000, 12), 5000);
    const b = goalProgress(goal(60000, 12), 5000);
    expect(a).toEqual(b);
    expect(a.achievable).toBe(true);
  });
});

describe('fourPercentTarget', () => {
  it('returns monthly income times 300 at default 4% rate', () => {
    expect(fourPercentTarget(30000)).toBe(30000 * 300);
    expect(fourPercentTarget(30000)).toBe((30000 * 12) / 0.04);
  });

  it('respects a custom withdrawal rate', () => {
    expect(fourPercentTarget(30000, 0.05)).toBe((30000 * 12) / 0.05);
  });

  it('returns Infinity for non-positive withdrawal rate', () => {
    expect(fourPercentTarget(30000, 0)).toBe(Infinity);
  });
});

describe('yearOfReachingTarget', () => {
  it('returns the first year the portfolio reaches the target', () => {
    const projection = retirementProjection(10000, 30, 0.07);
    const target = 1000000;
    const year = yearOfReachingTarget(projection, target);
    expect(year).not.toBeNull();
    expect(projection[year!].portfolioValue).toBeGreaterThanOrEqual(target);
    if (year! > 0) {
      expect(projection[year! - 1].portfolioValue).toBeLessThan(target);
    }
  });

  it('returns null when the target is not reached within the horizon', () => {
    const projection = retirementProjection(1000, 5, 0.02);
    expect(yearOfReachingTarget(projection, 100000000)).toBeNull();
  });
});

describe('retirementStartingCapital', () => {
  it('odečte akontaci a tříměsíční rezervu, u kupujícího podle výdajů po koupi', () => {
    // Bez toho by se tytéž peníze počítaly dvakrát: jednou jako nouzová
    // rezerva, podruhé jako investované portfolio. A rezerva se u kupujícího
    // poměřuje splátkou, ne nájmem, takže je vyšší; s dnešními výdaji tady
    // vycházel důchodový kapitál větší, než kolik doopravdy zbývá.
    const state = makeState({ goals: ['property', 'retirement'], savings: { totalSavings: 2000000 } });
    const reserve = necessaryExpensesAfterPurchase(state) * 3;
    // Celé koruny: je to částka do pole, ne mezivýsledek.
    expect(retirementStartingCapital(state))
      .toBe(Math.round(2000000 - effectiveDownPayment(state) - reserve));
    expect(reserve).toBeGreaterThan(necessaryMonthlyExpenses(state) * 3);
  });

  it('bez bydlení se akontace neodečítá', () => {
    const state = makeState({ goals: ['retirement'], savings: { totalSavings: 2000000 } });
    expect(retirementStartingCapital(state)).toBe(2000000 - necessaryMonthlyExpenses(state) * 3);
  });

  it('nikdy není záporný', () => {
    const state = makeState({ goals: ['retirement'], savings: { totalSavings: 1000 } });
    expect(retirementStartingCapital(state)).toBe(0);
  });
});

describe('retirementProjection s počátečním kapitálem', () => {
  it('počáteční kapitál se zhodnocuje od začátku', () => {
    const withStart = retirementProjection(0, 10, 0.07, undefined, 1000000);
    // Bez vkladů je to prostý složený úrok: milion při 7 % za deset let.
    expect(withStart[0].portfolioValue).toBe(1000000);
    expect(withStart[10].portfolioValue).toBeGreaterThan(1900000);
    expect(withStart[10].portfolioValue).toBeLessThan(2100000);
  });

  it('bez počátečního kapitálu se chová jako dřív', () => {
    expect(retirementProjection(5000, 10, 0.07)).toEqual(
      retirementProjection(5000, 10, 0.07, undefined, 0)
    );
  });
});
