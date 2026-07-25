import { describe, it, expect } from 'vitest';
import {
  ppmMonthly,
  leavePhases,
  evaluateParentalLeave,
  rodicovskaMonthly,
  RODICOVSKA_POOL,
  PPM_MONTHS,
} from '../../src/engine/parentalLeave';
import type { WizardState } from '../../src/types';

function coupleWithLeave(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'couple',
    income: { person1NetMonthly: 57000, person2NetMonthly: 100000 },
    expenses: { rent: 22000, existingLoans: 0, insurance: 2000, food: 12000, transport: 4000, children: 0, utilities: 6000, other: 8000 },
    savings: { totalSavings: 4800000, downPaymentFromSavings: 2510000 },
    goals: ['property', 'child'],
    property: { targetPrice: 12500000, mortgageRate: 0.053, loanTermYears: 30 },
    parentalLeave: { enabled: true, parent: 2, durationMonths: 36 },
    ...overrides,
  };
}

describe('mateřská (PPM)', () => {
  it('roste s příjmem, ale naráží na zákonný strop', () => {
    expect(ppmMonthly(39500)).toBeGreaterThan(ppmMonthly(20000));
    expect(ppmMonthly(100000)).toBeGreaterThan(ppmMonthly(57000));
    // Nad třetí redukční hranicí se k příjmu nepřihlíží, dávka se zastaví.
    expect(ppmMonthly(500000)).toBe(ppmMonthly(200000));
  });

  it('strop odpovídá redukčním hranicím 2026', () => {
    // 70 % z plně zredukovaného základu (1 633 + 60 % z pásma do 2 449
    // + 30 % z pásma do 4 897) za kalendářní den.
    const maxReduced = 1633 + (2449 - 1633) * 0.6 + (4897 - 2449) * 0.3;
    expect(ppmMonthly(1_000_000)).toBe(Math.round(maxReduced * 0.7 * 30.4));
  });

  it('bez příjmu není z čeho počítat', () => {
    expect(ppmMonthly(0)).toBe(0);
  });

  it('je výrazně vyšší než rodičovský příspěvek rozpočítaný na tři roky', () => {
    expect(ppmMonthly(100000)).toBeGreaterThan(RODICOVSKA_POOL / 36);
  });
});

describe('fáze volna', () => {
  it('rozdělí volno na mateřskou a rodičovský příspěvek', () => {
    const phases = leavePhases(coupleWithLeave());
    expect(phases).toHaveLength(2);
    expect(phases[0].key).toBe('ppm');
    expect(phases[0].months).toBe(PPM_MONTHS);
    expect(phases[0].monthlyBenefit).toBe(ppmMonthly(100000));
    expect(phases[1].key).toBe('rodicovska');
    expect(phases[1].months).toBeCloseTo(36 - PPM_MONTHS, 5);
    expect(phases[1].monthlyBenefit).toBe(rodicovskaMonthly(36, PPM_MONTHS));
  });

  it('rozpustí celý balík rodičovské do zbývajících měsíců', () => {
    const phases = leavePhases(coupleWithLeave());
    const drawn = phases[1].monthlyBenefit * phases[1].months;
    expect(drawn).toBeCloseTo(RODICOVSKA_POOL, -3);
  });

  it('velmi krátké volno je celé mateřskou', () => {
    const phases = leavePhases(coupleWithLeave({
      parentalLeave: { enabled: true, parent: 2, durationMonths: 5 },
    }));
    expect(phases).toHaveLength(1);
    expect(phases[0].key).toBe('ppm');
    expect(phases[0].months).toBe(5);
  });

  it('ručně zadaná dávka odhad vypne', () => {
    const phases = leavePhases(coupleWithLeave({
      parentalLeave: { enabled: true, parent: 2, durationMonths: 36, monthlyBenefit: 9722 },
    }));
    expect(phases).toHaveLength(1);
    expect(phases[0].monthlyBenefit).toBe(9722);
  });
});

describe('dopad volna po fázích', () => {
  it('mateřská na začátku schodek zmenší oproti plošné dávce', () => {
    const withPpm = evaluateParentalLeave(coupleWithLeave())!;
    const flat = evaluateParentalLeave(coupleWithLeave({
      parentalLeave: { enabled: true, parent: 2, durationMonths: 36, monthlyBenefit: 9722 },
    }))!;
    expect(withPpm.shortfallTotal).toBeLessThan(flat.shortfallTotal);
  });

  it('shortfallPerMonth je nejhorší měsíc, ne průměr', () => {
    const impact = evaluateParentalLeave(coupleWithLeave())!;
    const worstPhase = impact.phases.reduce((a, b) => (a.monthlyBenefit < b.monthlyBenefit ? a : b));
    // Nejhorší měsíc patří fázi s nejnižší dávkou.
    expect(worstPhase.key).toBe('rodicovska');
    expect(impact.shortfallPerMonth).toBeGreaterThan(0);
    expect(impact.shortfallTotal).toBeLessThan(impact.shortfallPerMonth * impact.durationMonths);
  });

  it('rezerva se odčerpává po fázích, ne rovnoměrně', () => {
    const impact = evaluateParentalLeave(coupleWithLeave({
      savings: { totalSavings: 2600000, downPaymentFromSavings: 2510000 },
    }))!;
    expect(impact.coversWholeLeave).toBe(false);
    expect(impact.monthsCovered).toBeGreaterThan(0);
    expect(impact.monthsCovered).toBeLessThan(impact.durationMonths);
  });
});
