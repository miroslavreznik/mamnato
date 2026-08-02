import type { WizardState } from '../types';
import { wealthTimeline, planHorizonMonths } from './wealthTimeline';
import type { WealthPoint } from './wealthTimeline';
import { necessaryMonthlyExpenses, totalMonthlyIncome } from './cashflow';
import { necessaryExpensesAfterPurchase } from './mortgage';
import type { GoalAllocations } from './allocation';
import { czk, czkMonthly, formatMonths } from './format';
import { plannedChildren } from './childCost';

/**
 * Podklad pro časovou osu v Přehledu: život jako jeden příběh.
 *
 * Engine to počítá, ne komponenta. Platí to i pro věty („Nejtěsnější bude rok
 * 2029"), protože formulace verdiktů patří sem, kde k nim jdou napsat testy.
 * Sama matematika je stará, jen se jinak čte: všechno vychází z `wealthTimeline`.
 */

/** Jak napjatý je rozpočet v daném měsíci. Podle toho se barví stuha. */
export type Tension = 'calm' | 'tense' | 'deficit';

export interface JourneyEvent {
  key: 'purchase' | 'child' | 'leaveEnd' | 'payoff' | 'lowest';
  month: number;
  label: string;
  /** Popisek k puntíku, když je na něj místo. */
  detail?: string;
}

export interface TightestPoint {
  month: number;
  /** „Rodičovská 2029", „Po koupi 2031". Nadpis karty. */
  title: string;
  /** Věta, co se v tu chvíli děje a co pomůže. */
  explanation: string;
  tension: Tension;
}

export interface Journey {
  points: WealthPoint[];
  /** Napětí rozpočtu pro každý bod, ve stejném pořadí jako `points`. */
  tension: Tension[];
  /**
   * Totéž spojitě, 0 (pohodlně) až 1 (hluboký schodek). Podle toho se stuha
   * barví, aby přechod nebyl skokový; `tension` z toho jde odvodit
   * (`< 0,5` je klid, `< 0,75` napětí, výš schodek).
   */
  severity: number[];
  events: JourneyEvent[];
  minCash: number;
  minCashMonth: number;
  firstNegativeMonth: number | null;
  tightest: TightestPoint | null;
  horizonMonths: number;
  /** Nejdřívější možný měsíc koupě, tedy mez pro posun události po ose. */
  earliestPurchaseMonth: number | null;
}

/**
 * Rok, ve kterém daný měsíc padne. Osa je od „teď", takže se počítá
 * od letošního roku; přesné datum by budilo dojem přesnosti, kterou model nemá.
 */
const yearOf = (month: number) => new Date().getFullYear() + Math.floor(month / 12);

/**
 * Hranice, od kterých se rozpočet počítá za napjatý.
 *
 * Jsou tři a každá popisuje jinou tíseň, proto jdou pohromadě: stuha i karta
 * nejtěsnějšího místa musí soudit podle týchž čísel, jinak si obrázek
 * a věta pod ním začnou odporovat.
 */
