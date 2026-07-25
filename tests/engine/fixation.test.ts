import { describe, it, expect } from 'vitest';
import {
  fixationYears,
  fixationPremium,
  suggestedRate,
  suggestedRateForFixation,
  isRateOverridden,
  mortgageRate,
  mortgagePayment,
} from '../../src/engine/mortgage';
import { DEFAULTS } from '../../src/engine/defaults';
import { createInitialState } from '../../src/store/wizardStore';
import type { WizardState } from '../../src/types';

function withFixation(years?: number, rate?: number): WizardState {
  const base = createInitialState();
  return {
    ...base,
    savings: { totalSavings: 1000000 },
    property: { ...base.property, fixationYears: years, mortgageRate: rate },
  };
}

describe('délka fixace', () => {
  it('výchozí stav nemá sazbu zadanou ručně, řídí se fixací', () => {
    const state = createInitialState();
    expect(isRateOverridden(state)).toBe(false);
    expect(fixationYears(state)).toBe(DEFAULTS.property.fixationYears);
  });

  it('pětiletá fixace je základ, ze kterého se ostatní odvozují', () => {
    expect(fixationPremium(5)).toBe(0);
    expect(suggestedRateForFixation(5)).toBe(DEFAULTS.property.mortgageRate);
  });

  it('krátká fixace je dražší, tříletá nejlevnější, dlouhá s příplatkem', () => {
    expect(suggestedRateForFixation(1)).toBeGreaterThan(suggestedRateForFixation(5));
    expect(suggestedRateForFixation(3)).toBeLessThan(suggestedRateForFixation(5));
    expect(suggestedRateForFixation(7)).toBeGreaterThan(suggestedRateForFixation(5));
    expect(suggestedRateForFixation(10)).toBeGreaterThan(suggestedRateForFixation(7));
  });

  it('neznámá délka fixace nepřidává přirážku', () => {
    expect(fixationPremium(4)).toBe(0);
    expect(suggestedRateForFixation(4)).toBe(DEFAULTS.property.mortgageRate);
  });

  it('nesbírá chyby floatu', () => {
    // 0,048 + 0,004 vychází v plovoucí čárce na 0,051999999999999998.
    expect(suggestedRateForFixation(1)).toBe(0.052);
  });

  it('změna fixace hýbe sazbou i splátkou', () => {
    const short = withFixation(1);
    const long = withFixation(10);
    expect(mortgageRate(short)).toBe(suggestedRateForFixation(1));
    expect(mortgageRate(long)).toBe(suggestedRateForFixation(10));
    expect(mortgagePayment(long)).toBeGreaterThan(mortgagePayment(short));
  });

  it('ručně zadaná sazba má přednost, fixace s ní nehýbe', () => {
    const own = withFixation(10, 0.031);
    expect(isRateOverridden(own)).toBe(true);
    expect(mortgageRate(own)).toBe(0.031);
    expect(mortgageRate({ ...own, property: { ...own.property, fixationYears: 1 } })).toBe(0.031);
  });

  it('suggestedRate čte fixaci ze stavu', () => {
    expect(suggestedRate(withFixation(3))).toBe(suggestedRateForFixation(3));
    // Bez zadané fixace platí výchozí (pětiletá).
    expect(suggestedRate(withFixation(undefined))).toBe(suggestedRateForFixation(5));
  });
});
