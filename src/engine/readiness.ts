import type { WizardState } from '../types';
import type { GoalAllocations } from './allocation';
import { downPaymentGap, postPurchaseRunwayMonths } from './mortgage';
import { monthsToSaveAtAllocation } from './allocation';
import { evaluateScenario } from './scenarios';
import { retirementProjection, goalProgress, yearsUntilRetirement } from './savings';
import { evaluateParentalLeave } from './parentalLeave';
import { formatMonths, czk, czkMonthly } from './format';

/**
 * Připravenost jednotlivých cílů.
 *
 * Každý cíl se hodnotí zvlášť a vrací stav plus větu, kterou uživatel čte
 * v přehledu. Stav „nevychází" znamená, že cíl takhle nefunguje, ne že je to
 * jen napjaté; z toho pak vychází celkový verdikt, takže na tom rozlišení
 * záleží víc, než se zdá.
 */
export type GoalStatus = 'good' | 'caution' | 'warning';

// Kolik měsíců nezbytných výdajů musí zbýt v rezervě po zaplacení akontace.
// Pod touhle hranicí je koupě sice možná, ale první nečekaný výdaj
// (rozbitá pračka, výpadek příjmu) se řeší dluhem.
export const MIN_RESERVE_MONTHS_AFTER_PURCHASE = 3;

export interface GoalReadiness {
  key: string;
  label: string;
  status: GoalStatus;
  headline: string;
}

// Připravenost cíle „nemovitost", z existujícího scénáře + čísel.
//
// Bydlení je mezi cíli jako každý jiný, i když má navíc vlastní sekci
// s podrobnostmi. Dřív se ze seznamu vyřazovalo, protože se jeho čísla
// opakovala v dlaždicích nad ním; místo skrývání teď věta odpovídá na to,
// co dlaždice neříkají, tedy jestli cíl jako celek vychází.
//
// Čas na akontaci se počítá z toho, kolik na ni uživatel opravdu odkládá,
// ne z celé disponibilní částky. Jinak by přehled sliboval termín, který
// platí jen pro toho, kdo nespoří na nic jiného.
export function propertyReadiness(state: WizardState, allocations: GoalAllocations): GoalReadiness {
  const scenario = evaluateScenario(state);
  const months = monthsToSaveAtAllocation(state, allocations.downPayment);
  const gap = downPaymentGap(state);
  const statusByScenario: Record<string, GoalStatus> = {
    cannot_afford_cashflow: 'warning',
    cannot_afford_dsti: 'warning',
    no_savings: 'warning',
    tight_but_possible: 'caution',
    ready_in_1_2_years: 'caution',
    ready_now: 'good',
    very_comfortable: 'good',
  };
  let status = statusByScenario[scenario.id] ?? 'caution';

  // Rezerva po zaplacení akontace. Scénář ji nezná, protože sleduje jen
  // dostupnost hypotéky, takže bez tohohle kroku appka označila za „v pořádku"
  // i koupi, po které domácnosti nezbyde ani koruna na nečekané výdaje.
  const thinReserve = postPurchaseRunwayMonths(state) < MIN_RESERVE_MONTHS_AFTER_PURCHASE;
  if (thinReserve && status === 'good') status = 'caution';
  const reservePart = thinReserve
    ? ' Po zaplacení akontace by vám ale nezbyla rezerva na nečekané výdaje.'
    : '';

  // Konkrétní čísla (splátka, DSTI, chybějící akontace, termín) jsou
  // v dlaždicích nad tímhle seznamem. Věta u cíle na ně nesahá a odpovídá
  // na to, co dlaždice neříkají: co z těch čísel plyne pro samotný cíl.
  let headline: string;
  if (scenario.id === 'cannot_afford_cashflow') {
    headline = 'Rozpočet nevychází už dnes, takže na splátku hypotéky by nebylo z čeho.';
  } else if (scenario.id === 'cannot_afford_dsti') {
    headline = 'Splátka je nad tím, co banky obvykle schválí. Pomůže levnější nemovitost, delší splatnost nebo vyšší akontace.';
  } else if (gap > 0 && !isFinite(months)) {
    headline = 'Akontace ještě chybí a zatím na ni nic neodkládáte. Nastavte si měsíční částku v sekci Bydlení.';
  } else if (gap > 0) {
    headline = thinReserve
      ? `Než na koupi dosáhnete, je potřeba dospořit akontaci.${reservePart}`
      : 'Akontaci ještě dospořujete, splátku byste ale unesli.';
  } else if (thinReserve) {
    headline = `Akontaci máte pokrytou a na splátku dosáhnete.${reservePart}`;
  } else {
    headline = status === 'good'
      ? 'Akontaci máte pokrytou a splátku unesete.'
      : 'Akontaci máte pokrytou, ale splátka je na hraně toho, co rozpočet unese.';
  }
  return { key: 'property', label: 'Vlastní bydlení', status, headline };
}