interface TensionLimits {
  /**
   * Měsíc nezbytných výdajů. Pod tím rezerva neunese nic nečekaného.
   *
   * Po koupi je to jiné číslo: splátka bývá skoro dvojnásobek nájmu. Proto
   * jsou dvě a vybírá se podle měsíce; se starou jedinou hodnotou tvrdila
   * karta u nejnižšího bodu „151 312 Kč, což je 5 měsíců nezbytných výdajů"
   * a dlaždice vedle ní „rezerva po koupi vydrží 2,8 měsíce".
   */
  oneMonthOfExpenses: number;
  oneMonthAfterPurchase: number;
  /** Od kdy platí ta druhá. null = v horizontu se nekupuje. */
  purchaseMonth: number | null;
  /**
   * Od kolika se schodek na cílech počítá za napětí.
   *
   * Bez prahu obarvila stuha třetinu horizontu jantarovou kvůli sedmnácti
   * korunám a karta u ní hlásila poplach. Rozdíl v řádu desetikorun je
   * zaokrouhlení, ne problém. Práh je relativní, aby dával stejný smysl
   * u příjmu 30 000 i 150 000 Kč, se spodní hranicí pro velmi nízké příjmy.
   */
  goalShortfall: number;
  /**
   * Pod kolik je i kladný tok jen tak tak.
   *
   * Model napětí znal schodek, chybějící rezervu a nefinancované cíle, ale
   * neznal „tenký, i když kladný tok". Rodina, které po narození dítěte
   * zbývalo 1 253 Kč měsíčně, měla proto tři roky klidnou zelenou stuhu
   * a kartu „plán drží po celou dobu". Drží, ale o vlásek: tisícikoruna je
   * jedna návštěva servisu.
   *
   * Práh je z čistého příjmu, ne z výdajů: říká „kolik z toho, co domácnost
   * vydělá, jí zbývá", což je stejná otázka u nájemníka i u vlastníka.
   */
  thinFlow: number;
}

function tensionLimits(state: WizardState, purchaseMonth: number | null): TensionLimits {
  const income = totalMonthlyIncome(state);
  return {
    oneMonthOfExpenses: necessaryMonthlyExpenses(state),
    oneMonthAfterPurchase: necessaryExpensesAfterPurchase(state),
    purchaseMonth,
    goalShortfall: Math.max(200, income * 0.01),
    thinFlow: Math.max(1000, income * 0.05),
  };
}

/** Kolik stojí měsíc nezbytných výdajů v daném měsíci plánu. */
function monthOfExpensesAt(month: number, limits: TensionLimits): number {
  return limits.purchaseMonth !== null && month >= limits.purchaseMonth
    ? limits.oneMonthAfterPurchase
    : limits.oneMonthOfExpenses;
}

/**
 * Napětí rozpočtu v daném měsíci.
 *
 * Schodek je schodek: měsíc, kdy výdaje přerostou příjem. Napjato je, když
 * sice tok vychází, ale jen tak tak: buď úspory nepokryjí ani měsíc
 * nezbytných výdajů, nebo nezbývá na cíle, nebo nezbývá skoro nic.
 * Zbytek je klid.
 *
 * Rozhoduje tok, ne zůstatek. Rok se schodkem vypadá na křivce zůstatku
 * stejně jako rok bez něj, dokud jsou úspory dost velké, a právě to je věc,
 * kterou má stuha ukázat dřív, než dojdou.
 */
function tensionAt(point: WealthPoint, limits: TensionLimits): Tension {
  const oneMonth = monthOfExpensesAt(point.month, limits);
  // Nultý měsíc je výchozí stav, žádný tok se v něm nestal. Nulu z něj nesmí
  // nikdo číst jako „nic nezbývá".
  if (point.month === 0) return point.cash < oneMonth ? 'tense' : 'calm';
  // Schodek je jen skutečný schodek: víc odteče, než přiteče, a rozdíl se
  // bere z úspor.
  if (point.flow < 0) return 'deficit';
  // Napětí má tři důvody a všechny znamenají „unese to jen za dobrého počasí":
  // buď nejsou úspory ani na měsíc, nebo na cíle nezbývá, nebo nezbývá vůbec nic.
  //
  // Ten prostřední tu dřív nebyl a stuha kvůli tomu odporovala nadpisu nad sebou.
  // Verdikt hlásil „po koupi by na cíle chybělo 924 Kč měsíčně" a stuha pod
  // ním byla celou dobu klidná zelená, protože počítala s tokem, ve kterém
  // cíle vůbec nejsou.
  if (point.cash < oneMonth) return 'tense';
  if (point.flowAfterGoals < -limits.goalShortfall) return 'tense';
  if (point.flow < limits.thinFlow) return 'tense';
  return 'calm';
}

