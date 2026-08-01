import { describe, it, expect } from 'vitest';
import { plausibilityNotes, openPlausibilityNotes } from '../../src/engine/plausibility';
import { createInitialState } from '../../src/store/wizardStore';
import type { WizardState, UserMode } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'couple',
    income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
    expenses: { rent: 19000, existingLoans: 0, insurance: 1800, food: 9000, transport: 4000, children: 0, utilities: 4500, other: 5000 },
    savings: { totalSavings: 300000 },
    goals: [],
    property: { targetPrice: 6200000, mortgageRate: 0.048, loanTermYears: 30 },
    ...overrides,
  };
}
const keys = (s: WizardState) => plausibilityNotes(s).map((n) => n.key);

describe('kontrola reálnosti vstupů', () => {
  it('rozumně vyplněný rozpočet nevyvolá nic', () => {
    expect(plausibilityNotes(makeState())).toEqual([]);
  });

  it('předvyplněné hodnoty appky neprotestují v žádném režimu', () => {
    // Kdyby vlastní výchozí data appky spustila upozornění, ztratí ho
    // uživatel z dohledu dřív, než ho poprvé přečte.
    const base = createInitialState();
    for (const mode of ['individual', 'couple', 'family'] as UserMode[]) {
      const state = { ...base, mode, numberOfChildren: mode === 'family' ? 2 : undefined };
      expect(plausibilityNotes(state), mode).toEqual([]);
    }
  });

  it('jídlo se poměřuje na dospělého, ne na hlavu', () => {
    // Děti mají vlastní položku „Výdaje na děti", takže by se počítaly dvakrát.
    const couple = makeState({ expenses: { ...makeState().expenses, food: 3000 } });
    expect(keys(couple)).toContain('food_low');
    const alone = makeState({ mode: 'individual', expenses: { ...makeState().expenses, food: 3000 } });
    expect(keys(alone)).not.toContain('food_low');
  });

  it('věta u nízkého jídla uvádí částku na dospělého, ne zadanou', () => {
    const state = makeState({ expenses: { ...makeState().expenses, food: 3000 } });
    const note = plausibilityNotes(state).find((n) => n.key === 'food_low')!;
    expect(note.title.replace(/[^\d]/g, '')).toBe('1500');
  });

  it('nulové položky se ozvou každá zvlášť', () => {
    const state = makeState({
      expenses: { rent: 19000, existingLoans: 0, insurance: 0, food: 9000, transport: 0, children: 0, utilities: 0, other: 0 },
    });
    expect(keys(state)).toEqual(
      expect.arrayContaining(['utilities_zero', 'transport_low', 'insurance_zero', 'discretionary_zero'])
    );
  });

  it('souhrnná kontrola mlčí, když se našlo něco konkrétního', () => {
    // Vedle tří jmenovitých poznámek by čtvrtá, obecnější, byla jen šum.
    const state = makeState({
      expenses: { rent: 0, existingLoans: 0, insurance: 0, food: 0, transport: 0, children: 0, utilities: 0, other: 0 },
    });
    expect(keys(state)).not.toContain('total_low');
  });

  it('neobvykle štíhlý rozpočet se ozve, i když je každá položka vyplněná', () => {
    const state = makeState({
      income: { person1NetMonthly: 90000, person2NetMonthly: 90000 },
      expenses: { rent: 12000, existingLoans: 0, insurance: 1500, food: 9000, transport: 4000, children: 0, utilities: 4000, other: 5000 },
    });
    expect(keys(state)).toEqual(['total_low']);
  });

  it('nájem na nule je poznámka, ne výtka, a mluví ke koupi', () => {
    const buying = makeState({ goals: ['property'], expenses: { ...makeState().expenses, rent: 0 } });
    const note = plausibilityNotes(buying).find((n) => n.key === 'rent_zero')!;
    expect(note.tone).toBe('info');
    expect(note.detail).toContain('po koupi');
  });

  it('odklepnutá poznámka se víckrát neukáže, ostatní zůstanou', () => {
    const state = makeState({
      expenses: { ...makeState().expenses, food: 3000, other: 0 },
      dismissedChecks: ['food_low'],
    });
    expect(keys(state)).toContain('food_low');
    const open = openPlausibilityNotes(state).map((n) => n.key);
    expect(open).not.toContain('food_low');
    expect(open).toContain('discretionary_zero');
  });

  it('kontrola nic nepřepisuje ani nemění stav', () => {
    const state = makeState({ expenses: { ...makeState().expenses, food: 3000 } });
    const before = JSON.stringify(state);
    plausibilityNotes(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});
