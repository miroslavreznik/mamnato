import type { WizardState } from '../types';
import { monthlyDisposable, savingsRate, emergencyRunwayMonths } from './cashflow';
import { dsti, monthsToSaveDownPayment } from './mortgage';
import { evaluateScenario } from './scenarios';
import { retirementProjection, allocateGoals } from './savings';
import type { GoalAllocations } from './allocation';

export type OverallStatusKey = 'good' | 'tight' | 'not_yet' | 'fix_budget';
export type GoalStatus = 'good' | 'caution' | 'warning';

export interface GoalReadiness {
  key: string;
  label: string;
  status: GoalStatus;
  headline: string;
}

export interface OverallSummary {
  status: OverallStatusKey;
  icon: string;
  title: string;
  description: string;
  tips: string[];
  goals: GoalReadiness[];
  budget: { disposable: number; allocated: number; surplus: number; fits: boolean } | null;
}

function fmtMonths(months: number): string {
  if (!isFinite(months)) return 'více než 10 let';
  if (months <= 0) return 'ihned';
  if (months < 12) return `${Math.round(months)} měs.`;
  const y = Math.floor(months / 12);
  const m = Math.round(months % 12);
  return m > 0 ? `${y} let a ${m} měs.` : `${y} let`;
}

// Připravenost cíle „nemovitost" — z existujícího scénáře + čísel.
function propertyReadiness(state: WizardState): GoalReadiness {
  const scenario = evaluateScenario(state);
  const months = monthsToSaveDownPayment(state);
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
  const dstiPart = isFinite(dstiPct) ? ` · DSTI ${dstiPct} %` : '';
  const headline =
    scenario.id === 'cannot_afford_dsti'
      ? `Splátka nad obvyklý limit bank${dstiPart}`
      : `Na akontaci ${fmtMonths(months)}${dstiPart}`;
  return { key: 'property', label: 'Nemovitost', status, headline };
}

function retirementReadiness(allocations: GoalAllocations): GoalReadiness {
  const monthly = allocations.retirement;
  if (monthly <= 0) {
    return { key: 'retirement', label: 'Důchod', status: 'warning', headline: 'Zatím na důchod nespoříte' };
  }
  const years = 30;
  const projection = retirementProjection(monthly, years, 0.07);
  const finalValue = projection[projection.length - 1]?.portfolioValue ?? 0;
  const monthlyRent = finalValue * 0.04 / 12;
  return {
    key: 'retirement',
    label: 'Důchod',
    status: 'good',
    headline: `${monthly.toLocaleString('cs-CZ')} Kč/měs → ~${Math.round(monthlyRent).toLocaleString('cs-CZ')} Kč renty`,
  };
}

function childReadiness(allocations: GoalAllocations): GoalReadiness {
  const monthly = allocations.child;
  return {
    key: 'child',
    label: 'Dítě / rodina',
    status: monthly > 0 ? 'good' : 'caution',
    headline: monthly > 0
      ? `Rezerva ${monthly.toLocaleString('cs-CZ')} Kč/měs`
      : 'Bez měsíční rezervy na dítě',
  };
}

function customReadiness(state: WizardState, allocations: GoalAllocations): GoalReadiness {
  const goals = state.customGoals ?? [];
  if (goals.length === 0) {
    return { key: 'other', label: 'Vlastní cíle', status: 'caution', headline: 'Zatím bez zadaných cílů' };
  }
  const totalAlloc = allocations.custom.reduce((s, v) => s + v, 0);
  const results = allocateGoals(goals, totalAlloc);
  const achievable = results.filter((r) => r.achievable).length;
  const status: GoalStatus = achievable === goals.length ? 'good' : achievable > 0 ? 'caution' : 'warning';
  return {
    key: 'other',
    label: 'Vlastní cíle',
    status,
    headline: `${achievable} z ${goals.length} v horizontu`,
  };
}

const OVERALL: Record<OverallStatusKey, { icon: string; title: string }> = {
  fix_budget: { icon: '⚠️', title: 'Nejdříve je potřeba vyrovnat rozpočet' },
  not_yet: { icon: '🕒', title: 'Zatím to úplně nevychází — ale máte kam sáhnout' },
  tight: { icon: '⚖️', title: 'Dosažitelné, ale s napjatou rezervou' },
  good: { icon: '✅', title: 'Vaše cíle jsou v dosahu' },
};

