import type { WizardState } from '../types';
import { CHILD_COSTS_CZ } from './defaults';
import { totalMonthlyIncome, totalMonthlyExpenses } from './cashflow';
import { monthlyMortgagePayment, requiredDownPayment, downPaymentFraction, mortgageRate, loanTermYears, ownershipCosts, totalProjectCost, effectiveDownPayment, youngestApplicantAge } from './mortgage';
import { parentSalary, leavePhases, benefitAtLeaveMonth } from './parentalLeave';
import { yearsUntilRetirement } from './savings';
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
// Konstantní částky znamenají, že **celá osa je v dnešních cenách**. Mzdy
// i výdaje rostou s inflací zhruba stejně, takže se v poměru vykrátí a to,
// co osa říká o napětí rozpočtu, platí i za dvacet let. Neplatí to o kupní
// síle naspořené částky; ta je záměrně konzervativní, protože model nulovým
// výnosem počítá s penězi na účtu, ne v akciích.
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
  /** Měsíc poslední splátky. null = v horizontu se nedoplatí (nebo se nekupuje). */
  mortgagePaidOffMonth: number | null;
  minCash: number;
  minCashMonth: number;
  firstNegativeMonth: number | null;
}

/** Nejkratší rozumný pohled: pod deset let se plán na bydlení nevejde. */
export const MIN_HORIZON_MONTHS = 120;
/** Nejdelší. Chrání osu před nesmyslně zadaným věkem (třeba 5 let). */
export const MAX_HORIZON_MONTHS = 480;

/**
 * Jak daleko má smysl plán kreslit.
 *
 * Deset let byl původní horizont a na otázku „mám na bydlení" stačil.
 * Jenže hypotéka se bere na 15 až 30 let a důchod je ještě dál, takže se
 * osa uzavírala dřív, než se stalo cokoli z toho, na co si člověk spoří:
 * doplacení hypotéky, odrostlé dítě, konec výdělku. Graf „koupě vs. nájem"
 * přitom už dávno počítal třicet let a důchodová projekce do 65, takže si
 * appka sama se sebou odporovala v tom, jak daleko dohlédne.
 *
 * Horizont proto sahá k odchodu do důchodu: tam plán opravdu končí a tam
 * ho přebírá důchodová projekce. Dál by osa musela umět rentu místo mzdy,
 * což je jiná úloha než tahle.
 */
export function planHorizonMonths(state: WizardState): number {
  const age = youngestApplicantAge(state);
  const months = yearsUntilRetirement(age) * 12;
  return Math.min(MAX_HORIZON_MONTHS, Math.max(MIN_HORIZON_MONTHS, months));
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
  const horizon = opts.months ?? planHorizonMonths(state);
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
  // Doplacení se odvozuje od koupě, ne od nuly: kdo kupuje za tři roky,
  // doplácí o tři roky později.
  let mortgagePaidOffMonth: number | null = null;
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
      const payoff = m + term * 12;
      if (payoff <= horizon) mortgagePaidOffMonth = payoff;
    }

    let income = baseIncome;
    if (leaveActive && m >= childMonth! && m < leaveEndMonth!) {
      // Dávka se během volna mění: mateřská na začátku, pak rodičovský
      // příspěvek. Plochý průměr by úbytek úspor rozložil špatně.
      income = income - parentSalary(state, pl!.parent) + benefitAtLeaveMonth(phases, m - childMonth!);
    }

    let expenses = baseExpenses;
    if (purchaseMonth !== null) {
      // Po poslední splátce zůstávají jen náklady na vlastnictví. Bez tohohle
      // kroku splácela domácnost na dlouhém horizontu hypotéku i patnáct let
      // poté, co ji měla doplacenou, a osa zamlčela největší skok v rozpočtu
      // za celý plán. Do desetiletého okna se to nevešlo, protože nejkratší
      // volitelná hypotéka je patnáctiletá.
      const repaid = mortgagePaidOffMonth !== null && m >= mortgagePaidOffMonth;
      expenses = expenses - rent + (repaid ? 0 : mortgage) + ownership;
    }
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
    mortgagePaidOffMonth,
    minCash: Math.round(minCash),
    minCashMonth,
    firstNegativeMonth,
  };
}
