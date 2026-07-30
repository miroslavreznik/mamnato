import { describe, it, expect } from 'vitest';
import { downPaymentTradeoff, MIN_RESERVE_MONTHS, COMPARISON_STEP } from '../../src/engine/downPayment';
import { purchasingPowerAfter } from '../../src/engine/savings';
import { mortgagePayment, ownershipCosts, loanAmount, mortgageRate, loanTermYears, totalLoanInterest } from '../../src/engine/mortgage';
import { necessaryMonthlyExpenses } from '../../src/engine/cashflow';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'couple',
    income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
    expenses: { rent: 19000, existingLoans: 0, insurance: 1800, food: 9000, transport: 4000, children: 0, utilities: 4500, other: 5000 },
    savings: { totalSavings: 1500000, downPaymentFromSavings: 620000 },
    goals: ['property'],
    property: { targetPrice: 6200000, mortgageRate: 0.048, loanTermYears: 30 },
    person1Age: 31, person2Age: 29,
    ...overrides,
  };
}

describe('rozvaha nad akontací', () => {
  it('nezbytné výdaje po koupi vymění nájem za splátku a vlastnictví', () => {
    const state = makeState();
    const t = downPaymentTradeoff(state);
    const expected = necessaryMonthlyExpenses(state)
      - state.expenses.rent - state.expenses.utilities
      + mortgagePayment(state) + ownershipCosts(state);
    expect(t.monthlyNeedAfter).toBeCloseTo(expected, 6);
  });

  it('bezpečné maximum nechá rezervu na šest měsíců', () => {
    const t = downPaymentTradeoff(makeState());
    const zbyde = 1500000 - t.safeMax;
    expect(zbyde / t.monthlyNeedAfter).toBeCloseTo(MIN_RESERVE_MONTHS, 6);
  });

  it('u malých úspor bezpečné maximum spadne na nulu, ne pod ni', () => {
    const t = downPaymentTradeoff(makeState({ savings: { totalSavings: 50000 } }));
    expect(t.safeMax).toBe(0);
    expect(t.safePct).toBe(0);
  });

  it('dalších sto tisíc akontace sníží splátku i celkové úroky', () => {
    const state = makeState();
    const t = downPaymentTradeoff(state);
    const rate = mortgageRate(state);
    const term = loanTermYears(state);
    const loan = loanAmount(state);
    expect(t.paymentDelta).toBeGreaterThan(0);
    expect(t.interestDelta).toBeCloseTo(
      totalLoanInterest(loan, rate, term) - totalLoanInterest(loan - COMPARISON_STEP, rate, term), 6
    );
    // Identita, která to celé drží pohromadě: co se za celou dobu zaplatí
    // míň na splátkách, je ušetřená jistina plus ušetřené úroky.
    expect(t.paymentDelta * term * 12).toBeCloseTo(COMPARISON_STEP + t.interestDelta, 6);
    // Při 4,8 % na třicet let to dělá zhruba 89 000 Kč úroků ze sta tisíc.
    expect(Math.round(t.interestDelta)).toBe(88880);
  });

  it('bez zbylé rezervy se alternativa nepočítá', () => {
    const t = downPaymentTradeoff(makeState({
      savings: { totalSavings: 620000, downPaymentFromSavings: 620000 },
    }));
    expect(t.reserve).toBe(0);
    expect(t.stockValue).toBe(0);
    expect(t.interestSavedByReserve).toBe(0);
  });
});

describe('kupní síla v čase', () => {
  it('při tříprocentní inflaci ztratí koruna za třicet let asi dvě pětiny', () => {
    // Kontrola proti ručnímu výpočtu: 1,03^30 = 2,427.
    expect(purchasingPowerAfter(30)).toBeCloseTo(1 / 2.4273, 3);
  });

  it('dnes je koruna celá', () => {
    expect(purchasingPowerAfter(0)).toBe(1);
  });
});
