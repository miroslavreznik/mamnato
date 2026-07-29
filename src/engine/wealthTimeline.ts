import type { WizardState } from '../types';
import { CHILD_COSTS_CZ } from './defaults';
import { totalMonthlyIncome, totalMonthlyExpenses } from './cashflow';
import { monthlyMortgagePayment, requiredDownPayment, downPaymentFraction, mortgageRate, loanTermYears, ownershipCosts, totalProjectCost, effectiveDownPayment } from './mortgage';
import { parentSalary, leavePhases, benefitAtLeaveMonth } from './parentalLeave';
import { calculateDefaultAllocations, type GoalAllocations } from './allocation';

// Časová osa jmění: měsíc po měsíci simuluje vývoj úspor domácnosti přes
// plánované životní události, spoření na akontaci, koupi (jednorázový pokles
// o akontaci a přechod z nájmu na hypotéku), narození dítěte (náklady dle
// věku) a rodičovskou (výpadek mzdy nahrazený dávkami).
//
// Záměrná zjednodušení: příjmy a výdaje jsou konstantní, výnosy z investic
// a inflaci nepočítáme (konzervativní odhad). Spoření na cíle zůstává součástí
// jmění (peníze se jen přesouvají), proto se od `cash` neodečítá.
//
// **Koupě se ale nespouští z celého jmění.** Z něj se kupovat nedá: peníze
// odložené na důchod nebo na dítě jsou v akciích a v rezervě, ne v akontaci.
// Časová osa proto vede zvlášť fond na akontaci, který roste jen o částku
// vyhrazenou na akontaci. Dokud to takhle nebylo, kupovala o roky dřív, než
// slibovala dlaždice „chybějící akontace" vedle ní: u rodiny se 300 000 Kč
// chybějící akontace stálo v přehledu „naspoříte za 4 roky a 4 měsíce"
// a stuha hned pod tím kreslila koupi za rok a dva měsíce. `allocation.ts`
// si přitom v komentáři u `monthsToSaveAtAllocation` sám zakazuje počítat
// termín z celé disponibilní částky, protože „jako slíbený termín by lhal".

export interface WealthPoint {
  month: number;
  cash: number;
  /**
   * Kolik ten měsíc přiteklo nebo odteklo (příjem − výdaje). Jednorázový
   * výdej akontace se sem nezapočítává, ten není opakovaný tok.
   *
   * Vystavuje se kvůli stuze na záložce Cesta, která barví průběh podle
   * napětí rozpočtu, ne podle výše úspor: rok se schodkem vypadá na křivce
   * zůstatku stejně jako rok bez něj, dokud jsou úspory dost velké.
   */
  flow: number;
  /**
   * Totéž po odečtení toho, co ten měsíc jde na cíle.
   *
   * Rozdíl proti `flow` je celý smysl: jmění může růst, a přesto na cíle
   * nezbývat. Přesně to říká verdikt („po koupi by na cíle chybělo 924 Kč"),
   * jenže stuha barvila podle `flow`, kde cíle nejsou, a kreslila u toho
   * klidnou zelenou. Nadpis a obrázek pod ním si tak odporovaly.
   */
  flowAfterGoals: number;
}

export interface WealthTimelineResult {
  points: WealthPoint[];
  purchaseMonth: number | null; // null = koupě se v horizontu nekoná
  childMonth: number | null;
  leaveEndMonth: number | null;
  minCash: number;
  minCashMonth: number;
  firstNegativeMonth: number | null;
}

// Měsíční náklady na dítě dle věku (0–18 let; VŠ do časové osy nezahrnujeme).
function childCostAt(ageYears: number): number {
  const bracket = CHILD_COSTS_CZ.find((r) => r.to <= 18 && ageYears >= r.from && ageYears < r.to);
  return bracket?.monthlyCost ?? 0;
}

