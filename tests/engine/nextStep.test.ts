import { describe, it, expect } from 'vitest';
import { nextStep } from '../../src/engine/nextStep';
import { calculateDefaultAllocations, type GoalAllocations } from '../../src/engine/allocation';
import { necessaryExpensesAfterPurchase } from '../../src/engine/mortgage';
import { necessaryMonthlyExpenses } from '../../src/engine/cashflow';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'couple',
    income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
    expenses: { rent: 19000, existingLoans: 0, insurance: 1800, food: 9000, transport: 4000, children: 0, utilities: 4500, other: 5000 },
    savings: { totalSavings: 1500000 },
    goals: [],
    property: { targetPrice: 6200000, mortgageRate: 0.048, loanTermYears: 30 },
    person1Age: 31, person2Age: 29,
    ...overrides,
  };
}
const alloc = (o: Partial<GoalAllocations> = {}): GoalAllocations =>
  ({ downPayment: 0, retirement: 0, child: 0, custom: [], ...o });

// Oddělovač tisíců je úzká nezlomitelná mezera a její kód se liší podle
// verze ICU, takže se porovnávají číslice, ne řetězec.
const hasAmount = (text: string, value: number) =>
  text.replace(/[^\d]/g, '').includes(String(value));

describe('a co teď', () => {
  it('nevyrovnaný rozpočet přebije všechno ostatní', () => {
    // Spořit na cíle, když výdaje přerůstají příjem, znamená platit je dluhem.
    const state = makeState({
      goals: ['property', 'retirement'],
      income: { person1NetMonthly: 20000 },
      savings: { totalSavings: 0 },
    });
    const s = nextStep(state, calculateDefaultAllocations(state));
    expect(s.key).toBe('fix_budget');
    expect(s.action).toMatch(/Snižte výdaje/);
  });

  it('bez rezervy je na řadě rezerva, ne cíle', () => {
    const state = makeState({ goals: ['retirement'], savings: { totalSavings: 20000 } });
    const s = nextStep(state, alloc({ retirement: 5000 }));
    expect(s.key).toBe('reserve');
    // Cíl je 114 900 Kč (tři měsíce nezbytných výdajů), z toho 20 000 už je,
    // takže věta mluví o chybějících 94 900 Kč.
    expect(hasAmount(s.action, 114900)).toBe(true);
    expect(hasAmount(s.why, 94900)).toBe(true);
    expect(s.done).toBeTruthy();
  });

  it('splátka nad limitem banky má přednost před spořením na akontaci', () => {
    // Spořit na akontaci k ceně, na kterou banka nepůjčí, je práce nazmar.
    const state = makeState({
      goals: ['property'],
      income: { person1NetMonthly: 30000, person2NetMonthly: 26000 },
      savings: { totalSavings: 900000 },
      property: { targetPrice: 8000000, mortgageRate: 0.048, loanTermYears: 30 },
    });
    const s = nextStep(state, calculateDefaultAllocations(state));
    expect(s.key).toBe('payment_too_high');
    expect(s.action).toMatch(/levnější/);
    expect(s.section).toBe('bydleni');
  });

  it('chybějící akontace dostane částku i termín', () => {
    const state = makeState({ goals: ['property'], savings: { totalSavings: 500000 } });
    const s = nextStep(state, alloc({ downPayment: 10000 }));
    expect(s.key).toBe('down_payment');
    expect(s.monthly).toBe(10000);
    // Chybí 120 000 Kč, při 10 000 měsíčně to je dvanáct měsíců.
    expect(s.done).toMatch(/20\d\d/);
    // Částka je ve větě nahoře, ne ve vysvětlení: dvakrát pod sebou by to
    // bylo totéž číslo.
    expect(hasAmount(s.action, 120000)).toBe(true);
  });

  it('kdo na důchod neodkládá nic, dostane konkrétní částku', () => {
    const state = makeState({ goals: ['retirement'] });
    const s = nextStep(state, alloc({ retirement: 0 }));
    expect(s.key).toBe('retirement');
    expect(s.monthly).toBeGreaterThan(0);
  });

  it('když všechno drží, řeší se peníze ležící ladem', () => {
    const state = makeState({ goals: ['retirement'] });
    const s = nextStep(state, alloc({ retirement: 15000 }));
    expect(s.key).toBe('grow');
    expect(s.monthly).toBeGreaterThan(0);
  });

  it('nikdy nevrátí krok bez důvodu', () => {
    const cases: [WizardState, GoalAllocations][] = [
      [makeState(), alloc()],
      [makeState({ goals: ['property'] }), alloc({ downPayment: 5000 })],
      [makeState({ goals: ['child'], savings: { totalSavings: 0 } }), alloc({ child: 11333 })],
      [makeState({ income: { person1NetMonthly: 15000 } }), alloc()],
    ];
    for (const [state, a] of cases) {
      const s = nextStep(state, a);
      expect(s.action.length).toBeGreaterThan(10);
      expect(s.why.length).toBeGreaterThan(20);
    }
  });
});

