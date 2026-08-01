import type { WizardState, CustomGoal } from '../types';
import { DEFAULTS } from './defaults';
import { monthlyDisposable, necessaryMonthlyExpenses } from './cashflow';
import {
  effectiveDownPayment,
  mortgageRate,
  loanTermYears,
  loanAmount,
  mortgagePayment,
  totalProjectCost,
  ownershipCosts,
  oldestApplicantAge,
  necessaryExpensesAfterPurchase,
} from './mortgage';

/**
 * Jak je na tom jeden vlastní cíl s částkou, kterou na něj uživatel dává.
 *
 * Dřív se místo tohohle rozděloval balík peněz mezi cíle podle pořadí
 * (`allocateGoals`). Vedle toho ale stálo pole „kolik na tento cíl měsíčně
 * dávám", které ten výpočet vůbec nebral v úvahu, takže na obrazovce stálo
 * „dávám 14 667 Kč" a hned pod tím „na tento cíl odkládáte 33 334 Kč".
 * Dvě různá pojetí téhož. Platí to, které uživatel skutečně ovládá:
 * cíl je měsíční částka jako každý jiný výdaj a otázka zní, jestli s ní
 * termín vyjde.
 */
export interface GoalProgress {
  /** Kolik by cíl potřeboval měsíčně, aby vyšel v zadaném termínu. */
  requiredMonthly: number;
  /** Za jak dlouho na něj při zadané částce dosáhnete. */
  monthsNeeded: number;
  /** Vyjde termín? */
  achievable: boolean;
  /** Kolik se při zadané částce stihne naspořit do zadaného termínu. */
  reachableAmount: number;
  /** Kolik měsíčně chybí do termínu. Nula, když vychází. */
  missingMonthly: number;
}

export function goalProgress(goal: CustomGoal, monthly: number): GoalProgress {
  const given = Math.max(0, monthly);
  const months = Math.max(0, goal.targetMonths);
  const requiredMonthly = months > 0 ? Math.ceil(goal.targetAmount / months) : Infinity;
  const monthsNeeded = given > 0 ? Math.ceil(goal.targetAmount / given) : Infinity;
  const achievable = given > 0 && months > 0 && monthsNeeded <= months;
  return {
    requiredMonthly,
    monthsNeeded,
    achievable,
    reachableAmount: given * months,
    missingMonthly: achievable || requiredMonthly === Infinity
      ? 0
      : Math.max(0, requiredMonthly - given),
  };
}

export interface InvestmentProjectionPoint {
  year: number;
  /** Hodnota nemovitosti minus zbytek úvěru plus investovaný přebytek. */
  propertyNetWorth: number;
  /** Portfolio nájemníka, který rozdíl v nákladech investuje. */
  rentInvestNetWorth: number;
  /** Jmění nájemníka, který rozdíl neinvestuje: zůstane mu jen to, co měl. */
  rentNoInvestNetWorth: number;
}

export interface RetirementProjectionPoint {
  year: number;
  portfolioValue: number;
}

/**
 * Růst úspor určených na akontaci.
 *
 * `monthly` je to, co na ni uživatel opravdu odkládá. Bez něj se počítá
 * s celou disponibilní částkou, což je teoretické maximum pro toho, kdo
 * nespoří na nic jiného; jako slíbený termín by to lhalo.
 */
export function savingsProjection(
  state: WizardState,
  months: number = 120,
  monthly?: number
): Array<{ month: number; savings: number }> {
  const perMonth = monthly ?? monthlyDisposable(state);
  const initial = effectiveDownPayment(state);
  return Array.from({ length: months + 1 }, (_, i) => ({
    month: i,
    savings: initial + perMonth * i,
  }));
}

/**
 * Srovnání čistého jmění: koupě versus nájem.
 *
 * Všechny tři čáry jsou **čisté jmění**, aby se daly porovnávat. Dřív byla
 * třetí čára kumulativní útrata za nájem, tedy záporné číslo klesající
 * k milionům, což se na grafu o jmění nedalo číst.
 *
 * Model drží obě strany symetricky:
 *  - startují se stejnou částkou (vlastník ji dá do akontace, nájemník investuje),
 *  - každý měsíc platí vlastník splátku a náklady na vlastnictví, nájemník nájem,
 *  - kdo má ten měsíc nižší náklady, ten rozdíl investuje.
 *
 * Bez té symetrie graf zvýhodňoval vlastnictví: náklady na vlastnictví se
 * nepočítaly vůbec, a když nájem přerostl splátku, nájemníkovi se z portfolia
 * ubíralo, ale vlastníkovi se odpovídající úspora nikam nepřipisovala.
 */