/**
 * Co se v daném měsíci děje. Slouží jako nadpis karty.
 *
 * Bere se poslední událost, která už nastala, ale jen dokud je čerstvá:
 * „Po koupi 2042" u schodku patnáct let po koupi je popisek, který lže
 * o příčině.
 *
 * Rodičovská se pozná podle toho, že v tu chvíli opravdu běží, ne podle
 * toho, že se někdy předtím narodilo dítě. Bez toho dostal schodek
 * z nákladů na patnáctiletého potomka nadpis „Rodičovská 2042", a to
 * i tam, kde uživatel žádnou rodičovskou vůbec nezadal.
 *
 * `Rozpočet` znamená „nic zvláštního se neděje, je to prostě takhle
 * nastavené"; volající si podle toho volí jiný nadpis.
 */
function whatHappensAt(month: number, events: JourneyEvent[]): 'Rodičovská' | 'Po koupi' | 'Rozpočet' {
  const RECENT_MONTHS = 24;
  const before = events
    .filter((e) => e.key !== 'lowest' && e.month <= month)
    .sort((a, b) => b.month - a.month)[0];

  const child = events.find((e) => e.key === 'child');
  const leaveEnd = events.find((e) => e.key === 'leaveEnd');
  if (child !== undefined && leaveEnd !== undefined
    && month >= child.month && month < leaveEnd.month) return 'Rodičovská';

  const recent = before !== undefined && month - before.month <= RECENT_MONTHS;
  if (recent && before?.key === 'purchase') return 'Po koupi';
  return 'Rozpočet';
}

/**
 * Jak moc to skřípe, spojitě od 0 do 1.
 *
 * Tři stavy stačí na větu („napjato", „schodek"), ale ne na obrázek. Stuha
 * s nimi měnila barvu skokem: dva roky stejná zelená, pak hrana a jantarová.
 * Přitom rozpočet se nemění skokem, ale postupně, a právě ten pohyb je na
 * časové ose to nejzajímavější: kde se to začíná zhoršovat a kde už se to
 * zase zvedá.
 *
 * Škála je **ukotvená ve stejných prazích jako `tensionAt`**, aby si barva
 * a věta pod ní nemohly odporovat:
 *
 * - `0 až 0,5` je klid. Nula je pohodlný polštář (tok přes trojnásobek prahu
 *   a rezerva přes půl roku), k půlce se blíží ten, komu do napětí zbývá už
 *   jen kousek.
 * - `0,5 až 0,75` je napětí, tedy tatáž tři pravidla co ve `tensionAt`.
 * - `0,75 až 1` je schodek, tím hlubší, čím větší díra proti měsíčním výdajům.
 *
 * Díky tomu platí: `severity < 0,5` právě když je `tension === 'calm'`.
 * Barva se tak hýbe plynule, ale nikdy nepřeteče do pásma, které stav nemá.
 */
function severityAt(point: WealthPoint, limits: TensionLimits): number {
  const oneMonth = Math.max(1, monthOfExpensesAt(point.month, limits));

  // Nultý měsíc je výchozí stav, žádný tok se v něm nestal; posuzuje se
  // jen podle toho, s čím domácnost začíná.
  if (point.month === 0) {
    return point.cash < oneMonth
      ? 0.5 + 0.25 * (1 - Math.max(0, point.cash) / oneMonth)
      : 0.5 * (1 - Math.min(1, point.cash / (6 * oneMonth)));
  }

  if (point.flow < 0) {
    return 0.75 + 0.25 * Math.min(1, Math.abs(point.flow) / oneMonth);
  }

  // Napětí: bere se ten nejnaléhavější z důvodů, stejně jako ve `tensionAt`.
  const tense: number[] = [];
  if (point.cash < oneMonth) tense.push(1 - Math.max(0, point.cash) / oneMonth);
  if (point.flowAfterGoals < -limits.goalShortfall) {
    tense.push(Math.min(1, Math.abs(point.flowAfterGoals) / limits.thinFlow));
  }
  if (point.flow < limits.thinFlow) tense.push(1 - point.flow / limits.thinFlow);
  if (tense.length > 0) return 0.5 + 0.25 * Math.max(...tense);

  // Klid. Čím větší polštář, tím blíž nule: rozhoduje ta horší ze dvou věcí,
  // kolik měsíčně zbývá a na kolik měsíců by vystačila rezerva.
  const headroom = Math.min(
    point.flow / (3 * limits.thinFlow),
    point.cash / (6 * oneMonth),
    1
  );
  return 0.5 * (1 - Math.max(0, headroom));
}

