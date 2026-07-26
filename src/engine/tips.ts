import type { WizardState } from '../types';
import { MIN_RESERVE_MONTHS_AFTER_PURCHASE, type GoalReadiness } from './readiness';
import type { BudgetView } from './budget';
import type { LeaveImpact } from './parentalLeave';
import type { OverallStatusKey } from './verdict';
import { evaluateScenario } from './scenarios';
import { postPurchaseRunwayMonths } from './mortgage';
import { czk } from './format';

/**
 * Rady „co můžete udělat" pod verdiktem.
 *
 * Skládají se ve stejném pořadí, v jakém uživatel čte odpověď: nejdřív to,
 * co blokuje verdikt, pak konkrétní rada k bydlení a nakonec cíle, které
 * nevycházejí. Dřív se tipy skládaly a hned nato je u každého, kdo měl
 * nemovitost mezi cíli, přepsal scénář nemovitosti. Domácnost tak dostala
 * verdikt „po koupi vám na cíle nezbyde" a pod ním radu „mějte stranou
 * nouzový fond", tedy odpověď na úplně jinou otázku, a cíl „na důchod
 * nespoříte nic" nedostal radu vůbec žádnou.
 */

/**
 * Rada, která umí ukázat, kde se problém řeší.
 *
 * Rady dřív odkazovaly slovy („nastavte si částku v sekci Ostatní cíle"),
 * takže uživatel musel to místo najít sám. Klíč sekce z toho dělá odkaz,
 * na který jde kliknout.
 */
export interface Tip {
  text: string;
  /** Záložka výsledků, kde se to dá nastavit. */
  section?: 'bydleni' | 'cile' | 'rozpocet';
  /** Popisek odkazu na tu záložku. */
  actionLabel?: string;
}

// Kolik rad má smysl ukázat. Víc už nikdo nečte a ty důležité v tom zapadnou.
const MAX_TIPS = 5;

// Kolik míst si drží rady ke konkrétním cílům a k rodičovské. Bez téhle
// rezervace je vytlačí rady k bydlení, kterých je vždycky několik, a cíl
// „na důchod nespoříte nic" zůstane bez odpovědi.
const RESERVED_FOR_GOALS = 2;

const BUDGET_TIPS: Tip[] = [
  {
    text: 'Projděte výdaje po kategoriích a hledejte, kde se dá ubrat. Nejčastěji předplatná, pojistky, doprava.',
    section: 'rozpocet',
    actionLabel: 'Zkusit v rozpočtu',
  },
  { text: 'Zvažte možnosti navýšení příjmu (změna práce, vedlejší příjem, návrat z rodičovské).' },
];

// Rada k cíli, který nevychází. Klíč je `GoalReadiness.key`.
function goalTip(goal: GoalReadiness): Tip | null {
  if (goal.status === 'good') return null;
  const toGoals = { section: 'cile', actionLabel: 'Nastavit částku' } as const;
  switch (goal.key) {
    case 'retirement':
      return {
        text: goal.status === 'warning'
          ? 'Na důchod zatím nejde nic. U dlouhého horizontu udělá i tisícovka měsíčně velký rozdíl.'
          : 'Renta z důchodového spoření zatím vyjde spíš na přilepšení. Pomůže navýšit měsíční částku, každá tisícovka se za desítky let znásobí.',
        ...toGoals,
      };
    case 'child':
      return { text: 'Na náklady spojené s dítětem zatím neodkládáte nic.', ...toGoals };
    case 'other':
      return {
        text: 'U vlastních cílů se nestíhají všechny termíny. Upravte částku nebo termín u toho, který nevychází.',
        section: 'cile',
        actionLabel: 'Upravit cíle',
      };
    default:
      return null;
  }
}