export function investmentComparison(
  state: WizardState,
  propertyAppreciation: number = 0.03,
  sp500Return: number = 0.07,
  rentGrowth: number = 0.03,
  years: number = 30
): InvestmentProjectionPoint[] {
  const downPayment = effectiveDownPayment(state);
  const price = totalProjectCost(state);
  const rate = mortgageRate(state);
  const term = loanTermYears(state);
  const loan = loanAmount(state);
  const payment = mortgagePayment(state);
  const ownership = ownershipCosts(state);
  const monthlyRent = state.expenses.rent + state.expenses.utilities;

  const monthlyR = rate / 12;
  const monthlyReturn = sp500Return / 12;
  const totalMonths = term * 12;

  // Vlastník i nájemník mohou mít přebytek, podle toho, kdo zrovna platí míň.
  let ownerPortfolio = 0;
  let renterPortfolio = downPayment;
  let remainingLoan = loan;

  const result: InvestmentProjectionPoint[] = [];

  for (let year = 0; year <= years; year++) {
    const propertyValue = price * Math.pow(1 + propertyAppreciation, year);

    result.push({
      year,
      propertyNetWorth: Math.round(propertyValue - remainingLoan + ownerPortfolio),
      rentInvestNetWorth: Math.round(renterPortfolio),
      // Kdo rozdíl neinvestuje, tomu zůstane jen to, s čím začínal.
      rentNoInvestNetWorth: Math.round(downPayment),
    });

    for (let m = 0; m < 12; m++) {
      const monthIndex = year * 12 + m;
      if (monthIndex >= years * 12) break;
      // Splaceno se pozná podle počtu měsíců, ne podle zůstatku: po poslední
      // splátce zbývá kvůli plovoucí čárce pár miliardtin koruny, takže
      // podmínka „zůstatek > 0" by platila napořád a vlastník by splácel
      // i po splacení hypotéky.
      const repaid = monthIndex >= totalMonths;
      if (repaid) remainingLoan = 0;

      // Nájem i náklady na vlastnictví rostou stejně: obojí je běžný výdaj
      // na bydlení. Kdyby rostl jen nájem, srovnání by nadržovalo vlastnictví.
      const inflation = Math.pow(1 + rentGrowth, year);
      const currentRent = monthlyRent * inflation;
      // Po splacení hypotéky vlastník splátku neplatí. Dřív se s ní počítalo
      // i po splacení, takže u kratší hypotéky nájemník „investoval" rozdíl
      // proti splátce, která už neexistovala.
      const currentOwnerCost = (repaid ? 0 : payment) + ownership * inflation;

      const diff = currentOwnerCost - currentRent;
      ownerPortfolio = ownerPortfolio * (1 + monthlyReturn) + (diff < 0 ? -diff : 0);
      renterPortfolio = renterPortfolio * (1 + monthlyReturn) + (diff > 0 ? diff : 0);

      if (!repaid) {
        const interest = remainingLoan * monthlyR;
        remainingLoan = Math.max(0, remainingLoan - (payment - interest));
      }
    }
  }

  return result;
}

// Počet let do důchodu z věku žadatele (min. 1 rok). Když věk není znám,
// vrací výchozích 30 let.
/**
 * Kolik z dnešní kupní síly koruně zbyde za daný počet let.
 *
 * Používá se všude, kde se ukazují budoucí částky nominálně: bez tohohle
 * čísla se „o 4 809 556 Kč líp za třicet let" čte jako dnešní peníze.
 * Vzorec stál v komponentě s natvrdo zapsanou trojkou vedle
 * `DEFAULTS.averageCzInflation`, tedy dvě verze téhož předpokladu.
 */
export function purchasingPowerAfter(years: number, inflation = DEFAULTS.averageCzInflation): number {
  return 1 / Math.pow(1 + inflation, years);
}

export function yearsUntilRetirement(age: number | undefined): number {
  if (age === undefined || age <= 0) return 30;
  return Math.max(1, Math.round(DEFAULTS.retirementAge - age));
}

/**
 * Čí věk rozhoduje o tom, kdy plán končí a kolik let zbývá do důchodu.
 *
 * **Starší z dvojice.** Model počítá se mzdou po celý horizont a rentu neumí,
 * takže dál než k prvnímu odchodu do důchodu nedohlédne: od té chvíle by
 * jeden příjem musel nahradit důchod, a to je jiná úloha. U páru 55 a 30 let
 * by mladší věk sliboval pětatřicet let dvou platů, z toho pětadvacet po tom,
 * co jeden z nich přestane chodit do práce.
 *
 * Je to jedno místo pro celou appku: horizont časové osy, věta o rentě
 * v Přehledu i pole „počet let do důchodu" v Důchodu. Dřív si horizont bral
 * mladšího a projekce renty `person1Age`, takže na jedné obrazovce stálo
 * „plán na 35 let" a „do důchodu 31 let" o téže domácnosti.
 */
export function retirementAge(state: WizardState): number | undefined {
  return oldestApplicantAge(state);
}

