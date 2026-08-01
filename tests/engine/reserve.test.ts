import { describe, it, expect } from 'vitest';
import { reserveStatus, monthsToFillReserve, DEFAULT_RESERVE_MONTHS } from '../../src/engine/reserve';
import { reserveReadiness } from '../../src/engine/readiness';
import { calculateDefaultAllocations, type GoalAllocations } from '../../src/engine/allocation';
import { evaluateOverall } from '../../src/engine/summary';
import { nextStep } from '../../src/engine/nextStep';
import { budgetNow } from '../../src/engine/budget';
import { incomeFlow } from '../../src/engine/expenseBreakdown';
import { wealthTimeline } from '../../src/engine/wealthTimeline';
import { necessaryMonthlyExpenses } from '../../src/engine/cashflow';
import { formatMonths } from '../../src/engine/format';
import { effectiveDownPayment, necessaryExpensesAfterPurchase } from '../../src/engine/mortgage';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'couple',
    income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
    expenses: { rent: 19000, existingLoans: 0, insurance: 1800, food: 9000, transport: 4000, children: 0, utilities: 4500, other: 5000 },
    savings: { totalSavings: 300000 },
    goals: ['reserve'],
    property: { targetPrice: 6200000, mortgageRate: 0.048, loanTermYears: 30 },
    person1Age: 31, person2Age: 29,
    ...overrides,
  };
}
const alloc = (o: Partial<GoalAllocations> = {}): GoalAllocations =>
  ({ downPayment: 0, reserve: 0, retirement: 0, child: 0, custom: [], ...o });

describe('nouzová rezerva', () => {
  it('bez nemovitosti se poměřuje dnešními nezbytnými výdaji', () => {
    const state = makeState({ savings: { totalSavings: 50000 } });
    const s = reserveStatus(state);
    expect(s.afterPurchase).toBe(false);
    expect(s.monthlyNeed).toBe(necessaryMonthlyExpenses(state));
    expect(s.targetMonths).toBe(DEFAULT_RESERVE_MONTHS);
    expect(s.target).toBe(necessaryMonthlyExpenses(state) * DEFAULT_RESERVE_MONTHS);
    expect(s.current).toBe(50000);
    expect(s.done).toBe(false);
  });

  it('s nemovitostí se počítá z toho, co po akontaci zbyde, a z výdajů po koupi', () => {
    // Splátka bývá skoro dvojnásobek nájmu, takže cíl je vyšší a peněz míň.
    // Kdo obojí spočítá z dneška, slíbí delší runway, než jaká je.
    const state = makeState({ goals: ['reserve', 'property'] });
    const s = reserveStatus(state);
    expect(s.afterPurchase).toBe(true);
    expect(s.monthlyNeed).toBe(necessaryExpensesAfterPurchase(state));
    expect(s.monthlyNeed).toBeGreaterThan(necessaryMonthlyExpenses(state));
    expect(s.current).toBe(Math.round(300000 - effectiveDownPayment(state)));
  });

  it('zvednutí cíle na půl roku zvedne cílovou částku i mezeru', () => {
    const three = reserveStatus(makeState({ savings: { totalSavings: 50000 } }));
    const six = reserveStatus(makeState({ savings: { totalSavings: 50000 }, reserveMonths: 6 }));
    expect(six.target).toBe(three.target * 2);
    expect(six.gap).toBeGreaterThan(three.gap);
  });

  it('uložený nesmysl se ořízne na rozumné meze', () => {
    expect(reserveStatus(makeState({ reserveMonths: 0 })).targetMonths).toBe(1);
    expect(reserveStatus(makeState({ reserveMonths: 99 })).targetMonths).toBe(12);
  });

  it('nulové odkládání znamená nekonečno, ne disponibilní částku', () => {
    // Stejný důvod jako u akontace: termín spočítaný z peněz, které na cíl
    // nejdou, je slib, který neplatí.
    const state = makeState({ savings: { totalSavings: 0 } });
    expect(monthsToFillReserve(state, 0)).toBe(Infinity);
    expect(monthsToFillReserve(state, 10000)).toBe(Math.ceil(reserveStatus(state).gap / 10000));
  });
});

describe('rezerva jako cíl v přehledu', () => {
  it('hotová rezerva je „v pořádku", rozdělaná „pozor", zanedbaná „nevychází"', () => {
    const full = makeState({ savings: { totalSavings: 500000 } });
    expect(reserveReadiness(full, alloc()).status).toBe('good');

    const empty = makeState({ savings: { totalSavings: 0 } });
    expect(reserveReadiness(empty, alloc({ reserve: 5000 })).status).toBe('caution');
    expect(reserveReadiness(empty, alloc()).status).toBe('warning');
  });

  it('věta u rozdělané rezervy nese chybějící částku i termín', () => {
    const state = makeState({ savings: { totalSavings: 0 } });
    const r = reserveReadiness(state, alloc({ reserve: 5000 }));
    const months = monthsToFillReserve(state, 5000);
    expect(r.headline).toContain('Do rezervy chybí');
    expect(r.headline).toContain(formatMonths(months));
  });

  it('cíl se objeví v seznamu cílů přehledu jen když je zapnutý', () => {
    const on = makeState();
    const off = makeState({ goals: ['retirement'] });
    const keys = (s: WizardState) =>
      evaluateOverall(s, calculateDefaultAllocations(s)).goals.map((g) => g.key);
    expect(keys(on)).toContain('reserve');
    expect(keys(off)).not.toContain('reserve');
  });
});

