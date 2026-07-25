import type { WizardState } from '../types';
import {
  loanAmount,
  mortgageRate,
  mortgagePayment,
  renovationCost,
  effectiveDownPayment,
  ownershipCosts,
} from './mortgage';
import { totalMonthlyIncome, totalMonthlyExpenses } from './cashflow';

/**
 * Období rekonstrukce mezi koupí a nastěhováním.
 *
 * Dvě věci, které se běžně přehlédnou a jdou proti sobě:
 *
 *  1. Bydlí se dál v nájmu, takže se platí nájem I hypotéka. To rozpočet
 *     zatěžuje víc než cílový stav.
 *  2. Hypotéka se čerpá postupně a z nevyčerpané části se neplatí nic.
 *     Do doby, než se dočerpá, se platí jen úrok z toho, co je vytažené,
 *     ne plná anuita. To rozpočet naopak odlehčuje.
 *
 * Bez obojího vychází tahle fáze buď zbytečně růžově, nebo zbytečně černě.
 */

export interface RenovationPhase {
  months: number;
  cost: number;
  payingRentMeanwhile: boolean;

  // Splátka na začátku (vyčerpaná jen část na koupi) a na konci (vyčerpáno vše).
  interestOnlyStart: number;
  interestOnlyEnd: number;
  // Průměrná měsíční platba bance za celé období rekonstrukce.
  interestOnlyAverage: number;
  // Plná anuita, na kterou se přejde po dočerpání. Pro srovnání.
  fullPayment: number;

  // Měsíční náklady na bydlení během rekonstrukce (banka + případný nájem).
  housingDuringRenovation: number;
  // Co měsíčně zbyde, když se tohle všechno platí.
  disposableDuringRenovation: number;
  // Kolik celkem stojí celé období navíc oproti tomu, kdyby se rovnou bydlelo.
  totalExtraCost: number;
}

export function evaluateRenovation(state: WizardState): RenovationPhase | null {
  const renovation = state.property.renovation;
  if (!renovation || !state.goals.includes('property')) return null;
  if (renovation.cost <= 0 || renovation.months <= 0) return null;

  const rate = mortgageRate(state);
  const monthlyRate = rate / 12;
  const total = loanAmount(state);
  // Na koupi se čerpá hned, zbytek (rekonstrukce) postupně. Vlastní peníze
  // jdou do koupě jako první, takže banka doplácí zbytek kupní ceny.
  const drawnAtPurchase = Math.max(0, state.property.targetPrice - effectiveDownPayment(state));
  const drawnAtEnd = total;

  const interestOnlyStart = drawnAtPurchase * monthlyRate;
  const interestOnlyEnd = drawnAtEnd * monthlyRate;
  // Rovnoměrné čerpání zbytku, takže průměr je střed mezi začátkem a koncem.
  const interestOnlyAverage = (interestOnlyStart + interestOnlyEnd) / 2;

  const fullPayment = mortgagePayment(state);

  // Během rekonstrukce se bydlí ve starém, takže energie i nájem běží dál.
  // Náklady na vlastnictví zatím nejsou v plné výši, dům se teprve dodělává.
  const rentMeanwhile = renovation.payingRentMeanwhile
    ? state.expenses.rent + state.expenses.utilities
    : 0;
  const housingDuringRenovation = interestOnlyAverage + rentMeanwhile;

  const income = totalMonthlyIncome(state);
  // Ostatní výdaje bez bydlení, to se připočítá zvlášť podle fáze.
  const otherExpenses = totalMonthlyExpenses(state) - state.expenses.rent - state.expenses.utilities;
  const disposableDuringRenovation = income - otherExpenses - housingDuringRenovation;

  // O kolik je tahle fáze dražší než cílový stav (plná splátka + vlastnictví).
  const targetHousing = fullPayment + ownershipCosts(state);
  const totalExtraCost = Math.max(0, housingDuringRenovation - targetHousing) * renovation.months;

  return {
    months: renovation.months,
    cost: renovation.cost,
    payingRentMeanwhile: renovation.payingRentMeanwhile,
    interestOnlyStart,
    interestOnlyEnd,
    interestOnlyAverage,
    fullPayment,
    housingDuringRenovation,
    disposableDuringRenovation,
    totalExtraCost,
  };
}

// Typické prodražení stavebních prací. Rozpočet na rekonstrukci se drží málokdy.
export const RENOVATION_OVERRUN = 0.2;

export function renovationWithOverrun(state: WizardState): number {
  return Math.round(renovationCost(state) * (1 + RENOVATION_OVERRUN));
}
