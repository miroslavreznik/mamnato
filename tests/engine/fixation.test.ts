import { describe, it, expect } from 'vitest';
import {
  fixationYears,
  fixationPremium,
  suggestedRate,
  suggestedRateForFixation,
  isRateOverridden,
  mortgageRate,
  mortgagePayment,
  ownershipCosts,
  suggestedOwnershipCosts,
  isOwnershipCostsOverridden,
  mortgageRateEstimate,
  ownershipCostsEstimate,
} from '../../src/engine/mortgage';
import { estimate } from '../../src/engine/estimate';
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

describe('náklady na vlastnictví', () => {
  it('odhadují se z ceny nemovitosti, ne paušálem', () => {
    // 1 % ročně, zaokrouhleno na stokoruny.
    expect(suggestedOwnershipCosts(5500000)).toBe(4600);
    expect(suggestedOwnershipCosts(12500000)).toBe(10400);
    // Dvojnásobná cena znamená dvojnásobné náklady.
    expect(suggestedOwnershipCosts(6000000)).toBe(2 * suggestedOwnershipCosts(3000000));
  });

  it('výchozí stav je nemá zadané a mění se s cenou', () => {
    const base = createInitialState();
    expect(isOwnershipCostsOverridden(base)).toBe(false);
    expect(ownershipCosts(base)).toBe(suggestedOwnershipCosts(base.property.targetPrice));

    const pricier = { ...base, property: { ...base.property, targetPrice: 12500000 } };
    expect(ownershipCosts(pricier)).toBe(suggestedOwnershipCosts(12500000));
  });

  it('ručně zadaná částka má přednost a s cenou se nemění', () => {
    const base = createInitialState();
    const own = { ...base, property: { ...base.property, targetPrice: 12500000, ownershipCosts: 3000 } };
    expect(isOwnershipCostsOverridden(own)).toBe(true);
    expect(ownershipCosts(own)).toBe(3000);
  });
});

describe('odhad vs. ruční zadání', () => {
  it('společný pomocník rozliší obojí', () => {
    const auto = estimate(undefined, 42);
    expect(auto).toEqual({ value: 42, suggested: 42, overridden: false });

    const manual = estimate(10, 42);
    expect(manual).toEqual({ value: 10, suggested: 42, overridden: true });
  });

  it('nula je platné ruční zadání, ne chybějící hodnota', () => {
    // `??` by nulu propustil dál jako „nezadáno", což je klasická past.
    expect(estimate(0, 42)).toEqual({ value: 0, suggested: 42, overridden: true });
  });

  it('sazba i náklady na vlastnictví používají stejný vzorec', () => {
    const base = createInitialState();
    expect(mortgageRateEstimate(base).overridden).toBe(false);
    expect(ownershipCostsEstimate(base).overridden).toBe(false);

    const manual = { ...base, property: { ...base.property, mortgageRate: 0.031, ownershipCosts: 3000 } };
    expect(mortgageRateEstimate(manual)).toEqual({
      value: 0.031, suggested: suggestedRateForFixation(5), overridden: true,
    });
    expect(ownershipCostsEstimate(manual).value).toBe(3000);
    expect(ownershipCostsEstimate(manual).overridden).toBe(true);
    // Odhad zůstává k dispozici i u ručně zadané hodnoty, kvůli srovnání v UI.
    expect(ownershipCostsEstimate(manual).suggested).toBe(suggestedOwnershipCosts(base.property.targetPrice));
  });
});
