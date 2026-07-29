import type { WizardState } from '../types';
import { wealthTimeline } from './wealthTimeline';
import type { WealthPoint } from './wealthTimeline';
import { necessaryMonthlyExpenses } from './cashflow';
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
  key: 'purchase' | 'child' | 'leaveEnd' | 'lowest';
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
function tensionAt(point: WealthPoint, oneMonthOfExpenses: number): Tension {
  if (point.flow < 0) return 'deficit';
  if (point.cash < oneMonthOfExpenses) return 'tense';
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
  oneMonthOfExpenses: number
): TightestPoint | null {
  if (points.length < 2) return null;

  let worst = points[1];
  for (const p of points) {
    if (p.month > 0 && p.flow < worst.flow) worst = p;
  }

  // Co se v tu chvíli děje. Bere se poslední událost, která už nastala:
  // schodek během rodičovské se jmenuje po rodičovské, ne po koupi před ní.
  const before = events
    .filter((e) => e.key !== 'lowest' && e.month <= worst.month)
    .sort((a, b) => b.month - a.month)[0];

  if (worst.flow < 0) {
    const what = before?.key === 'child' || before?.key === 'leaveEnd' ? 'Rodičovská' :
      before?.key === 'purchase' ? 'Po koupi' : 'Rozpočet';
    return {
      month: worst.month,
      title: `${what} ${yearOf(worst.month)}`,
      explanation: `Rozpočet by byl ${czkMonthly(Math.abs(worst.flow))} v mínusu. `
        + (minCash < 0
          ? 'Úspory to nepokryjí, plán v této podobě neprojde.'
          : `Úspory to pokryjí, ale klesnou na ${czk(Math.max(0, minCash))}.`),
      tension: 'deficit',
    };
  }

  // Úspory jen rostou a nejnižší bod je start. Říct „úspory klesnou na"
  // by byla lež: nic neklesalo, jen se ještě nic nenaspořilo. Nejtěsnější
  // je pak opravdu teď, a to je jiné sdělení než „někdy v budoucnu to bude
  // zlé".
  if (minCashMonth === 0) {
    const runway = oneMonthOfExpenses > 0 ? minCash / oneMonthOfExpenses : Infinity;
    return {
      month: 0,
      title: 'Nejtěsnější je teď',
      explanation: minCash < oneMonthOfExpenses
        ? `Úspory ${czk(Math.max(0, minCash))} nepokryjí ani měsíc nezbytných výdajů. `
          + 'Odsud už jen rostou, ale do té doby rozpočet neunese nic nečekaného.'
        : `Úspory ${czk(Math.max(0, minCash))} pokryjí ${formatMonths(runway)} nezbytných výdajů `
          + 'a odsud už jen rostou.',
      tension: minCash < oneMonthOfExpenses ? 'tense' : 'calm',
    };
  }

  if (minCash < oneMonthOfExpenses) {
    return {
      month: minCashMonth,
      title: `Nejníže ${yearOf(minCashMonth)}`,
      explanation: `Úspory klesnou na ${czk(Math.max(0, minCash))}, tedy pod jeden měsíc nezbytných výdajů. `
        + 'Rozpočet sice vychází, ale první nečekaná událost ho rozhodí.',
      tension: 'tense',
    };
  }

  // Rozpočet drží celou dobu. „Nejtěsnější místo" pak není varování,
  // ale informace, kde je plán nejblíž ke hraně.
  const runway = oneMonthOfExpenses > 0 ? minCash / oneMonthOfExpenses : Infinity;
  return {
    month: minCashMonth,
    title: `Nejníže ${yearOf(minCashMonth)}`,
    explanation: `Úspory klesnou na ${czk(Math.max(0, minCash))}, což je ${formatMonths(runway)} nezbytných výdajů. `
      + 'Plán drží po celou dobu.',
    tension: 'calm',
  };
}

export function journey(
  state: WizardState,
  opts: { months?: number; childOffsetMonths?: number } = {}
): Journey {
  const horizonMonths = opts.months ?? 120;
  const tl = wealthTimeline(state, { ...opts, months: horizonMonths });
  const oneMonthOfExpenses = necessaryMonthlyExpenses(state);

  const tension = tl.points.map((p) => tensionAt(p, oneMonthOfExpenses));

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
  events.sort((a, b) => a.month - b.month);

  const tightest = findTightest(
    tl.points, events, tl.minCash, tl.minCashMonth, oneMonthOfExpenses
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
