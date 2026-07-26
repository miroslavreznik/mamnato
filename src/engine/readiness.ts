import type { WizardState } from '../types';
import type { GoalAllocations } from './allocation';
import { dsti, downPaymentGap } from './mortgage';
import { monthsToSaveAtAllocation } from './allocation';
import { evaluateScenario } from './scenarios';
import { retirementProjection, allocateGoals, yearsUntilRetirement } from './savings';
import { evaluateParentalLeave } from './parentalLeave';
import { formatMonths, czk, czkMonthly, czkPerMonth } from './format';

/**
 * Připravenost jednotlivých cílů.
 *
 * Každý cíl se hodnotí zvlášť a vrací stav plus větu, kterou uživatel čte
 * v přehledu. Stav „nevychází" znamená, že cíl takhle nefunguje, ne že je to
 * jen napjaté; z toho pak vychází celkový verdikt, takže na tom rozlišení
 * záleží víc, než se zdá.
 */
export type GoalStatus = 'good' | 'caution' | 'warning';

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
  const dstiPct = Math.round(dsti(state) * 100);
  const statusByScenario: Record<string, GoalStatus> = {
    cannot_afford_cashflow: 'warning',
    cannot_afford_dsti: 'warning',
    no_savings: 'warning',
    tight_but_possible: 'caution',
    ready_in_1_2_years: 'caution',
    ready_now: 'good',
    very_comfortable: 'good',
  };
  const status = statusByScenario[scenario.id] ?? 'caution';
  const payment = isFinite(dstiPct)
    ? `splátka by zabrala ${dstiPct} % čistého příjmu`
    : 'splátku ale zatím není z čeho platit';

  let headline: string;
  if (scenario.id === 'cannot_afford_cashflow') {
    headline = 'Rozpočet dnes nevychází, takže na splátku hypotéky není z čeho.';
  } else if (scenario.id === 'cannot_afford_dsti') {
    headline = `Splátka by zabrala ${dstiPct} % čistého příjmu, což je nad tím, co banky obvykle schválí.`;
  } else if (gap <= 0) {
    headline = `Akontaci máte pokrytou z úspor, ${payment}.`;
  } else if (isFinite(months)) {
    headline = `Chybějící akontaci naspoříte za ${formatMonths(months)}, ${payment}.`;
  } else {
    headline = `Na akontaci zatím nic neodkládáte, chybí ${czk(gap)}.`;
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
      ? `Spoříte ${czkPerMonth(monthly)}, v důchodu to vyjde zhruba na ${czkPerMonth(monthlyRent)}. Zatím spíš doplněk než plnohodnotný příjem.`
      : `Spoříte ${czkPerMonth(monthly)}, v důchodu to vyjde zhruba na ${czkPerMonth(monthlyRent)}.`,
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
      ? `Odkládáte ${czkPerMonth(monthly)} na náklady spojené s dítětem.`
      : 'Zatím neodkládáte nic na náklady spojené s dítětem.',
  };
}

export function customReadiness(state: WizardState, allocations: GoalAllocations): GoalReadiness {
  const goals = state.customGoals ?? [];
  if (goals.length === 0) {
    return { key: 'other', label: 'Vlastní cíle', status: 'caution', headline: 'Zatím jste žádný vlastní cíl nezadali.' };
  }
  const totalAlloc = allocations.custom.reduce((s, v) => s + v, 0);
  const results = allocateGoals(goals, totalAlloc);
  const achievable = results.filter((r) => r.achievable).length;
  const status: GoalStatus = achievable === goals.length ? 'good' : achievable > 0 ? 'caution' : 'warning';
  return {
    key: 'other',
    label: 'Vlastní cíle',
    status,
    headline: `${achievable} z ${goals.length} ${goals.length === 1 ? 'cíle' : 'cílů'} stihnete v termínu, který jste zadali.`,
  };
}
