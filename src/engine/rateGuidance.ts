import type { WizardState } from '../types';
import {
  monthlyMortgagePayment,
  effectiveDownPayment,
  loanAmount,
  mortgageRate,
  loanTermYears,
} from './mortgage';

// Banky v ČR neúčtují jednu sazbu, odstupňovávají ji podle LTV (poměru úvěru
// k ceně nemovitosti). Čím víc dáte z vlastního, tím nižší riziko pro banku
// a tím lepší sazba. Přirážky/slevy níže jsou orientační tržní zvyklost
// (rozdíly mezi bankami jsou v řádu desetin p. b.), měřeno proti standardnímu
// pásmu do 80 % LTV.
export interface LtvBand {
  key: string;
  maxLtv: number; // horní hranice pásma (včetně)
  label: string;
  // Orientační rozdíl sazby oproti pásmu do 80 % LTV (v desetinném vyjádření).
  ratePremium: number;
  // Půjčí banka v tomto pásmu vůbec? (ČNB: LTV max 80 %, do 36 let 90 %)
  available: boolean;
}

export const LTV_BANDS: LtvBand[] = [
  { key: 'best', maxLtv: 0.70, label: 'do 70 % LTV', ratePremium: -0.0015, available: true },
  { key: 'standard', maxLtv: 0.80, label: 'do 80 % LTV', ratePremium: 0, available: true },
  { key: 'high', maxLtv: 0.90, label: '80–90 % LTV', ratePremium: 0.003, available: true },
  { key: 'over', maxLtv: Infinity, label: 'nad 90 % LTV', ratePremium: 0.003, available: false },
];

// LTV = jaká část ceny je půjčená. 0 když cena není zadaná.
export function ltv(state: WizardState): number {
  const price = state.property.targetPrice;
  if (price <= 0) return 0;
  return loanAmount(state) / price;
}

export function ltvBandFor(ltvValue: number): LtvBand {
  return LTV_BANDS.find((b) => ltvValue <= b.maxLtv) ?? LTV_BANDS[LTV_BANDS.length - 1];
}

// Splátka při jiné sazbě (stejná jistina i splatnost), pro modelování refixace.
export function paymentAtRate(state: WizardState, rate: number): number {
  return monthlyMortgagePayment(loanAmount(state), rate, loanTermYears(state));
}

export interface LtvRateAdvice {
  ltv: number;
  band: LtvBand;
  // Nejbližší lepší pásmo (null, když už jste v tom nejlepším).
  nextBand: LtvBand | null;
  // Kolik korun navíc do akontace, aby se do lepšího pásma dosáhlo.
  extraDownPayment: number;
  // Vejde se ten doplatek do zbylých úspor?
  affordable: boolean;
  // Orientační pokles sazby při přechodu do lepšího pásma (kladné číslo).
  rateDrop: number;
  // Odhadovaná úspora na měsíční splátce (nižší jistina + nižší sazba).
  monthlySaving: number;
}

// Poradí, jestli se vyplatí doplatit akontaci kvůli lepšímu pásmu sazby.
// Vrací null, když nemovitost nemá cenu (nedá se počítat LTV).
export function ltvRateAdvice(state: WizardState): LtvRateAdvice | null {
  const price = state.property.targetPrice;
  if (price <= 0) return null;

  const current = ltv(state);
  const band = ltvBandFor(current);
  const index = LTV_BANDS.findIndex((b) => b.key === band.key);
  const nextBand = index > 0 ? LTV_BANDS[index - 1] : null;

  if (!nextBand) {
    return {
      ltv: current, band, nextBand: null,
      extraDownPayment: 0, affordable: true, rateDrop: 0, monthlySaving: 0,
    };
  }

  const dp = effectiveDownPayment(state);
  // Aby úvěr klesl pod hranici pásma, musí akontace pokrýt zbytek ceny.
  // Zaokrouhleno na celé koruny, jde o částku, kterou uživatel doplácí.
  const dpForNextBand = Math.round(price - nextBand.maxLtv * price);
  const extraDownPayment = Math.max(0, dpForNextBand - dp);
  const affordable = dp + extraDownPayment <= state.savings.totalSavings;

  const rate = mortgageRate(state);
  const term = loanTermYears(state);
  const rateDrop = Math.max(0, band.ratePremium - nextBand.ratePremium);
  const paymentNow = monthlyMortgagePayment(loanAmount(state), rate, term);
  const paymentNext = monthlyMortgagePayment(
    Math.max(0, price - (dp + extraDownPayment)),
    Math.max(0, rate - rateDrop),
    term
  );

  return {
    ltv: current,
    band,
    nextBand,
    extraDownPayment,
    affordable,
    rateDrop,
    monthlySaving: Math.max(0, paymentNow - paymentNext),
  };
}
