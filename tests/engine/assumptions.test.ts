import { describe, it, expect } from 'vitest';
import { buildAssumptions } from '../../src/engine/assumptions';
import type { WizardState } from '../../src/types';

function base(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'couple',
    income: { person1NetMonthly: 57000, person2NetMonthly: 100000 },
    expenses: { rent: 22000, existingLoans: 0, insurance: 2000, food: 12000, transport: 4000, children: 0, utilities: 6000, other: 8000 },
    savings: { totalSavings: 4800000, downPaymentFromSavings: 2510000 },
    goals: ['property', 'child'],
    property: { targetPrice: 12500000, loanTermYears: 30, fixationYears: 3 },
    parentalLeave: { enabled: true, parent: 2, durationMonths: 36 },
    ...overrides,
  };
}

const labels = (s: WizardState) => buildAssumptions(s).map((r) => r.label);
const row = (s: WizardState, label: string) => buildAssumptions(s).find((r) => r.label === label);

describe('předpoklady výpočtu', () => {
  it('řeknou, kdo zůstane na rodičovské a o jaký příjem se přijde', () => {
    // Přesně tohle šlo dřív z reportu jen dohadovat zpětně z aritmetiky.
    const r = row(base(), 'Na rodičovské zůstane')!;
    expect(r.value).toContain('Osoba 2');
    expect(r.value).toContain('100 000'.replace(/ /g, ' '));
  });

  it('rozliší, co zadal uživatel a co appka odhadla', () => {
    const rows = buildAssumptions(base());
    expect(rows.some((r) => r.source === 'user')).toBe(true);
    expect(rows.some((r) => r.source === 'estimate')).toBe(true);
  });

  it('sazba je odhad, dokud ji uživatel nezadá', () => {
    expect(row(base(), 'Úroková sazba')!.source).toBe('estimate');
    const manual = base({ property: { targetPrice: 12500000, loanTermYears: 30, fixationYears: 3, mortgageRate: 0.031 } });
    const r = row(manual, 'Úroková sazba')!;
    expect(r.source).toBe('user');
    expect(r.value).toContain('3,1');
  });

  it('náklady na vlastnictví nesou vysvětlení, odkud se vzaly', () => {
    expect(row(base(), 'Náklady na vlastnictví')!.note).toContain('%');
    const manual = base({ property: { targetPrice: 12500000, loanTermYears: 30, ownershipCosts: 4000 } });
    expect(row(manual, 'Náklady na vlastnictví')!.source).toBe('user');
  });

  it('dávky rozepíšou po fázích, když je nezadal uživatel', () => {
    const r = row(base(), 'Dávky během rodičovské')!;
    expect(r.source).toBe('estimate');
    expect(r.value).toContain('Mateřská');
    expect(r.value).toContain('Rodičovský příspěvek');
  });

  it('ručně zadaná dávka se označí jako uživatelská', () => {
    const manual = base({ parentalLeave: { enabled: true, parent: 2, durationMonths: 36, monthlyBenefit: 9722 } });
    expect(row(manual, 'Dávky během rodičovské')!.source).toBe('user');
  });

  it('rekonstrukce se objeví jen když se rekonstruuje', () => {
    expect(labels(base())).not.toContain('Rekonstrukce');
    const withRenovation = base({
      property: { targetPrice: 10000000, loanTermYears: 30, renovation: { cost: 2500000, months: 9, payingRentMeanwhile: true } },
    });
    expect(labels(withRenovation)).toContain('Rekonstrukce');
    expect(row(withRenovation, 'Celková investice')!.value).toContain('12');
  });

  it('bez nemovitosti se hypoteční předpoklady neuvádějí', () => {
    const renter = base({ goals: ['retirement'], parentalLeave: undefined });
    expect(labels(renter)).not.toContain('Úroková sazba');
    expect(labels(renter)).toContain('Naspořeno');
  });

  it('každý odhad je vysvětlený, ne jen označený', () => {
    for (const r of buildAssumptions(base())) {
      if (r.source === 'estimate' && r.label !== 'Výše hypotéky') {
        expect(r.note, `chybí vysvětlení u „${r.label}"`).toBeTruthy();
      }
    }
  });
});