describe('rezerva v rozdělení peněz', () => {
  it('vypnutý cíl na sebe nebere nic', () => {
    const state = makeState({ goals: ['property'] });
    expect(calculateDefaultAllocations(state).reserve).toBe(0);
  });

  it('zapnutý cíl si vezme část volných peněz a ubere akontaci', () => {
    const withReserve = makeState({ goals: ['property', 'reserve'], savings: { totalSavings: 300000 } });
    const without = makeState({ goals: ['property'], savings: { totalSavings: 300000 } });
    const a = calculateDefaultAllocations(withReserve);
    const b = calculateDefaultAllocations(without);
    expect(a.reserve).toBeGreaterThan(0);
    expect(a.downPayment).toBeLessThan(b.downPayment);
  });

  it('hotová rezerva si nebere nic', () => {
    const state = makeState({ savings: { totalSavings: 5000000 } });
    expect(calculateDefaultAllocations(state).reserve).toBe(0);
  });

  it('rezerva si nikdy nevezme celý rozpočet', () => {
    // Cíl, který zastaví všechno ostatní, si uživatel vypne a nebude ho mít vůbec.
    const state = makeState({ savings: { totalSavings: 0 }, reserveMonths: 12 });
    const a = calculateDefaultAllocations(state);
    const disposable = 93000 - 43300;
    expect(a.reserve).toBeLessThanOrEqual(Math.round(disposable * 0.4));
  });

  it('rezerva ukrajuje z rozpočtu a je vidět v rozpadu příjmu', () => {
    const state = makeState({ savings: { totalSavings: 0 } });
    const a = calculateDefaultAllocations(state);
    expect(budgetNow(state, a).allocated).toBe(a.reserve);
    const flow = incomeFlow(state, a, false);
    expect(flow.goals.map((g) => g.key)).toContain('reserve');
  });
});

describe('rezerva na časové ose', () => {
  it('napíná tok, dokud se buduje, a pak přestane', () => {
    // Je to cíl s koncem, ne trvalý výdaj: naplněním se peníze uvolní.
    const state = makeState({ savings: { totalSavings: 0 } });
    const a = calculateDefaultAllocations(state);
    const t = wealthTimeline(state, { months: 240, allocations: a });
    const first = t.points[1];
    const last = t.points[t.points.length - 1];
    expect(first.flow - first.flowAfterGoals).toBe(a.reserve);
    expect(last.flow - last.flowAfterGoals).toBe(0);
  });

  it('nesahá na tytéž peníze jako akontace', () => {
    // Kdyby si oba fondy braly `min(alloc, flow)` zvlášť, rozdělily by
    // v hubeném měsíci tytéž peníze dvakrát a osa by kupovala dřív.
    const state = makeState({
      goals: ['property', 'reserve'],
      savings: { totalSavings: 300000 },
    });
    const withReserve = wealthTimeline(state, { months: 240 });
    const without = wealthTimeline({ ...state, goals: ['property'] }, { months: 240 });
    expect(withReserve.purchaseMonth).toBeGreaterThan(without.purchaseMonth!);
  });
});

describe('a co teď u rezervy', () => {
  it('když je rezerva mezi cíli, doporučí částku, kterou si u ní uživatel nastavil', () => {
    const state = makeState({ savings: { totalSavings: 0 } });
    const s = nextStep(state, alloc({ reserve: 7500 }));
    expect(s.key).toBe('reserve');
    expect(s.monthly).toBe(7500);
    expect(s.section).toBe('cile');
  });

  it('bez zapnutého cíle zůstává doporučení jako dřív', () => {
    const state = makeState({ goals: [], savings: { totalSavings: 0 } });
    const s = nextStep(state, alloc());
    expect(s.key).toBe('reserve');
    expect(s.section).toBe('rozpocet');
  });

  it('u delšího cíle sedí tvar věty na číslovku', () => {
    // „To jsou 6 měsíců" je česky špatně; u 2–4 se říká „jsou", jinak „je".
    const six = nextStep(makeState({ savings: { totalSavings: 0 }, reserveMonths: 6 }), alloc({ reserve: 5000 }));
    expect(six.why).toMatch(/^To je 6 měsíců/);
    const three = nextStep(makeState({ savings: { totalSavings: 0 } }), alloc({ reserve: 5000 }));
    expect(three.why).toMatch(/^To jsou 3 měsíce/);
  });
});
