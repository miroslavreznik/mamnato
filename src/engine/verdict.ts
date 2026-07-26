import type { LeaveImpact } from './parentalLeave';
import type { GoalReadiness } from './readiness';
import { czk, czkMonthly } from './format';

/**
 * Přímá odpověď na otázku z názvu appky.
 *
 * Zobrazuje se jako první věc ve výsledcích, teprve pak následuje rozbor.
 * Formulace jsou úmyslně krátké, aby fungovaly jako velký nadpis.
 */
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

export type OverallStatusKey = 'good' | 'tight' | 'not_yet' | 'fix_budget';

// Odpověď „Mám na to?" odvozená z celkového statusu. Formulace jsou úmyslně
// krátké, aby fungovaly jako velký nadpis nad celým přehledem.
export function buildVerdict(
  status: OverallStatusKey,
  goals: GoalReadiness[],
  hasGoals: boolean,
  disposable: number,
  leave: LeaveImpact | null
): Verdict {
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
