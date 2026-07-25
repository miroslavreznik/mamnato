import { describe, it, expect } from 'vitest';
import {
  firstYearInterest,
  interestDeductionSaving,
  childCreditYearly,
  evaluateTaxRelief,
  INTEREST_DEDUCTION_CAP,
  INCOME_TAX_RATE,
  CHILD_TAX_CREDIT,
} from '../../src/engine/taxRelief';
import { loanAmount, mortgageRate } from '../../src/engine/mortgage';
import type { WizardState } from '../../src/types';

function buyer(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'couple',
    income: { person1NetMonthly: 57000, person2NetMonthly: 100000 },
    expenses: { rent: 22000, existingLoans: 0, insurance: 2000, food: 12000, transport: 4000, children: 0, utilities: 6000, other: 8000 },
    savings: { totalSavings: 4800000, downPaymentFromSavings: 2510000 },
    goals: ['property'],
    property: { targetPrice: 12500000, mortgageRate: 0.053, loanTermYears: 30 },
    ...overrides,
  };
}

describe('úroky za první rok', () => {
  it('jsou nižší než jistina krát sazba, protože jistina během roku klesá', () => {
    const state = buyer();
    const naive = loanAmount(state) * mortgageRate(state);
    const actual = firstYearInterest(state);
    expect(actual).toBeLessThan(naive);
    expect(actual).toBeGreaterThan(naive * 0.97);
  });

  it('bez úvěru nejsou žádné', () => {
    const paidCash = buyer({
      savings: { totalSavings: 13000000, downPaymentFromSavings: 12500000 },
    });
    expect(firstYearInterest(paidCash)).toBe(0);
  });
});

describe('odpočet úroků', () => {
  it('je omezený zákonným limitem, ne výší úroků', () => {
    const state = buyer();
    expect(firstYearInterest(state)).toBeGreaterThan(INTEREST_DEDUCTION_CAP);
    expect(interestDeductionSaving(state)).toBe(Math.round(INTEREST_DEDUCTION_CAP * INCOME_TAX_RATE));
  });

  it('u malé hypotéky se odečtou celé úroky', () => {
    const small = buyer({
      property: { targetPrice: 2000000, mortgageRate: 0.053, loanTermYears: 30 },
      savings: { totalSavings: 1000000, downPaymentFromSavings: 400000 },
    });
    const interest = firstYearInterest(small);
    expect(interest).toBeLessThan(INTEREST_DEDUCTION_CAP);
    expect(interestDeductionSaving(small)).toBe(Math.round(interest * INCOME_TAX_RATE));
  });

  it('úspora je 15 % z odpočtu, ne celý odpočet', () => {
    // Častý omyl: odečítá se od základu daně, ne od daně samotné.
    expect(interestDeductionSaving(buyer())).toBeLessThan(INTEREST_DEDUCTION_CAP);
  });
});

describe('zvýhodnění na děti', () => {
  it('roste podle pořadí dítěte', () => {
    expect(childCreditYearly(1)).toBe(CHILD_TAX_CREDIT[0]);
    expect(childCreditYearly(2)).toBe(CHILD_TAX_CREDIT[0] + CHILD_TAX_CREDIT[1]);
    expect(childCreditYearly(3)).toBe(CHILD_TAX_CREDIT[0] + CHILD_TAX_CREDIT[1] + CHILD_TAX_CREDIT[2]);
    // Čtvrté a další dítě má stejnou sazbu jako třetí.
    expect(childCreditYearly(4) - childCreditYearly(3)).toBe(CHILD_TAX_CREDIT[2]);
  });
});

describe('přehled úlev', () => {
  it('u plánovaného dítěte počítá s jedním a neoznačuje ho za uplatněné', () => {
    const relief = evaluateTaxRelief(buyer({ goals: ['property', 'child'] }))!;
    expect(relief.items.map((i) => i.key)).toEqual(['interest', 'child']);
    expect(relief.childCreditAlreadyClaimed).toBe(false);
  });

  it('u rodiny s dětmi upozorní, že sleva už je v čisté mzdě', () => {
    const relief = evaluateTaxRelief(buyer({ mode: 'family', numberOfChildren: 2 }))!;
    expect(relief.childCreditAlreadyClaimed).toBe(true);
    expect(relief.items.find((i) => i.key === 'child')?.yearly).toBe(childCreditYearly(2));
  });

  it('bez nemovitosti a bez dětí nemá co ukázat', () => {
    expect(evaluateTaxRelief(buyer({ goals: ['retirement'] }))).toBeNull();
  });

  it('každá položka nese vysvětlení, jak vznikla', () => {
    const relief = evaluateTaxRelief(buyer({ goals: ['property', 'child'] }))!;
    for (const item of relief.items) {
      expect(item.how.length).toBeGreaterThan(40);
    }
  });

  it('měsíční součet odpovídá ročnímu', () => {
    const relief = evaluateTaxRelief(buyer({ goals: ['property', 'child'] }))!;
    expect(relief.monthly).toBe(Math.round(relief.yearly / 12));
  });
});