export function wealthTimeline(
  state: WizardState,
  opts: {
    months?: number;
    childOffsetMonths?: number;
    /**
     * Kolik měsíčně jde na cíle. Bez toho by časová osa kupovala z peněz,
     * které jsou určené jinam, a stuha by barvila podle toku, ve kterém cíle
     * nejsou. Když se nepředá, použije se výchozí rozdělení, tedy to, co
     * appka ukazuje, dokud uživatel nesáhne na posuvníky.
     */
    allocations?: GoalAllocations;
  } = {}
): WealthTimelineResult {
  const horizon = opts.months ?? 120;
  const hasProperty = state.goals.includes('property');
  const hasChild = state.goals.includes('child');

  const baseIncome = totalMonthlyIncome(state);
  const baseExpenses = totalMonthlyExpenses(state);
  const rent = state.expenses.rent + state.expenses.utilities;

  // Cílová akontace: požadovaná dle LTV; když si uživatel vyhradil víc, platí jeho volba.
  const price = totalProjectCost(state);
  const required = requiredDownPayment(price, downPaymentFraction(state));
  const chosen = state.savings.downPaymentFromSavings;
  const targetDownPayment = chosen != null ? Math.max(required, chosen) : required;
  const rate = mortgageRate(state);
  const term = loanTermYears(state);
  const ownership = ownershipCosts(state);
  const mortgage = monthlyMortgagePayment(Math.max(0, price - targetDownPayment), rate, term);

  const childMonth = hasChild ? Math.max(0, Math.round(opts.childOffsetMonths ?? 12)) : null;
  const pl = state.parentalLeave;
  const leaveActive = !!pl?.enabled && childMonth !== null;
  const phases = leavePhases(state);
  const leaveEndMonth = leaveActive ? childMonth! + pl!.durationMonths : null;

  // Kolik měsíčně mizí z volných peněz do cílů.
  //
  // Dva z cílů v čase končí, protože se změní v něco jiného:
  //
  //  - **akontace** koupí. Pak je zaplacená a odkládá se místo ní splátka,
  //    která je už mezi výdaji. Stejně to počítá `budgetAfterPurchase`.
  //  - **rezerva na dítě** narozením. Do té doby je to odkládání stranou;
  //    od narození se dítě platí doopravdy a jeho náklad podle věku je
  //    v `expenses`. Kdyby se počítalo obojí, platila by domácnost za dítě
  //    dvakrát: 11 333 Kč jako cíl a k tomu 6 426 Kč jako výdaj. Stuha pak
  //    hlásila napjatý rozpočet od narození dítěte i tam, kde ve
  //    skutečnosti vycházel.
  const alloc = opts.allocations ?? calculateDefaultAllocations(state);
  const customTotal = alloc.custom.reduce((sum, v) => sum + v, 0);
  const goalsAlways = alloc.retirement + customTotal;

  const points: WealthPoint[] = [];
  let cash = state.savings.totalSavings;
  // Fond na akontaci: co je z úspor vyhrazeno teď, plus co se na ni měsíčně
  // odkládá. Kupuje se z něj, ne z celého jmění.
  let downPaymentFund = effectiveDownPayment(state);
  let purchaseMonth: number | null = null;
  let minCash = cash;
  let minCashMonth = 0;
  let firstNegativeMonth: number | null = null;

  // Nultý měsíc je výchozí stav, žádný tok se v něm ještě nestal.
  points.push({ month: 0, cash: Math.round(cash), flow: 0, flowAfterGoals: 0 });

  for (let m = 0; m < horizon; m++) {
    // Koupě: jakmile je na cílovou akontaci naspořeno (dynamicky, zohlední
    // i to, že dítě nebo rodičovská spoření zpomalí).
    if (hasProperty && purchaseMonth === null && downPaymentFund >= targetDownPayment) {
      purchaseMonth = m;
      cash -= targetDownPayment;
    }

    let income = baseIncome;
    if (leaveActive && m >= childMonth! && m < leaveEndMonth!) {
      // Dávka se během volna mění: mateřská na začátku, pak rodičovský
      // příspěvek. Plochý průměr by úbytek úspor rozložil špatně.
      income = income - parentSalary(state, pl!.parent) + benefitAtLeaveMonth(phases, m - childMonth!);
    }

    let expenses = baseExpenses;
    if (purchaseMonth !== null) expenses = expenses - rent + mortgage + ownership;
    if (childMonth !== null && m >= childMonth) expenses += childCostAt((m - childMonth) / 12);

    const flow = income - expenses;
    cash += flow;
    // Fond na akontaci roste jen do koupě a jen o vyhrazenou částku, nikdy
    // ale o víc, než kolik ten měsíc doopravdy přiteklo.
    if (purchaseMonth === null) {
      downPaymentFund += Math.max(0, Math.min(alloc.downPayment, flow));
    }

    if (cash < minCash) {
      minCash = cash;
      minCashMonth = m + 1;
    }
    if (cash < 0 && firstNegativeMonth === null) firstNegativeMonth = m + 1;

    const goals = goalsAlways
      + (purchaseMonth === null ? alloc.downPayment : 0)
      + (childMonth !== null && m >= childMonth ? 0 : alloc.child);
    points.push({
      month: m + 1,
      cash: Math.round(cash),
      flow: Math.round(flow),
      flowAfterGoals: Math.round(flow - goals),
    });
  }

  return {
    points,
    purchaseMonth,
    childMonth,
    leaveEndMonth,
    minCash: Math.round(minCash),
    minCashMonth,
    firstNegativeMonth,
  };
}