export function evaluateOverall(state: WizardState, allocations: GoalAllocations): OverallSummary {
  const disposable = monthlyDisposable(state);
  const runway = emergencyRunwayMonths(state);
  const rate = savingsRate(state);

  const goals: GoalReadiness[] = [];
  if (state.goals.includes('property')) goals.push(propertyReadiness(state));
  if (state.goals.includes('retirement')) goals.push(retirementReadiness(allocations));
  if (state.goals.includes('child')) goals.push(childReadiness(allocations));
  if (state.goals.includes('other')) goals.push(customReadiness(state, allocations));

  // Rozpočtový souhrn počítá jen skutečné měsíční spoření na cíle (důchod/dítě/vlastní).
  // Hypotéka NENÍ „spoření" — je to budoucí výdaj na bydlení, který nahradí nájem;
  // dostupnost nemovitosti řeší připravenost cíle (DSTI / akontace), ne tento rozpočet.
  const hasSavingGoals = state.goals.includes('retirement')
    || state.goals.includes('child') || state.goals.includes('other');
  const allocated = allocations.retirement + allocations.child
    + allocations.custom.reduce((s, v) => s + v, 0);
  const surplus = disposable - allocated;
  const budget = hasSavingGoals
    ? { disposable, allocated, surplus, fits: surplus >= 0 }
    : null;

  // Celkový status
  let status: OverallStatusKey;
  let description: string;
  let tips: string[] = [];

  if (disposable <= 0) {
    status = 'fix_budget';
    description = 'Vaše výdaje jsou vyšší nebo stejné jako příjmy, takže zatím nezbývá na spoření ani na splátky. Než budete řešit velké cíle, je potřeba dostat rozpočet do plusu.';
    tips = [
      'Projděte výdaje po kategoriích a hledejte, kde se dá ubrat — nejčastěji předplatná, pojistky, doprava.',
      'Zvažte možnosti navýšení příjmu (změna práce, vedlejší příjem, návrat z rodičovské).',
    ];
  } else if (budget && !budget.fits) {
    status = 'not_yet';
    description = `Vaše cíle dohromady vyžadují ${allocated.toLocaleString('cs-CZ')} Kč/měs, ale k dispozici máte ${disposable.toLocaleString('cs-CZ')} Kč/měs. Chybí ${Math.abs(surplus).toLocaleString('cs-CZ')} Kč/měs — cíle se zatím nevejdou najednou.`;
    tips = [
      'Upravte částky u cílů níže, nebo prodlužte jejich horizont.',
      'Zvažte, které cíle jsou prioritní teď a které mohou počkat.',
    ];
  } else {
    // Rozpočet vychází — status podle nejslabšího cíle a rezervy
    const hasWarning = goals.some((g) => g.status === 'warning');
    const hasCaution = goals.some((g) => g.status === 'caution');
    const worstProperty = state.goals.includes('property') && evaluateScenario(state).id === 'cannot_afford_dsti';

    if (hasWarning || worstProperty) {
      status = 'not_yet';
      description = 'Rozpočet zvládáte, ale některý z cílů zatím naráží na limity. Podívejte se na jeho detail níže — často pomůže upravit parametry nebo horizont.';
    } else if (hasCaution || runway < 3 || rate < 0.1) {
      status = 'tight';
      description = 'Vaše cíle jsou dosažitelné, ale rezerva je napjatá. Před velkými kroky je dobré mít nouzový fond na 3–6 měsíců výdajů a nechat si v rozpočtu prostor.';
    } else {
      status = 'good';
      description = 'Rozpočet máte v plusu, cíle se do disponibilní částky vejdou a máte i rezervu. Můžete pokračovat a jednotlivé cíle si doladit níže.';
    }
  }

  // Pokud je cíl nemovitost, převezmeme konkrétní tipy ze scénáře.
  if (state.goals.includes('property') && status !== 'fix_budget') {
    tips = evaluateScenario(state).tips;
  }

  const meta = OVERALL[status];
  return { status, icon: meta.icon, title: meta.title, description, tips, goals, budget };
}