/**
 * Pravidlo bezpečného výběru: kolik ročně jde z portfolia brát, aniž by
 * došlo. Čtyři procenta jsou obvyklá orientační hodnota.
 *
 * Je to jedna konstanta, protože se používá na dvou stranách téže věty:
 * v cíli renty („kolik potřebujete naspořit") i v odhadu renty („kolik vám
 * to bude vynášet"). Se dvěma zápisy by si mohly protiřečit.
 */
export const SAFE_WITHDRAWAL_RATE = 0.04;

// Cílová hodnota portfolia pro požadovanou měsíční rentu dle pravidla bezpečného výběru.
// Při 4 % ročně: portfolio × 0,04 = roční renta → portfolio = měsíční renta × 12 / 0,04 (= × 300).
export function fourPercentTarget(monthlyIncome: number, withdrawalRate: number = SAFE_WITHDRAWAL_RATE): number {
  if (withdrawalRate <= 0) return Infinity;
  return (monthlyIncome * 12) / withdrawalRate;
}

// První rok, kdy hodnota portfolia dosáhne cílové částky; null pokud v horizontu nedosaženo.
export function yearOfReachingTarget(
  projection: RetirementProjectionPoint[],
  target: number
): number | null {
  const point = projection.find((p) => p.portfolioValue >= target);
  return point ? point.year : null;
}

/**
 * Kolik z dnešních úspor lze považovat za základ důchodového portfolia.
 *
 * Odečítá se dvojí: co je vázané v akontaci (ty peníze skončí v nemovitosti)
 * a tříměsíční nouzová rezerva, která musí zůstat po ruce. Bez toho by se
 * tytéž peníze počítaly dvakrát, jednou jako rezerva a podruhé jako
 * investice.
 *
 * Bez tohohle základu tvrdila projekce člověku s 2 200 000 Kč naspořenými
 * a sedmi lety do důchodu, že bude mít portfolio za 745 193 Kč, protože
 * počítala jen nové vklady. Kvůli tomu vycházela renta tak nízko, že se
 * i verdikt překlápěl na „zatím spíš doplněk".
 */
/**
 * Nástroj, ze kterého počítá plán, a jeho výchozí výnos.
 *
 * Sedm procent je dlouhodobý průměr širokého akciového indexu. Je to
 * zároveň řada, kterou karta „Plán spoření na důchod" ukazuje jako první,
 * takže když si uživatel její výnos přepíše, musí se změnit i věta o rentě
 * v Přehledu; jinak by tabulka počítala portfolio při 4 % a verdikt vedle ní
 * mluvil o sedmi.
 */
export const RETIREMENT_BASIS = 'sp500';
export const DEFAULT_RETIREMENT_RETURN = 0.07;

/** Roční výnos, se kterým počítá plán. */
export function retirementReturn(state: WizardState): number {
  const manual = state.retirementRates?.[RETIREMENT_BASIS];
  return manual != null && Number.isFinite(manual) ? manual : DEFAULT_RETIREMENT_RETURN;
}

export function retirementStartingCapital(state: WizardState): number {
  // Kdo kupuje, tomu se rezerva poměřuje výdaji po koupi: splátka bývá skoro
  // dvojnásobek nájmu, takže „tři měsíce" znamenají skoro dvakrát tolik peněz.
  // S dnešními výdaji tady vycházel důchodový kapitál vyšší, než kolik po
  // odečtení opravdové rezervy zbývá, a karta „A co teď" vedle toho počítala
  // tu větší rezervu.
  const buying = state.goals.includes('property');
  const monthlyNeed = buying ? necessaryExpensesAfterPurchase(state) : necessaryMonthlyExpenses(state);
  const reserve = monthlyNeed * 3;
  const tiedInDownPayment = buying ? effectiveDownPayment(state) : 0;
  // Zaokrouhleně: je to částka do pole, ne mezivýsledek. Bez toho v něm
  // stálo „526 787,195 Kč", protože splátka hypotéky má haléře.
  return Math.round(Math.max(0, state.savings.totalSavings - tiedInDownPayment - reserve));
}

export function retirementProjection(
  monthlyContribution: number,
  years: number,
  annualReturn: number,
  inflation?: number,
  /** Co už je naspořeno a od začátku se zhodnocuje. */
  initialCapital = 0
): RetirementProjectionPoint[] {
  // Fisher equation: realReturn = (1 + nominal) / (1 + inflation) - 1
  const effectiveReturn = inflation
    ? (1 + annualReturn) / (1 + inflation) - 1
    : annualReturn;
  const monthlyReturn = effectiveReturn / 12;
  const result: RetirementProjectionPoint[] = [];
  let portfolio = Math.max(0, initialCapital);

  for (let year = 0; year <= years; year++) {
    result.push({ year, portfolioValue: Math.round(portfolio) });

    for (let m = 0; m < 12; m++) {
      if (year * 12 + m >= years * 12) break;
      portfolio = portfolio * (1 + monthlyReturn) + monthlyContribution;
    }
  }

  return result;
}
