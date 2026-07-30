import type { WizardState } from '../types';
import { wealthTimeline, planHorizonMonths } from './wealthTimeline';
import type { WealthPoint } from './wealthTimeline';
import { necessaryMonthlyExpenses, totalMonthlyIncome } from './cashflow';
import type { GoalAllocations } from './allocation';
import { czk, czkMonthly, formatMonths } from './format';

/**
 * Podklad pro záložku Cesta: časová osa života jako jeden příběh.
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
  events: JourneyEvent[];
  minCash: number;
  minCashMonth: number;
  firstNegativeMonth: number | null;
  tightest: TightestPoint | null;
  horizonMonths: number;
}

/**
 * Rok, ve kterém daný měsíc padne. Osa je od „teď", takže se počítá
 * od letošního roku; přesné datum by budilo dojem přesnosti, kterou model nemá.
 */
const yearOf = (month: number) => new Date().getFullYear() + Math.floor(month / 12);

/**
 * Napětí rozpočtu v daném měsíci.
 *
 * Schodek je schodek: měsíc, kdy výdaje přerostou příjem. Napjato je, když
 * sice tok vychází, ale úspory nepokryjí ani měsíc nezbytných výdajů, takže
 * první nečekaná událost plán rozhodí. Zbytek je klid.
 *
 * Rozhoduje tok, ne zůstatek. Rok se schodkem vypadá na křivce zůstatku
 * stejně jako rok bez něj, dokud jsou úspory dost velké, a právě to je věc,
 * kterou má stuha ukázat dřív, než dojdou.
 */
/**
 * Od kolika se schodek na cílech počítá za napětí.
 *
 * Bez prahu obarvila stuha třetinu horizontu jantarovou kvůli sedmnácti
 * korunám a karta u ní hlásila poplach. Rozdíl v řádu desetikorun je
 * zaokrouhlení, ne problém. Práh je relativní, aby dával stejný smysl
 * u příjmu 30 000 i 150 000 Kč, se spodní hranicí pro velmi nízké příjmy.
 */
function goalShortfallTolerance(state: WizardState): number {
  return Math.max(200, totalMonthlyIncome(state) * 0.01);
}

function tensionAt(point: WealthPoint, oneMonthOfExpenses: number, tolerance: number): Tension {
  // Schodek je jen skutečný schodek: víc odteče, než přiteče, a rozdíl se
  // bere z úspor.
  if (point.flow < 0) return 'deficit';
  // Napětí má dva důvody a oba znamenají „unese to jen za dobrého počasí":
  // buď nejsou úspory ani na měsíc, nebo na cíle nezbývá.
  //
  // Ten druhý tu dřív nebyl a stuha kvůli tomu odporovala nadpisu nad sebou.
  // Verdikt hlásil „po koupi by na cíle chybělo 924 Kč měsíčně" a stuha pod
  // ním byla celou dobu klidná zelená, protože počítala s tokem, ve kterém
  // cíle vůbec nejsou.
  if (point.cash < oneMonthOfExpenses) return 'tense';
  if (point.flowAfterGoals < -tolerance) return 'tense';
  return 'calm';
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
  oneMonthOfExpenses: number,
  tolerance: number
): TightestPoint | null {
  if (points.length < 2) return null;

  let worst = points[1];
  for (const p of points) {
    if (p.month > 0 && p.flow < worst.flow) worst = p;
  }

  // Co se v tu chvíli děje. Bere se poslední událost, která už nastala,
  // ale jen dokud je čerstvá: „Po koupi 2042" u schodku patnáct let po
  // koupi je popisek, který lže o příčině.
  const RECENT_MONTHS = 24;
  const before = events
    .filter((e) => e.key !== 'lowest' && e.month <= worst.month)
    .sort((a, b) => b.month - a.month)[0];

  if (worst.flow < 0) {
    // Rodičovská se pozná podle toho, že v tu chvíli opravdu běží, ne podle
    // toho, že se někdy předtím narodilo dítě. Bez toho dostal schodek
    // z nákladů na patnáctiletého potomka nadpis „Rodičovská 2042“, a to
    // i tam, kde uživatel žádnou rodičovskou vůbec nezadal.
    const child = events.find((e) => e.key === 'child');
    const leaveEnd = events.find((e) => e.key === 'leaveEnd');
    const onLeave = child !== undefined && leaveEnd !== undefined
      && worst.month >= child.month && worst.month < leaveEnd.month;
    const recent = before !== undefined && worst.month - before.month <= RECENT_MONTHS;
    const what = onLeave ? 'Rodičovská'
      : recent && before?.key === 'purchase' ? 'Po koupi'
        : 'Rozpočet';

    // Jak hluboko úspory kvůli tomuhle schodku klesnou. Musí se měřit až od
    // něj: globální minimum bývá na startu, takže u někoho, komu úspory celou
    // dobu jen rostou, stálo „klesnou na 200 000 Kč“ o částce, ze které se
    // vycházelo a která nikdy neklesla.
    const lowAfter = Math.min(...points.filter((p) => p.month >= worst.month).map((p) => p.cash));
    return {
      month: worst.month,
      title: `${what} ${yearOf(worst.month)}`,
      explanation: `Rozpočet by byl ${czkMonthly(Math.abs(worst.flow))} v mínusu. `
        + (lowAfter < 0
          ? 'Úspory to nepokryjí, plán v této podobě neprojde.'
          : `Úspory to pokryjí, ale klesnou na ${czk(lowAfter)}.`),
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
  if (leanest.flowAfterGoals < -tolerance) {
    return {
      month: leanest.month,
      title: `Nejtěsněji ${yearOf(leanest.month)}`,
      explanation: 'Rozpočet vychází a úspory rostou, ale na cíle by chybělo '
        + `${czkMonthly(Math.abs(leanest.flowAfterGoals))}. `
        + 'Buď se na ně bude odkládat míň, nebo je potřeba ubrat jinde.',
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
  return `Za zobrazeným úsekem cesta pokračuje: ${list.toLowerCase()}.`;
}

export function journey(
  state: WizardState,
  opts: {
    months?: number;
    childOffsetMonths?: number;
    /** Kolik měsíčně jde na cíle. Viz `wealthTimeline`. */
    allocations?: GoalAllocations;
  } = {}
): Journey {
  const horizonMonths = opts.months ?? planHorizonMonths(state);
  const tl = wealthTimeline(state, { ...opts, months: horizonMonths });
  const oneMonthOfExpenses = necessaryMonthlyExpenses(state);

  const tolerance = goalShortfallTolerance(state);
  const tension = tl.points.map((p) => tensionAt(p, oneMonthOfExpenses, tolerance));

  const events: JourneyEvent[] = [];
  if (tl.purchaseMonth !== null) {
    events.push({ key: 'purchase', month: tl.purchaseMonth, label: 'Koupě', detail: 'Koupě bydlení' });
  }
  if (tl.childMonth !== null) {
    events.push({ key: 'child', month: tl.childMonth, label: 'Dítě', detail: 'Dítě a rodičovská' });
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

  const tightest = findTightest(
    tl.points, events, tl.minCash, tl.minCashMonth, oneMonthOfExpenses, tolerance
  );

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
    events,
    minCash: tl.minCash,
    minCashMonth: tl.minCashMonth,
    firstNegativeMonth: tl.firstNegativeMonth,
    tightest,
    horizonMonths,
  };
}