/**
 * Nejtěsnější místo plánu: kde to skřípe nejvíc a proč.
 *
 * Není to prostě minimum úspor. Minimum nastane skoro vždycky v okamžiku
 * koupě, protože akontace jednorázově ukrojí velkou část úspor, a to samo
 * o sobě není problém. Hledá se proto nejdřív nejhorší měsíční tok, a teprve
 * když je rozpočet celou dobu v plusu, sáhne se po nejnižším zůstatku.
 */
function findTightest(
  points: WealthPoint[],
  events: JourneyEvent[],
  minCash: number,
  minCashMonth: number,
  limits: TensionLimits
): TightestPoint | null {
  if (points.length < 2) return null;
  // Rezerva se poměřuje výdaji, které v tu chvíli platí: po koupi je měsíc
  // dražší o rozdíl mezi splátkou a nájmem.
  const oneMonthOfExpenses = monthOfExpensesAt(minCashMonth, limits);

  let worst = points[1];
  for (const p of points) {
    if (p.month > 0 && p.flow < worst.flow) worst = p;
  }

  if (worst.flow < 0) {
    const what = whatHappensAt(worst.month, events);

    // Jak hluboko úspory klesnou. **Musí to být totéž číslo, jaké nese
    // puntík „nejníž" na stuze**, jinak stojí dvě různé částky o téže věci
    // deset centimetrů od sebe. Dřív se tu měřilo minimum až od měsíce
    // schodku, aby u někoho, komu úspory jen rostou, nestálo „klesnou na
    // 200 000 Kč" o částce, ze které se vycházelo. Jenže při koupi před
    // rodičovskou vyšlo 473 063 Kč, zatímco stuha hlásila 232 690 Kč.
    //
    // Rozlišení proto nese věta, ne jiné číslo: když je nejníže hned teď,
    // říká se, že se pod dnešní stav neklesne.
    const lowest = Math.max(0, minCash);
    const fallsLater = minCashMonth > 0;
    return {
      month: worst.month,
      title: `${what} ${yearOf(worst.month)}`,
      explanation: `Rozpočet by byl ${czkMonthly(Math.abs(worst.flow))} v mínusu. `
        + (minCash < 0
          ? 'Úspory to nepokryjí, plán v této podobě neprojde.'
          : fallsLater
            ? `Úspory to pokryjí, nejníže klesnou na ${czk(lowest)}.`
            : `Úspory to pokryjí a pod dnešních ${czk(lowest)} se nedostanou.`),
      tension: 'deficit',
    };
  }

  // Odsud se hledá důvod k napětí, od nejvážnějšího. Rezerva má přednost
  // před cíli: „nemáte ani na měsíc" je jiná zpráva než „nespoříte, kolik
  // jste chtěli", i když obojí barví stuhu stejně.
  const runwayAt = (cash: number) =>
    oneMonthOfExpenses > 0 ? cash / oneMonthOfExpenses : Infinity;

  // Úspory jen rostou a nejnižší bod je start. Říct „úspory klesnou na"
  // by byla lež: nic neklesalo, jen se ještě nic nenaspořilo. Nejtěsnější
  // je pak opravdu teď, a to je jiné sdělení než „někdy v budoucnu to bude
  // zlé".
  if (minCash < oneMonthOfExpenses) {
    return minCashMonth === 0
      ? {
        month: 0,
        title: 'Nejtěsnější je teď',
        explanation: `Úspory ${czk(Math.max(0, minCash))} nepokryjí ani měsíc nezbytných výdajů. `
          + 'Odsud už jen rostou, ale do té doby rozpočet neunese nic nečekaného.',
        tension: 'tense',
      }
      : {
        month: minCashMonth,
        title: `Nejníže ${yearOf(minCashMonth)}`,
        explanation: `Úspory klesnou na ${czk(Math.max(0, minCash))}, tedy pod jeden měsíc nezbytných výdajů. `
          + 'Rozpočet sice vychází, ale první nečekaná událost ho rozhodí.',
        tension: 'tense',
      };
  }

  // Rezerva je v pohodě a schodek nikde. Zbývá poslední důvod k napětí,
  // který stuha barví: nezbývá na cíle.
  //
  // Bez tohohle kroku si karta a stuha přímo odporovaly. Karta hlásila
  // „plán drží po celou dobu" a stuha vedle ní byla poslední tři roky
  // jantarová, protože náklady na dítě mezitím přerostly to, co na cíle
  // zbývalo.
  let leanest = points[1];
  for (const p of points) {
    if (p.month > 0 && p.flowAfterGoals < leanest.flowAfterGoals) leanest = p;
  }
  if (leanest.flowAfterGoals < -limits.goalShortfall) {
    return {
      month: leanest.month,
      title: `Nejtěsněji ${yearOf(leanest.month)}`,
      explanation: 'Rozpočet vychází a úspory rostou, ale na cíle by chybělo '
        + `${czkMonthly(Math.abs(leanest.flowAfterGoals))}. `
        + 'Buď se na ně bude odkládat míň, nebo je potřeba ubrat jinde.',
      tension: 'tense',
    };
  }

  // Poslední důvod: rozpočet vyjde, cíle se ufinancují, rezerva je, a přesto
  // zbývá tak málo, že tam není prostor na nic.
  //
  // Tohle byla poslední věta, která si se stuhou odporovala: rodina jela
  // tři roky na 1 253 Kč měsíčně a karta u toho hlásila „plán drží po celou
  // dobu". Drží, ale to není totéž jako „je to v pohodě".
  if (worst.flow < limits.thinFlow) {
    const what = whatHappensAt(worst.month, events);
    return {
      month: worst.month,
      title: what === 'Rozpočet' ? `Nejtěsněji ${yearOf(worst.month)}` : `${what} ${yearOf(worst.month)}`,
      explanation: `Rozpočet vyjde, ale zbyde jen ${czkMonthly(worst.flow)}. `
        + 'Odkládat se v tu dobu skoro nedá a nečekaný výdaj musí z úspor.',
      tension: 'tense',
    };
  }

  if (minCashMonth === 0) {
    return {
      month: 0,
      title: 'Nejtěsnější je teď',
      explanation: `Úspory ${czk(Math.max(0, minCash))} pokryjí ${formatMonths(runwayAt(minCash))} nezbytných výdajů `
        + 'a odsud už jen rostou.',
      tension: 'calm',
    };
  }

  // Rozpočet drží celou dobu. „Nejtěsnější místo" pak není varování,
  // ale informace, kde je plán nejblíž ke hraně.
  return {
    month: minCashMonth,
    title: `Nejníže ${yearOf(minCashMonth)}`,
    explanation: `Úspory klesnou na ${czk(Math.max(0, minCash))}, což je ${formatMonths(runwayAt(minCash))} nezbytných výdajů. `
      + 'Plán drží po celou dobu.',
    tension: 'calm',
  };
}