export function buildTips(
  state: WizardState,
  status: OverallStatusKey,
  goals: GoalReadiness[],
  budget: BudgetView | null,
  budgetAfter: BudgetView | null,
  leave: LeaveImpact | null
): Tip[] {
  // Záporný rozpočet přebíjí všechno ostatní: dokud nejsou příjmy nad výdaji,
  // nemá smysl radit s cíli.
  if (status === 'fix_budget') return BUDGET_TIPS;

  const tips: Tip[] = [];

  // 1. Co blokuje verdikt.
  if (budget && !budget.fits) {
    tips.push({
      text: 'Cíle se nevejdou do toho, co vám měsíčně zbývá. Upravte jejich částky, nebo prodlužte horizont.',
      section: 'cile',
      actionLabel: 'Upravit cíle',
    });
  } else if (budgetAfter && !budgetAfter.fits) {
    tips.push({
      text: `Po koupi by rozpočet nevyšel, chybělo by ${czk(Math.abs(budgetAfter.surplus))} měsíčně. Pomůže levnější nemovitost, vyšší akontace nebo delší splatnost.`,
      section: 'bydleni',
      actionLabel: 'Upravit bydlení',
    });
  }

  // 2. Konkrétní rady k bydlení ze scénáře. Berou se jen tehdy, když bydlení
  //    opravdu drhne; komu vychází, tomu by radily k neexistujícímu problému.
  //    Nejvýš dvě, jinak bydlení zabere celý seznam a na ostatní cíle
  //    nezbyde místo, i když nevycházejí.
  const property = goals.find((g) => g.key === 'property');
  if (property && property.status !== 'good') {
    tips.push(...evaluateScenario(state).tips.slice(0, 2).map((text) => ({ text })));
  }

  // 3. Rezerva po zaplacení akontace. Výchozí nastavení dává do akontace
  //    všechny úspory, takže domácnosti po koupi nezbyde nic na nečekané
  //    výdaje. Appka to dřív říkala jen šedým číslem v dlaždici.
  if (property && postPurchaseRunwayMonths(state) < MIN_RESERVE_MONTHS_AFTER_PURCHASE) {
    tips.push({
      text: `Po zaplacení akontace by vám nezbyla rezerva na nečekané výdaje. Nechte si stranou ${MIN_RESERVE_MONTHS_AFTER_PURCHASE} až 6 měsíců výdajů a dejte do akontace míň.`,
      section: 'bydleni',
      actionLabel: 'Upravit akontaci',
    });
  }

  // 4. Cíle, které nevycházejí. Bez tohohle kroku zůstal cíl bez rady.
  const goalTips = goals.map(goalTip).filter((t): t is Tip => t !== null);

  // 5. Když nic nedrhne, radí se, co s volným prostorem.
  if (tips.length === 0 && goalTips.length === 0) {
    tips.push(
      {
        text: status === 'good'
          ? 'Máte prostor: zvažte navýšení spoření nebo investování volné rezervy pro rychlejší růst.'
          : 'Vytvořte si nouzový fond na 3–6 měsíců výdajů, dodá rozpočtu odolnost.',
      },
      { text: 'Držte si nouzový fond 3–6 měsíců výdajů pro nečekané situace.' }
    );
  }

  // Rodičovská: rada se liší podle toho, jestli na schodek máte z čeho brát.
  // Radit „počítejte s rezervou" někomu, komu rezerva schodek pokryje třikrát,
  // vypadá, že jsme si vlastní čísla nepřečetli.
  //
  // Drží si vlastní místo na konci seznamu spolu s radami k cílům. Kdyby se
  // ořezávala spolu s ostatními, vypadla by komukoli s nemovitostí.
  const leaveTips: Tip[] = [];
  if (leave && leave.shortfallPerMonth > 0) {
    leaveTips.push({
      text: leave.coversWholeLeave
        ? `Během rodičovské budete rozpočet dotovat z úspor, celkem asi ${czk(leave.shortfallTotal)}. Počítejte s tím, že o tuhle částku se rezerva ztenčí, a nespoléhejte na ni zároveň jako na nouzový fond.`
        : 'Během rodičovské klesne příjem a rozpočet by se v tomto období dostal do mínusu, na který rezerva nestačí. Počítejte s došetřením, levnější nemovitostí nebo kratší rodičovskou.',
      section: 'cile',
      actionLabel: 'Upravit rodičovskou',
    });
  }

  const mustKeep = [...goalTips, ...leaveTips].slice(0, RESERVED_FOR_GOALS);
  return [...tips.slice(0, MAX_TIPS - mustKeep.length), ...mustKeep];
}
