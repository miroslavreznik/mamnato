import type { WizardState } from '../types';
import { monthlyDisposable, savingsRate, emergencyRunwayMonths } from './cashflow';
import { evaluateScenario } from './scenarios';
import { evaluateParentalLeave } from './parentalLeave';
import type { GoalAllocations } from './allocation';
import { czk } from './format';
import {
  propertyReadiness,
  retirementReadiness,
  childReadiness,
  customReadiness,
  leaveReadiness,
  type GoalReadiness,
} from './readiness';
import { buildVerdict, type Verdict, type OverallStatusKey } from './verdict';

/**
 * Celkové vyhodnocení přehledu: verdikt, stav cílů, rozpočet a tipy.
 *
 * Tenhle soubor jen skládá dohromady výsledky ostatních modulů. Hodnocení
 * jednotlivých cílů je v `readiness.ts`, formulace odpovědi ve `verdict.ts`.
 */

// Zachováno kvůli zpětné kompatibilitě importů napříč aplikací.
export type { GoalReadiness, GoalStatus } from './readiness';
export type { Verdict, VerdictAnswer, OverallStatusKey } from './verdict';

export interface OverallSummary {
  status: OverallStatusKey;
  icon: string;
  verdict: Verdict;
  tips: string[];
  goals: GoalReadiness[];
  budget: { disposable: number; allocated: number; surplus: number; fits: boolean } | null;
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
  if (state.goals.includes('property')) goals.push(propertyReadiness(state, allocations));
  if (state.goals.includes('retirement')) goals.push(retirementReadiness(state, allocations));
  if (state.goals.includes('child')) goals.push(childReadiness(allocations));
  if (state.goals.includes('other')) goals.push(customReadiness(state, allocations));
  const leaveRow = leaveReadiness(state);
  if (leaveRow) goals.push(leaveRow); // schodek během volna → status se sám sníží (warning)

  // Rozpočtový souhrn počítá měsíční odkládání na cíle, tedy i na akontaci.
  // Splátka hypotéky v něm není: to není spoření, ale budoucí výdaj na bydlení,
  // který nahradí nájem. Dostupnost samotné splátky řeší připravenost cíle
  // (LTV, akontace, doporučení banky), ne tenhle rozpočet.
  //
  // Odkládání na akontaci se sem přidalo záměrně: dřív rozpočtová věta člověku,
  // který si zvolil jen nemovitost, vůbec nesvítila, přestože i on každý měsíc
  // odkládá a je to jeho největší závazek.
  const allocated = allocations.downPayment + allocations.retirement + allocations.child
    + allocations.custom.reduce((s, v) => s + v, 0);
  const surplus = disposable - allocated;
  const budget = state.goals.length > 0
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

  // Rodičovská: rada se liší podle toho, jestli na schodek máte z čeho brát.
  // Radit „počítejte s rezervou" někomu, komu rezerva schodek pokryje třikrát,
  // vypadá, že jsme si vlastní čísla nepřečetli.
  const leave = evaluateParentalLeave(state);
  if (leave && leave.shortfallPerMonth > 0) {
    tips = [
      ...tips,
      leave.coversWholeLeave
        ? `Během rodičovské budete rozpočet dotovat z úspor, celkem asi ${czk(leave.shortfallTotal)}. Počítejte s tím, že o tuhle částku se rezerva ztenčí, a nespoléhejte na ni zároveň jako na nouzový fond.`
        : 'Během rodičovské klesne příjem a rozpočet by se v tomto období dostal do mínusu, na který rezerva nestačí. Počítejte s došetřením, levnější nemovitostí nebo kratší rodičovskou.',
    ];
  }

  const verdict = buildVerdict(status, goals, state.goals.length > 0, disposable, leave);
  return { status, icon: OVERALL_ICON[status], verdict, tips, goals, budget };
}
