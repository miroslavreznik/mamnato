import type { WizardState } from '../types';
import { monthlyDisposable, savingsRate, emergencyRunwayMonths } from './cashflow';
import { dsti, monthsToSaveDownPayment } from './mortgage';
import { evaluateScenario } from './scenarios';
import { retirementProjection, allocateGoals, yearsUntilRetirement } from './savings';
import { evaluateParentalLeave } from './parentalLeave';
import type { GoalAllocations } from './allocation';
import { formatMonths } from './format';

export type OverallStatusKey = 'good' | 'tight' | 'not_yet' | 'fix_budget';
export type GoalStatus = 'good' | 'caution' | 'warning';

export interface GoalReadiness {
  key: string;
  label: string;
  status: GoalStatus;
  headline: string;
}

// Přímá odpověď na otázku z názvu appky. Zobrazuje se jako první věc ve
// výsledcích, teprve pak následuje rozbor.
export type VerdictAnswer = 'yes' | 'yes_but' | 'no_but' | 'no';

export interface Verdict {
  answer: VerdictAnswer;
  // Hlavní věta, např. „Máte na to".
  headline: string;
  // Doplněk za čárkou u variant „ale…"; u jasného ano/ne prázdný.
  qualifier: string;
  // Jednořádkové zdůvodnění pod odpovědí.
  reason: string;
}

export interface OverallSummary {
  status: OverallStatusKey;
  icon: string;
  verdict: Verdict;
  tips: string[];
  goals: GoalReadiness[];
  budget: { disposable: number; allocated: number; surplus: number; fits: boolean } | null;
}

// Připravenost cíle „nemovitost", z existujícího scénáře + čísel.
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
      : `Na akontaci ${formatMonths(months, true)}${dstiPart}`;
  return { key: 'property', label: 'Nemovitost', status, headline };
}

function retirementReadiness(state: WizardState, allocations: GoalAllocations): GoalReadiness {
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
      ? `Spoříte ${monthly.toLocaleString('cs-CZ')} Kč/měs, v důchodu to vyjde zhruba na ${Math.round(monthlyRent).toLocaleString('cs-CZ')} Kč/měs. Zatím spíš doplněk než plnohodnotný příjem.`
      : `Spoříte ${monthly.toLocaleString('cs-CZ')} Kč/měs, v důchodu to vyjde zhruba na ${Math.round(monthlyRent).toLocaleString('cs-CZ')} Kč/měs.`,
  };
}

// Připravenost na výpadek příjmu během rodičovské (jen když je scénář zapnutý).
function leaveReadiness(state: WizardState): GoalReadiness | null {
  const leave = evaluateParentalLeave(state);
  if (!leave) return null;
  const relevant = leave.disposableDuringLeaveAfterPurchase !== null
    ? leave.disposableDuringLeaveAfterPurchase
    : leave.disposableDuringLeave;
  const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString('cs-CZ');
  if (relevant < 0) {
    return { key: 'leave', label: 'Rodičovská', status: 'warning', headline: `Během volna byste byli ${fmt(relevant)} Kč/měs v mínusu.` };
  }
  return {
    key: 'leave',
    label: 'Rodičovská',
    status: relevant < 3000 ? 'caution' : 'good',
    headline: `Během volna vám měsíčně zbyde ${fmt(relevant)} Kč.`,
  };
}

function childReadiness(allocations: GoalAllocations): GoalReadiness {
  const monthly = allocations.child;
  return {
    key: 'child',
    label: 'Dítě / rodina',
    status: monthly > 0 ? 'good' : 'caution',
    headline: monthly > 0
      ? `Odkládáte ${monthly.toLocaleString('cs-CZ')} Kč/měs na náklady spojené s dítětem.`
      : 'Zatím neodkládáte nic na náklady spojené s dítětem.',
  };
}

