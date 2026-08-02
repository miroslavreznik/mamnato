import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { yearIn, monthYearIn } from '../../src/engine/format';
import { journey } from '../../src/engine/journey';
import { calculateDefaultAllocations } from '../../src/engine/allocation';
import type { WizardState } from '../../src/types';

/**
 * Kalendářní popisky musí vycházet z dnešního data, ne z letopočtu.
 *
 * Plán běží od dneška, ne od ledna. Zkratka „letošní rok + počet let" proto
 * platí jen v lednu a jinak posouvá popisky o celý rok dolů: v srpnu spadl
 * dvacátý měsíc plánu do dubna 2028, ale nadpis nejtěsnějšího místa hlásil
 * 2027. Karta „A co teď" o kus vedle přitom počítala termíny z data správně,
 * takže si dvě čísla o téže chvíli odporovala.
 *
 * Testy schválně přepínají systémový čas: chyba je vidět jen mimo leden
 * a jinak by prošly i se starým vzorcem.
 */

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'couple',
    income: { person1NetMonthly: 48000, person2NetMonthly: 36000 },
    expenses: { rent: 18000, existingLoans: 0, insurance: 1500, food: 8000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 300000 },
    goals: ['property', 'child'],
    property: { targetPrice: 6000000, mortgageRate: 0.048, loanTermYears: 30 },
    person1Age: 32, person2Age: 30,
    childInMonths: 12,
    parentalLeave: { enabled: true, parent: 2, durationMonths: 36 },
    ...overrides,
  };
}

function at(iso: string) {
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('rok se počítá z dneška, ne z letopočtu', () => {
  it('v srpnu padne dvacátý měsíc do roku 2028, ne 2027', () => {
    at('2026-08-02T10:00:00');
    expect(yearIn(20)).toBe(2028);
    // Starý vzorec `letošní + floor(20/12)` dával 2027.
    expect(yearIn(20)).not.toBe(new Date().getFullYear() + Math.floor(20 / 12));
  });

  it('v lednu se obojí shoduje, proto to tak dlouho nebylo vidět', () => {
    at('2026-01-15T10:00:00');
    for (const m of [0, 5, 11, 12, 20, 37]) {
      expect(yearIn(m), `měsíc ${m}`).toBe(2026 + Math.floor(m / 12));
    }
  });

  it('rok v přelomu prosinec/leden nepřeskočí', () => {
    at('2026-12-20T10:00:00');
    expect(yearIn(0)).toBe(2026);
    expect(yearIn(1)).toBe(2027);
    expect(yearIn(13)).toBe(2028);
  });

  it('yearIn a monthYearIn mluví o téže chvíli', () => {
    // Obojí se v přehledu potkává: „Nejníže 2028" na stuze a „hotovo
    // v dubnu 2028" v kartě kroku.
    for (const day of ['2026-01-10', '2026-03-31', '2026-08-02', '2026-11-30']) {
      at(`${day}T10:00:00`);
      for (const m of [0, 1, 4, 7, 11, 12, 19, 25, 40, 121]) {
        expect(String(yearIn(m)), `${day} + ${m}`).toBe(monthYearIn(m).slice(-4));
      }
    }
  });

  it('nekonečný termín nespadne', () => {
    at('2026-08-02T10:00:00');
    expect(yearIn(Infinity)).toBe(2026);
    expect(monthYearIn(Infinity)).toBe('');
  });
});

describe('nadpisy na časové ose sedí na kalendář', () => {
  it('nejtěsnější místo uvádí týž rok, jaký vyjde z data', () => {
    at('2026-08-02T10:00:00');
    const state = makeState({ savings: { totalSavings: 0 } });
    const j = journey(state, { allocations: calculateDefaultAllocations(state) });
    const year = j.tightest!.title.match(/(20\d\d)/);
    if (year) {
      expect(year[1]).toBe(monthYearIn(j.tightest!.month).slice(-4));
    }
  });

  it('popis události pro čtečku uvádí měsíce, ne zaokrouhlené roky', () => {
    // „Dítě za 1 let" bylo špatně česky i nepřesně: sedmnáct měsíců je
    // rok a pět měsíců, ne rok.
    at('2026-08-02T10:00:00');
    const state = makeState({ childInMonths: 17 });
    const j = journey(state, { allocations: calculateDefaultAllocations(state) });
    const child = j.events.find((e) => e.key === 'child')!;
    expect(child.month).toBe(17);
  });
});