/**
 * Co z cesty zůstane mimo zobrazený úsek.
 *
 * Bez tohohle by si zkrácený výřez a karta vedle něj odporovaly: stuha
 * v deseti letech klidně zelená, a karta u ní „Po koupi 2042, rozpočet by
 * byl v mínusu". Výřez je způsob dívání, ne jiný plán, takže když se něco
 * podstatného ořízne, musí to být napsané.
 *
 * Napjaté místo má přednost před událostmi: „za výřezem to skřípe" je jiná
 * zpráva než „za výřezem doplatíte hypotéku".
 */
export function beyondView(j: Journey, viewMonths: number): string | null {
  if (viewMonths >= j.horizonMonths) return null;

  const t = j.tightest;
  if (t && t.month > viewMonths && t.tension !== 'calm') {
    return `Za zobrazeným úsekem plán ještě něco čeká: ${t.title}. ${t.explanation}`;
  }

  const later = j.events.filter((e) => e.key !== 'lowest' && e.month > viewMonths);
  if (later.length === 0) return null;
  const names = later.map((e) => e.detail ?? e.label);
  const list = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} a ${names.at(-1)}`;
  return `Za zobrazeným úsekem časová osa pokračuje: ${list.toLowerCase()}.`;
}

export function journey(
  state: WizardState,
  opts: {
    months?: number;
    childOffsetMonths?: number;
    /** Odklad koupě. Viz `wealthTimeline`. */
    purchaseNotBeforeMonth?: number;
    /** Kolik měsíčně jde na cíle. Viz `wealthTimeline`. */
    allocations?: GoalAllocations;
  } = {}
): Journey {
  const horizonMonths = opts.months ?? planHorizonMonths(state);
  const tl = wealthTimeline(state, { ...opts, months: horizonMonths });

  const limits = tensionLimits(state, tl.purchaseMonth);
  const tension = tl.points.map((p) => tensionAt(p, limits));
  const severity = tl.points.map((p) => severityAt(p, limits));

  const events: JourneyEvent[] = [];
  if (tl.purchaseMonth !== null) {
    events.push({ key: 'purchase', month: tl.purchaseMonth, label: 'Koupě', detail: 'Koupě bydlení' });
  }
  if (tl.childMonth !== null) {
    // Popisek jde za počtem dětí v plánu. Číslo se propisovalo do nákladů
    // i do osy, ale puntík na ní se pořád jmenoval „Dítě".
    const many = plannedChildren(state) > 1;
    events.push({
      key: 'child',
      month: tl.childMonth,
      label: many ? 'Děti' : 'Dítě',
      detail: many ? 'Děti a rodičovská' : 'Dítě a rodičovská',
    });
  }
  if (tl.leaveEndMonth !== null && tl.leaveEndMonth <= horizonMonths) {
    events.push({ key: 'leaveEnd', month: tl.leaveEndMonth, label: 'Konec rodičovské' });
  }
  if (tl.mortgagePaidOffMonth !== null) {
    events.push({
      key: 'payoff',
      month: tl.mortgagePaidOffMonth,
      label: 'Splaceno',
      detail: 'Hypotéka splacena',
    });
  }
  events.sort((a, b) => a.month - b.month);

  const tightest = findTightest(tl.points, events, tl.minCash, tl.minCashMonth, limits);

  // Nejnižší bod je událost až nakonec, aby nepřebil koupi a dítě v pořadí.
  // Kreslí se jinak (menší puntík, popisek pod osou), proto má vlastní klíč.
  events.push({
    key: 'lowest',
    month: tl.minCashMonth,
    label: `nejníž ${czk(Math.max(0, tl.minCash))}`,
  });

  return {
    points: tl.points,
    tension,
    severity,
    events,
    minCash: tl.minCash,
    minCashMonth: tl.minCashMonth,
    firstNegativeMonth: tl.firstNegativeMonth,
    tightest,
    horizonMonths,
    earliestPurchaseMonth: tl.earliestPurchaseMonth,
  };
}