function customReadiness(state: WizardState, allocations: GoalAllocations): GoalReadiness {
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

// Odpověď „Mám na to?" odvozená z celkového statusu. Formulace jsou úmyslně
// krátké, aby fungovaly jako velký nadpis nad celým přehledem.
function buildVerdict(
  status: OverallStatusKey,
  goals: GoalReadiness[],
  hasGoals: boolean,
  disposable: number
): Verdict {
  // Bez zvolených cílů není na co odpovídat, tak aspoň zhodnotíme rozpočet.
  if (!hasGoals) {
    return disposable > 0
      ? {
          answer: 'yes_but',
          headline: 'Rozpočet máte v plusu',
          qualifier: 'ale nemáte zvolený žádný cíl',
          reason: `Měsíčně vám zbývá ${Math.round(disposable).toLocaleString('cs-CZ')} Kč. Vyberte si cíl a spočítám, jestli na něj máte.`,
        }
      : {
          answer: 'no',
          headline: 'Rozpočet je v mínusu',
          qualifier: '',
          reason: 'Výdaje jsou vyšší než příjmy. Než budete plánovat cíle, je potřeba dostat rozpočet do plusu.',
        };
  }

  const weak = goals.filter((g) => g.status === 'warning').map((g) => g.label);
  const list = (labels: string[]) =>
    labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} a ${labels[labels.length - 1]}`;

  switch (status) {
    case 'good':
      return {
        answer: 'yes',
        headline: 'Máte na to',
        qualifier: '',
        reason: 'Rozpočet je v plusu, cíle se do něj vejdou a zbývá vám i rezerva.',
      };
    case 'tight':
      return {
        answer: 'yes_but',
        headline: 'Máte na to',
        qualifier: 'ale bude to napjaté',
        reason: 'Na cíle vám to vyjde, jenže bez velkého polštáře. Nečekaný výdaj by rozpočet rozhodil.',
      };
    case 'not_yet':
      return {
        answer: 'no_but',
        headline: 'Zatím na to nemáte',
        qualifier: 'ale máte kam sáhnout',
        reason: weak.length
          ? `Naráží to na cíl ${list(weak)}. Úpravou částky, horizontu nebo výdajů se to dá dostat do zelené.`
          : 'Cíle se zatím nevejdou do disponibilní částky. Úpravou částek nebo horizontu se to dá srovnat.',
      };
    case 'fix_budget':
    default:
      return {
        answer: 'no',
        headline: 'Zatím na to nemáte',
        qualifier: '',
        reason: 'Výdaje jsou vyšší nebo stejné jako příjmy, takže nezbývá na spoření. Začít je potřeba rozpočtem.',
      };
  }
}

const OVERALL_ICON: Record<OverallStatusKey, string> = {
  fix_budget: '⚠️',
  not_yet: '🕒',
  tight: '⚖️',
  good: '✅',
};

export function evaluateOverall(state: WizardState, allocations: GoalAllocations): OverallSummary {
  const disposable = monthlyDisposable(state);
  const runway = emergencyRunwayMonths(state);
  const rate = savingsRate(state);

  const goals: GoalReadiness[] = [];
  if (state.goals.includes('property')) goals.push(propertyReadiness(state));
  if (state.goals.includes('retirement')) goals.push(retirementReadiness(state, allocations));
  if (state.goals.includes('child')) goals.push(childReadiness(allocations));
  if (state.goals.includes('other')) goals.push(customReadiness(state, allocations));
  const leaveRow = leaveReadiness(state);
  if (leaveRow) goals.push(leaveRow); // schodek během volna → status se sám sníží (warning)

  // Rozpočtový souhrn počítá jen skutečné měsíční spoření na cíle (důchod/dítě/vlastní).
  // Hypotéka NENÍ „spoření", je to budoucí výdaj na bydlení, který nahradí nájem;
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
  let tips: string[] = [];

  if (disposable <= 0) {
    status = 'fix_budget';
    tips = [
      'Projděte výdaje po kategoriích a hledejte, kde se dá ubrat. Nejčastěji předplatná, pojistky, doprava.',
      'Zvažte možnosti navýšení příjmu (změna práce, vedlejší příjem, návrat z rodičovské).',
    ];
  } else if (budget && !budget.fits) {
    status = 'not_yet';
    tips = [
      'Upravte částky u cílů níže, nebo prodlužte jejich horizont.',
      'Zvažte, které cíle jsou prioritní teď a které mohou počkat.',
    ];
  } else {
    // Rozpočet vychází, status podle nejslabšího cíle a rezervy
    const hasWarning = goals.some((g) => g.status === 'warning');
    const hasCaution = goals.some((g) => g.status === 'caution');
    const worstProperty = state.goals.includes('property') && evaluateScenario(state).id === 'cannot_afford_dsti';

    if (hasWarning || worstProperty) {
      status = 'not_yet';
      tips = [
        'Podívejte se na detail cíle, který naráží na limity, a upravte jeho částku nebo horizont.',
        'Prioritizujte: některé cíle mohou počkat, jiné jsou teď důležitější.',
      ];
    } else if (hasCaution || runway < 3 || rate < 0.1) {
      status = 'tight';
      tips = [
        'Vytvořte si nouzový fond na 3–6 měsíců výdajů, dodá rozpočtu odolnost.',
        'Projděte zbytné výdaje; i menší úspora zvětší rezervu.',
      ];
    } else {
      status = 'good';
      tips = [
        'Máte prostor: zvažte navýšení spoření nebo investování volné rezervy pro rychlejší růst.',
        'Držte si nouzový fond 3–6 měsíců výdajů pro nečekané situace.',
      ];
    }
  }

  // Pokud je cíl nemovitost, převezmeme konkrétní tipy ze scénáře.
  if (state.goals.includes('property') && status !== 'fix_budget') {
    tips = evaluateScenario(state).tips;
  }

  // Rodičovská: upozornit, když v období volna klesne příjem do mínusu
  // (po zaplacení splátky, resp. výdajů).
  const leave = evaluateParentalLeave(state);
  if (leave) {
    const problem =
      leave.disposableDuringLeaveAfterPurchase !== null
        ? leave.disposableDuringLeaveAfterPurchase < 0
        : leave.disposableDuringLeave < 0;
    if (problem) {
      tips = [
        ...tips,
        'Během rodičovské klesne příjem a rozpočet by se v tomto období dostal do mínusu. Počítejte s rezervou na dobu volna, levnější nemovitostí nebo kratší rodičovskou.',
      ];
    }
  }

  const verdict = buildVerdict(status, goals, state.goals.length > 0, disposable);
  return { status, icon: OVERALL_ICON[status], verdict, tips, goals, budget };
}