describe('nouzová rezerva se počítá z výdajů, které v tu dobu platí', () => {
  // Akontace je pokrytá, takže se kupuje hned, ale po jejím zaplacení zbyde
  // sotva měsíc výdajů.
  const kupujici = () => makeState({ goals: ['property'], savings: { totalSavings: 700000 } });

  it('u kupujícího je cíl tři měsíce výdajů po koupi, ne dnešních', () => {
    // Dřív se počet měsíců po koupi násobil dnešními výdaji, takže rozhodnutí
    // vyšlo správně, ale částka byla o čtvrtinu nižší, než na jakou se spoří.
    const state = kupujici();
    const s = nextStep(state, calculateDefaultAllocations(state));
    expect(s.key).toBe('reserve');
    expect(hasAmount(s.action, Math.round(necessaryExpensesAfterPurchase(state) * 3))).toBe(true);
    expect(hasAmount(s.action, Math.round(necessaryMonthlyExpenses(state) * 3))).toBe(false);
  });

  it('měsíce popisují cíl, ne to, co do něj chybí', () => {
    // „Chybí 5 855 Kč, tedy 3 měsíce nezbytných výdajů" tvrdilo, že tři
    // měsíce života stojí necelých šest tisíc.
    const state = kupujici();
    const s = nextStep(state, calculateDefaultAllocations(state));
    expect(s.why).toMatch(/^To jsou 3 měsíce nezbytných výdajů, chybí do nich/);
  });

  it('kdo nemá stranou nic, nečte tutéž částku dvakrát', () => {
    const state = makeState({ goals: ['retirement'], savings: { totalSavings: 0 } });
    const s = nextStep(state, alloc({ retirement: 5000 }));
    expect(s.why).toMatch(/a chybí celá/);
    expect(hasAmount(s.why, Math.round(necessaryMonthlyExpenses(state) * 3))).toBe(false);
  });

  it('kdo nekupuje, poměřuje se dnešními výdaji', () => {
    const state = makeState({ goals: ['retirement'], savings: { totalSavings: 20000 } });
    const s = nextStep(state, alloc({ retirement: 5000 }));
    expect(s.key).toBe('reserve');
    expect(hasAmount(s.action, Math.round(necessaryMonthlyExpenses(state) * 3))).toBe(true);
  });
});

describe('doporučená částka musí jít udržet', () => {
  const par = (o: Partial<WizardState> = {}): WizardState => makeState({
    goals: ['property', 'child'],
    income: { person1NetMonthly: 45000, person2NetMonthly: 38000 },
    expenses: { rent: 17000, utilities: 4000, food: 8000, transport: 3500, insurance: 1500, existingLoans: 0, children: 0, other: 4000 },
    savings: { totalSavings: 900000 },
    property: { targetPrice: 5500000, loanTermYears: 30 },
    parentalLeave: { enabled: true, parent: 2, durationMonths: 36 },
    ...o,
  });

  it('kdo kupuje hned, dostane rozpočet po koupi, ne dnešní', () => {
    // Dřív se počítalo z `budgetNow`, takže páru kupujícímu tenhle měsíc
    // appka radila rozhodnout se o 33 667 Kč, jenže po splátce jim zbyde míň.
    const state = par({ parentalLeave: undefined });
    const s = nextStep(state, calculateDefaultAllocations(state));
    expect(s.monthly).toBeLessThan(33667);
    expect(Math.round(s.monthly!)).toBe(24096);
  });

  it('s rodičovskou se řídí nejhorším měsícem, a řekne to', () => {
    const state = par();
    const s = nextStep(state, calculateDefaultAllocations(state));
    // Během rodičovského příspěvku zbývá 1 253 Kč; doporučit 24 096 Kč
    // by znamenalo slíbit trvalý příkaz, který za rok nejde platit.
    expect(Math.round(s.monthly!)).toBe(1253);
    expect(s.why).toMatch(/nejhorší.*měsíc.*rodičovské/i);
  });
});
