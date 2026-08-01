import type { WizardState } from '../types';
import { loanAmount, mortgageRate, loanTermYears, monthlyMortgagePayment } from './mortgage';
import { childWord, czk } from './format';
import { plannedChildren } from './childCost';

/**
 * Daňové úlevy spojené s hypotékou a dětmi.
 *
 * Záměrně se **nezapočítávají** do disponibilní částky ani do verdiktu.
 * Důvod je jednoduchý: daňové zvýhodnění na dítě si většina zaměstnanců
 * uplatňuje měsíčně u zaměstnavatele, takže už je obsažené v čisté mzdě,
 * kterou uživatel zadal. Kdybychom ho přičetli znovu, počítali bychom
 * stejné peníze dvakrát a rozpočet by vypadal lépe, než jaký je.
 *
 * Karta proto slouží jako upozornění „na tohle nezapomeňte", ne jako
 * další položka rozpočtu.
 */

// Zákon o daních z příjmů, hodnoty platné pro rok 2026:
// odpočet úroků z úvěru na bydlení pořízené od 1. 1. 2021.
export const INTEREST_DEDUCTION_CAP = 150000;
// Sazba daně z příjmů fyzických osob v základním pásmu.
export const INCOME_TAX_RATE = 0.15;
// Daňové zvýhodnění na dítě podle pořadí (§ 35c ZDP), ročně.
export const CHILD_TAX_CREDIT = [15204, 22320, 27840] as const;

/**
 * Úroky zaplacené během prvního roku splácení.
 *
 * Počítá se skutečným umořováním, ne zjednodušením „jistina krát sazba":
 * jistina se během roku snižuje, takže by odhad vycházel vyšší, než jaký je.
 */
export function firstYearInterest(state: WizardState): number {
  const principal = loanAmount(state);
  if (principal <= 0) return 0;
  const rate = mortgageRate(state);
  const payment = monthlyMortgagePayment(principal, rate, loanTermYears(state));
  const monthlyRate = rate / 12;

  let balance = principal;
  let interest = 0;
  for (let month = 0; month < 12 && balance > 0; month++) {
    const monthInterest = balance * monthlyRate;
    interest += monthInterest;
    balance = Math.max(0, balance - (payment - monthInterest));
  }
  return interest;
}

// Roční úspora z odpočtu úroků: odečíst jde nejvýš 150 000 Kč ročně
// a úspora je 15 % z odečtené částky, ne celá částka.
export function interestDeductionSaving(state: WizardState): number {
  const deductible = Math.min(firstYearInterest(state), INTEREST_DEDUCTION_CAP);
  return Math.round(deductible * INCOME_TAX_RATE);
}

// Roční daňové zvýhodnění na daný počet dětí, sečtené podle pořadí.
export function childCreditYearly(children: number): number {
  let total = 0;
  for (let i = 0; i < children; i++) {
    total += CHILD_TAX_CREDIT[Math.min(i, CHILD_TAX_CREDIT.length - 1)];
  }
  return total;
}

export interface TaxReliefItem {
  key: 'interest' | 'child';
  label: string;
  yearly: number;
  monthly: number;
  // Vysvětlení, ze kterých čísel to vzniklo. Zobrazuje se uživateli.
  how: string;
}

export interface TaxRelief {
  items: TaxReliefItem[];
  yearly: number;
  monthly: number;
  // Uplatňuje uživatel zvýhodnění na dítě nejspíš už teď (tedy je v čisté
  // mzdě, kterou zadal)? U rodiny s dětmi ano, u plánovaného dítěte ne.
  childCreditAlreadyClaimed: boolean;
  // Kolik dětí z toho teprve přijde. Rodina, která už děti má a plánuje
  // další, potřebuje vědět, která část je novinka a která ne.
  plannedChildren: number;
}

export function evaluateTaxRelief(state: WizardState): TaxRelief | null {
  const items: TaxReliefItem[] = [];

  if (state.goals.includes('property') && loanAmount(state) > 0) {
    const interest = firstYearInterest(state);
    const yearly = interestDeductionSaving(state);
    items.push({
      key: 'interest',
      label: 'Odpočet úroků z hypotéky',
      yearly,
      monthly: Math.round(yearly / 12),
      how: interest > INTEREST_DEDUCTION_CAP
        ? `V prvním roce zaplatíte na úrocích ${czk(interest)}, odečíst jde ale nejvýš ${czk(INTEREST_DEDUCTION_CAP)} ročně. Úspora je 15 % z toho. S klesající jistinou bude úleva každý rok o něco nižší.`
        : `V prvním roce zaplatíte na úrocích ${czk(interest)} a celé je lze odečíst od základu daně (limit je ${czk(INTEREST_DEDUCTION_CAP)} ročně). Úspora je 15 % z odečtené částky. S klesající jistinou bude úleva každý rok o něco nižší.`,
    });
  }

  // Plánované děti = nová sleva. Děti, které už doma jsou, si uživatel
  // nejspíš uplatňuje a má je v čisté mzdě; poznámka pod kartou to říká.
  //
  // Počet plánovaných dětí je z plánu, ne natvrdo jedno. Kdo si v kartě
  // nákladů nastavil dvě, platil dvojnásobné výdaje, ale zvýhodnění tu
  // dostal na jedno dítě. Zvýhodnění se navíc stupňuje podle pořadí, takže
  // druhé dítě není totéž co první.
  const planned = state.goals.includes('child') ? plannedChildren(state) : 0;
  const existingChildren = state.mode === 'family' ? (state.numberOfChildren ?? 0) : 0;
  const childrenForCredit = existingChildren + planned;

  if (childrenForCredit > 0) {
    const yearly = childCreditYearly(childrenForCredit);
    items.push({
      key: 'child',
      label: childrenForCredit === 1
        ? 'Daňové zvýhodnění na dítě'
        : `Daňové zvýhodnění na ${childrenForCredit} ${childWord(childrenForCredit)}`,
      yearly,
      monthly: Math.round(yearly / 12),
      how: `Na první dítě ${czk(CHILD_TAX_CREDIT[0])} ročně, na druhé ${czk(CHILD_TAX_CREDIT[1])} a na třetí a další ${czk(CHILD_TAX_CREDIT[2])}. Na rozdíl od odpočtu úroků se odečítá rovnou od daně, ne od základu.`,
    });
  }

  if (items.length === 0) return null;

  const yearly = items.reduce((s, i) => s + i.yearly, 0);
  return {
    items,
    yearly,
    monthly: Math.round(yearly / 12),
    childCreditAlreadyClaimed: existingChildren > 0,
    plannedChildren: planned,
  };
}