export function retirementReadiness(state: WizardState, allocations: GoalAllocations): GoalReadiness {
  const monthly = allocations.retirement;
  if (monthly <= 0) {
    return { key: 'retirement', label: 'Důchod', status: 'warning', headline: 'Zatím na důchod nespoříte nic.' };
  }
  const years = yearsUntilRetirement(state.person1Age);
  const projection = retirementProjection(monthly, years, 0.07);
  const finalValue = projection[projection.length - 1]?.portfolioValue ?? 0;
  const monthlyRent = finalValue * 0.04 / 12;
  // Renta pod ~8 000 Kč/měs je spíš doplněk k důchodu než plnohodnotný příjem.
  const modest = monthlyRent < 8000;
  return {
    key: 'retirement',
    label: 'Důchod',
    status: modest ? 'caution' : 'good',
    headline: modest
      ? `Spoříte ${czkMonthly(monthly)}, v důchodu to vyjde zhruba na ${czkMonthly(monthlyRent)}. Zatím spíš doplněk než plnohodnotný příjem.`
      : `Spoříte ${czkMonthly(monthly)}, v důchodu to vyjde zhruba na ${czkMonthly(monthlyRent)}.`,
  };
}

// Kolik měsíců výdajů musí zbýt po skončení volna, aby to ještě šlo nazvat
// rezervou. Pod touhle hranicí je sice volno ufinancovatelné, ale na nečekaný
// výdaj (s malým dítětem a hypotékou) už nic nezbývá.
const MIN_RUNWAY_AFTER_LEAVE = 3;

// Připravenost na výpadek příjmu během rodičovské (jen když je scénář zapnutý).
//
// Samotný měsíční schodek nestačí na to označit cíl za nedosažitelný. Rodičovská
// je z podstaty dočasná a kryje se z úspor; rozhoduje, jestli rezerva vydrží
// celé volno a co po něm zbyde. Dřív stačilo jediné minusové číslo a celý
// verdikt spadl na „Zatím na to nemáte", i když rezerva schodek pokrývala
// několikrát.
export function leaveReadiness(state: WizardState): GoalReadiness | null {
  const leave = evaluateParentalLeave(state);
  if (!leave) return null;
  const relevant = leave.disposableDuringLeaveAfterPurchase !== null
    ? leave.disposableDuringLeaveAfterPurchase
    : leave.disposableDuringLeave;

  if (relevant >= 0) {
    return {
      key: 'leave',
      label: 'Rodičovská',
      status: relevant < 3000 ? 'caution' : 'good',
      headline: `Během volna vám měsíčně zbyde ${czk(relevant)}.`,
    };
  }

  const perMonth = `Během volna vám bude chybět ${czkMonthly(Math.abs(relevant))}, za ${formatMonths(leave.durationMonths)} celkem ${czk(leave.shortfallTotal)}.`;

  if (!leave.coversWholeLeave) {
    const covered = leave.monthsCovered ?? 0;
    return {
      key: 'leave',
      label: 'Rodičovská',
      status: 'warning',
      headline: leave.reserveAfter <= 0
        ? `${perMonth} Nemáte rezervu, ze které byste to pokryli.`
        : `${perMonth} Rezerva vydrží ${covered} z ${leave.durationMonths} měsíců volna.`,
    };
  }

  // Rezerva volno pokryje. Není to bez následku (o tu částku se ztenčí), ale
  // je to zvládnutelné, takže „pozor", ne „nevychází".
  const thin = leave.runwayMonthsAfterLeave < MIN_RUNWAY_AFTER_LEAVE;
  return {
    key: 'leave',
    label: 'Rodičovská',
    status: 'caution',
    headline: thin
      ? `${perMonth} Rezerva to pokryje, ale zbyde z ní jen ${czk(leave.reserveLeftAfterLeave)}, což je na nečekané výdaje málo.`
      : `${perMonth} Rezerva to pokryje a zbyde vám ${czk(leave.reserveLeftAfterLeave)}.`,
  };
}

export function childReadiness(allocations: GoalAllocations): GoalReadiness {
  const monthly = allocations.child;
  return {
    key: 'child',
    label: 'Dítě / rodina',
    status: monthly > 0 ? 'good' : 'caution',
    headline: monthly > 0
      ? `Odkládáte ${czkMonthly(monthly)} na náklady spojené s dítětem.`
      : 'Zatím neodkládáte nic na náklady spojené s dítětem.',
  };
}

export function customReadiness(state: WizardState, allocations: GoalAllocations): GoalReadiness {
  const goals = state.customGoals ?? [];
  if (goals.length === 0) {
    return { key: 'other', label: 'Vlastní cíle', status: 'caution', headline: 'Zatím jste žádný vlastní cíl nezadali.' };
  }
  // Každý cíl se posuzuje podle částky, kterou na něj uživatel dává, ne podle
  // přerozdělení společného balíku. Balík rozděloval `allocateGoals` a mohl
  // dát cíli jiné peníze, než kolik u něj uživatel viděl nastaveno.
  const results = goals.map((g, i) => goalProgress(g, allocations.custom[i] ?? 0));
  const achievable = results.filter((r) => r.achievable).length;
  const status: GoalStatus = achievable === goals.length ? 'good' : achievable > 0 ? 'caution' : 'warning';
  return {
    key: 'other',
    label: 'Vlastní cíle',
    status,
    headline: `${achievable} z ${goals.length} ${goals.length === 1 ? 'cíle' : 'cílů'} stihnete v termínu, který jste zadali.`,
  };
}
