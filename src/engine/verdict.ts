import type { LeaveImpact } from './parentalLeave';
import type { GoalReadiness, GoalStatus } from './readiness';
import type { BudgetView } from './budget';
import { czk, czkMonthly, czkPerMonth } from './format';

/**
 * Přímá odpověď na otázku z názvu appky.
 *
 * Zobrazuje se jako první věc ve výsledcích, teprve pak následuje rozbor.
 * Formulace jsou úmyslně krátké, aby fungovaly jako velký nadpis.
 */
export type VerdictAnswer = 'yes' | 'yes_but' | 'no_but' | 'no';

/**
 * Dílčí otázka, ze které se skládá celková odpověď.
 *
 * „Mám na to?" jsou u vlastního bydlení ve skutečnosti otázky dvě: jestli
 * na bydlení dosáhnete a jestli po něm zbyde na zbytek života. Jedna zelená
 * nebo červená nálepka je slučuje do čísla, ze kterého uživatel nepozná,
 * která z nich ho brzdí, a přesně to appka dělala.
 */
export interface VerdictQuestion {
  question: string;
  answer: string;
  status: GoalStatus;
}

export interface Verdict {
  answer: VerdictAnswer;
  // Hlavní věta, např. „Máte na to".
  headline: string;
  // Doplněk za čárkou u variant „ale…"; u jasného ano/ne prázdný.
  qualifier: string;
  // Jednořádkové zdůvodnění pod odpovědí.
  reason: string;
  // Rozpad odpovědi na dílčí otázky. Prázdné, když není na co dělit.
  questions: VerdictQuestion[];
}

export type OverallStatusKey = 'good' | 'tight' | 'not_yet' | 'fix_budget';

// Pořadí od nejlepšího k nejhoršímu, ať jde vzít ten nejslabší.
const WORST: GoalStatus[] = ['warning', 'caution', 'good'];
const worstOf = (statuses: GoalStatus[]): GoalStatus =>
  WORST.find((s) => statuses.includes(s)) ?? 'good';

/**
 * Rozpad odpovědi na dvě otázky, které si člověk s hypotékou klade odděleně:
 * dosáhnu na bydlení, a zbyde mi pak na zbytek?
 *
 * Bez bydlení mezi cíli se nic nedělí; jediná otázka je celý verdikt a
 * opakovat ji pod ním by byla vata.
 */
export function buildVerdictQuestions(
  goals: GoalReadiness[],
  budgetAfter: BudgetView | null
): VerdictQuestion[] {
  const property = goals.find((g) => g.key === 'property');
  if (!property || !budgetAfter) return [];

  const rest = goals.filter((g) => g.key !== 'property');
  const restStatus = worstOf(rest.map((g) => g.status));

  let answer: string;
  let status: GoalStatus;
  if (!budgetAfter.fits) {
    status = 'warning';
    answer = `Po splátce a nákladech na bydlení by na cíle chybělo ${czkMonthly(Math.abs(budgetAfter.surplus))}.`;
  } else if (budgetAfter.disposable <= 0) {
    status = 'warning';
    answer = 'Splátka a náklady na bydlení by spolykaly celý příjem.';
  } else if (rest.length === 0) {
    status = budgetAfter.surplus > 0 ? 'good' : 'caution';
    answer = `Po splátce a nákladech na bydlení vám zůstane ${czkPerMonth(budgetAfter.surplus)} volných. Další cíle zatím nemáte zvolené.`;
  } else {
    status = restStatus === 'good' && budgetAfter.surplus <= 0 ? 'caution' : restStatus;
    answer = `Cíle si po koupi vezmou ${czkPerMonth(budgetAfter.allocated)} a volných zůstane ${czkPerMonth(budgetAfter.surplus)}.`;
  }

  // První otázka odpovídá ano/ne. Konkrétní čísla (akontace, splátka, DSTI)
  // jsou o kus níž u samotného cíle, opakovat je tady by byla vata.
  const reachable: Record<GoalStatus, string> = {
    good: 'Ano, na akontaci i splátku dosáhnete.',
    caution: 'Ano, ale je to na hraně. Podrobnosti u cíle níže.',
    warning: 'Zatím ne. Co konkrétně chybí, je u cíle níže.',
  };

  return [
    { question: 'Dosáhnete na vlastní bydlení?', answer: reachable[property.status], status: property.status },
    { question: 'Zbyde vám pak na zbytek?', answer, status },
  ];
}

// Odpověď „Mám na to?" odvozená z celkového statusu. Formulace jsou úmyslně
// krátké, aby fungovaly jako velký nadpis nad celým přehledem.
export function buildVerdict(
  status: OverallStatusKey,
  goals: GoalReadiness[],
  hasGoals: boolean,
  disposable: number,
  leave: LeaveImpact | null,
  budgetAfter: BudgetView | null = null
): Verdict {
  return {
    ...buildAnswer(status, goals, hasGoals, disposable, leave),
    questions: buildVerdictQuestions(goals, budgetAfter),
  };
}

function buildAnswer(
  status: OverallStatusKey,
  goals: GoalReadiness[],
  hasGoals: boolean,
  disposable: number,
  leave: LeaveImpact | null
): Omit<Verdict, 'questions'> {
  // Bez zvolených cílů není na co odpovídat, tak aspoň zhodnotíme rozpočet.
  if (!hasGoals) {
    return disposable > 0
      ? {
          answer: 'yes_but',
          headline: 'Rozpočet máte v plusu',
          qualifier: 'ale nemáte zvolený žádný cíl',
          reason: `Měsíčně vám zbývá ${czk(disposable)}. Vyberte si cíl a spočítám, jestli na něj máte.`,
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

  // Dočasný schodek během rodičovské krytý úsporami je vlastní příběh: je to
  // „ano, ale budete sahat do úspor", ne obecné „bude to napjaté".
  const drawingOnSavings = leave !== null && leave.shortfallPerMonth > 0 && leave.coversWholeLeave;
  if (status === 'tight' && drawingOnSavings && leave) {
    return {
      answer: 'yes_but',
      headline: 'Máte na to',
      qualifier: 'ale během rodičovské budete sahat do úspor',
      reason: `Po dobu volna vám bude chybět ${czkMonthly(leave.shortfallPerMonth)}, celkem ${czk(leave.shortfallTotal)}. Rezerva to pokryje a zbyde vám ${czk(leave.reserveLeftAfterLeave)}.`,
    };
  }

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
      if (leave && leave.shortfallPerMonth > 0 && !leave.coversWholeLeave) {
        return {
          answer: 'no_but',
          headline: 'Zatím na to nemáte',
          qualifier: 'chybí rezerva na dobu rodičovské',
          reason: `Během volna vám bude chybět ${czkMonthly(leave.shortfallPerMonth)} a rezerva vydrží ${leave.monthsCovered ?? 0} z ${leave.durationMonths} měsíců. Pomůže došetřit, zkrátit volno nebo hledat levnější nemovitost.`,
        };
      }
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
