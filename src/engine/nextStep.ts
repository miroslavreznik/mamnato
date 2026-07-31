import type { WizardState } from '../types';
import type { GoalAllocations } from './allocation';
import { monthlyDisposable, necessaryMonthlyExpenses, totalMonthlyIncome } from './cashflow';
import { downPaymentGap, postPurchaseRunwayMonths, dsti, mortgagePayment, totalProjectCost } from './mortgage';
import { evaluateScenario } from './scenarios';
import { budgetNow, budgetAfterPurchase } from './budget';
import { evaluateParentalLeave } from './parentalLeave';
import { DEFAULTS } from './defaults';
import { czk, czkMonthly, monthYearIn, formatMonths } from './format';

/**
 * Jeden konkrétní krok, který má člověk udělat příští měsíc.
 *
 * Přehled odpovídal na „mám na to?", ale ne na „co s tím teď". Karta „Co
 * můžete udělat" je seznam rad („zvažte fixaci na 7–10 let"), tedy témata
 * k promyšlení, ne úkol. Kdo se rozhoduje, potřebuje jednu větu s částkou
 * a termínem, kterou si zapíše do kalendáře.
 *
 * Proto je krok **jeden**, ne seznam, a vybírá se v pořadí, ve kterém se ty
 * věci musí řešit:
 *
 *  1. Rozpočet, který nevychází. Dokud výdaje přerůstají příjem, nemá smysl
 *     spořit na nic; každý cíl by se platil dluhem.
 *  2. Splátka, na kterou banka nepůjčí. Spořit na akontaci k nemovitosti,
 *     kterou stejně neschválí, je práce nazmar.
 *  3. Chybějící akontace. Je to aktivní spořicí cíl; rezerva po koupi se
 *     k němu připočte ve vysvětlení, ať se na ni nezapomene.
 *  4. Nouzová rezerva. Podle vlastního slovníčku appky „první věc, kterou má
 *     smysl mít hotovou, dřív než cokoli jiného".
 *  5. Důchod, na který nejde nic.
 *  6. Když je všechno v pořádku, zbývá jediné doporučení: peníze, které leží
 *     ladem, mají někde pracovat.
 *
 * Částky i termíny jsou z týchž funkcí, ze kterých počítá zbytek přehledu,
 * takže se s ním krok nemůže rozejít.
 *
 * `action` je věta **bez měsíční částky**: tu nese `monthly` a karta ji sází
 * velkým písmem, aby šla přečíst na první pohled. Kdyby byla i ve větě,
 * stálo by tam totéž číslo dvakrát pod sebou.
 */

export interface NextStep {
  key: 'fix_budget' | 'reserve' | 'payment_too_high' | 'down_payment' | 'retirement' | 'grow';
  /** Co udělat. Jedna věta v rozkazovacím způsobu. */
  action: string;
  /** Proč zrovna tohle a ne něco jiného. */
  why: string;
  /** Kolik měsíčně, když to má smysl vyčíslit. */
  monthly?: number;
  /** Kdy bude hotovo, když se to dá spočítat. */
  done?: string;
  /** Kam v přehledu se to nastavuje. */
  section?: 'rozpocet' | 'bydleni' | 'cile';
  actionLabel?: string;
}

/** Doporučená nouzová rezerva: tři měsíce nezbytných výdajů. */
const RESERVE_MONTHS = 3;

/**
 * Kolik měsíčně jde odložit navíc, aniž by se sáhlo na cíle.
 *
 * Bere se volná rezerva, tedy to, co zbývá po výdajích **i po cílech**.
 * Kdyby se počítalo z disponibilní částky, radila by appka odkládat peníze,
 * které už jsou slíbené jinam.
 *
 * A hlavně: musí to být částka, kterou domácnost **udrží**, protože krok zní
 * „nastavte si trvalý příkaz". Proto se bere ta nižší ze dvou:
 *
 *  - rozpočet po koupi, když se kupuje hned. Dokud se počítalo z dneška,
 *    radila appka páru, který kupuje tenhle měsíc, rozhodnout se o 33 667 Kč,
 *    jenže po zaplacení splátky jim zbyde 24 096 Kč.
 *  - nejhorší měsíc rodičovské, když je v plánu. Tam u téhož páru zbývá
 *    1 253 Kč, tedy dvacetina toho, co appka doporučovala odkládat.
 */
function spare(state: WizardState, allocations: GoalAllocations): number {
  // Kupuje se hned, když je akontace pokrytá; pak platí rozpočet po koupi.
  const buysNow = state.goals.includes('property') && downPaymentGap(state) <= 0;
  const budget = buysNow ? budgetAfterPurchase(state, allocations) : budgetNow(state, allocations);

  const leave = evaluateParentalLeave(state);
  if (!leave) return Math.max(0, budget.surplus);

  // Rezerva na dítě se narozením mění ve skutečný výdaj, se kterým
  // `worstMonthlyDisposable` už počítá; podruhé se odečítat nesmí.
  const goalsDuringLeave = budget.allocated - allocations.child;
  return Math.max(0, Math.min(budget.surplus, leave.worstMonthlyDisposable - goalsDuringLeave));
}

/** Je v plánu rodičovská, kvůli které je doporučená částka nižší? */
function leaveLimits(state: WizardState, allocations: GoalAllocations): boolean {
  const leave = evaluateParentalLeave(state);
  if (!leave) return false;
  const buysNow = state.goals.includes('property') && downPaymentGap(state) <= 0;
  const budget = buysNow ? budgetAfterPurchase(state, allocations) : budgetNow(state, allocations);
  return leave.worstMonthlyDisposable - (budget.allocated - allocations.child) < budget.surplus;
}

export function nextStep(state: WizardState, allocations: GoalAllocations): NextStep {
  const disposable = monthlyDisposable(state);
  const necessary = necessaryMonthlyExpenses(state);
  const free = spare(state, allocations);

  // 1. Rozpočet nevychází.
  if (disposable <= 0) {
    return {
      key: 'fix_budget',
      action: `Snižte výdaje o ${czkMonthly(Math.abs(disposable) + 1)}, aby rozpočet vyšel.`,
      why: 'Dokud výdaje přerůstají příjem, platil by se každý cíl dluhem. '
        + 'Tohle je jediná věc, která má teď smysl.',
      section: 'rozpocet',
      actionLabel: 'Upravit výdaje',
    };
  }

  const buying = state.goals.includes('property');

  // 2. Splátka nad tím, co banky schvalují. Musí být dřív než spoření:
  // odkládat na akontaci k ceně, na kterou banka nepůjčí, je práce nazmar.
  if (buying) {
    const scenario = evaluateScenario(state);
    if (scenario.id === 'cannot_afford_dsti' || dsti(state) > DEFAULTS.dstiLimit) {
      const income = totalMonthlyIncome(state);
      const affordable = income * DEFAULTS.dstiLimit - state.expenses.existingLoans;
      const over = mortgagePayment(state) - affordable;
      // Kolik ubrat z ceny, aby splátka klesla na hranici. Splátka je lineární
      // ve výši úvěru, takže poměr platí i pro cenu.
      const cheaper = mortgagePayment(state) > 0
        ? Math.ceil((over / mortgagePayment(state)) * totalProjectCost(state) / 100000) * 100000
        : 0;
      return {
        key: 'payment_too_high',
        action: `Hledejte nemovitost asi o ${czk(cheaper)} levnější, nebo si připravte o tolik vyšší akontaci.`,
        why: `Splátka ${czkMonthly(mortgagePayment(state))} je ${Math.round(dsti(state) * 100)} % čistého příjmu. `
          + `Banky obvykle chtějí do ${Math.round(DEFAULTS.dstiLimit * 100)} %, takže tuhle hypotéku nejspíš neschválí. `
          + 'Spořit na akontaci k ceně, na kterou nepůjčí, je práce nazmar.',
        section: 'bydleni',
        actionLabel: 'Zkusit jinou cenu',
      };
    }

    // 3. Chybějící akontace. Je to aktivní spořicí cíl, takže má přednost
    // před rezervou; rezerva se k ní připočte do `why`, ať se na ni
    // nezapomene.
    const gap = downPaymentGap(state);
    if (gap > 0) {
      const monthly = allocations.downPayment > 0 ? allocations.downPayment : free;
      const thinAfter = postPurchaseRunwayMonths(state) < RESERVE_MONTHS;
      const reserveNote = thinAfter
        ? ` Počítejte k tomu ještě s rezervou ${czk(necessary * RESERVE_MONTHS)}: po zaplacení akontace by vám jinak nezbylo na nečekané výdaje.`
        : '';
      return {
        key: 'down_payment',
        action: monthly > 0
          ? `Dospořte akontaci, chybí ${czk(gap)}.`
          : `Na akontaci chybí ${czk(gap)}, ale zatím na ni nic nezbývá.`,
        // Částka chybějící akontace je už ve větě nahoře, tady se neopakuje.
        why: (monthly > 0
          ? 'Při téhle částce ji máte celou v uvedeném termínu, a teprve pak má '
            + 'smysl obcházet banky. Dřív vám nabídku stejně nedají.'
          : 'Peníze na ni musí odněkud přijít, jinak se koupě neposune.')
          + reserveNote,
        monthly: monthly > 0 ? monthly : undefined,
        done: monthly > 0 ? monthYearIn(gap / monthly) : undefined,
        section: 'bydleni',
        actionLabel: 'Nastavit odkládání',
      };
    }
  }

  // 4. Nouzová rezerva. U toho, kdo kupuje, se počítá z toho, co po koupi
  // zbyde, protože akontace většinu úspor odnese.
  const reserveTarget = necessary * RESERVE_MONTHS;
  const reserveNow = buying
    ? postPurchaseRunwayMonths(state) * necessary
    : state.savings.totalSavings;
  if (reserveNow < reserveTarget) {
    const missing = reserveTarget - reserveNow;
    const monthly = free > 0 ? Math.min(free, Math.ceil(missing / 12 / 500) * 500) : 0;
    return {
      key: 'reserve',
      action: monthly > 0
        ? `Postavte nouzovou rezervu ${czk(reserveTarget)}.`
        : `Postavte nouzovou rezervu ${czk(reserveTarget)}. Zatím na ni nic nezbývá.`,
      why: `Chybí ${czk(missing)}, tedy ${formatMonths(RESERVE_MONTHS)} nezbytných výdajů. `
        + 'Bez rezervy se každá nečekaná rána řeší drahou půjčkou, i když jinak plán vychází.'
        + (buying ? ' Počítá se s tím, co zbyde po zaplacení akontace.' : ''),
      monthly: monthly > 0 ? monthly : undefined,
      done: monthly > 0 ? monthYearIn(missing / monthly) : undefined,
      section: 'rozpocet',
      actionLabel: 'Projít výdaje',
    };
  }

  // 5. Na důchod nejde nic.
  if (state.goals.includes('retirement') && allocations.retirement <= 0) {
    const monthly = Math.min(free, Math.max(500, Math.round(totalMonthlyIncome(state) * 0.05 / 500) * 500));
    return {
      key: 'retirement',
      action: monthly > 0
        ? 'Založte si důchodové spoření a nastavte si trvalý příkaz.'
        : 'Na důchod zatím nezbývá nic. Vraťte se k tomu, až se uvolní peníze.',
      why: 'U důchodu rozhoduje spíš to, kdy začnete, než kolik odkládáte: '
        + 'tisícovka měsíčně je za deset let asi 170 tisíc, ale za třicet let přes milion.'
        + (leaveLimits(state, allocations)
          ? ' Částka je podle nejhoršího měsíce rodičovské, aby se dala udržet i tehdy.'
          : ''),
      monthly: monthly > 0 ? monthly : undefined,
      section: 'cile',
      actionLabel: 'Nastavit částku',
    };
  }

  // 6. Všechno drží. Zbývá to, co leží ladem.
  return {
    key: 'grow',
    action: free > 0
      ? 'Rozhodněte, kam půjde volná rezerva.'
      : 'Plán drží. Držte se ho a jednou za rok si ho projděte znovu.',
    why: free > 0
      ? 'Plán vychází a rezervu máte. Peníze, které jen leží na běžném účtu, '
        + 'ztrácejí inflací; ať už půjdou na cíle, nebo do investic, měly by někde pracovat.'
        + (leaveLimits(state, allocations)
          ? ' Částka je podle nejhoršího měsíce rodičovské, aby se dala udržet i tehdy; po jejím skončení jí bude výrazně víc.'
          : '')
      : 'Cíle i rezerva jsou pokryté. Ověřte si plán znovu, až se změní příjem, nájem nebo sazba.',
    monthly: free > 0 ? free : undefined,
    section: free > 0 ? 'cile' : undefined,
    actionLabel: free > 0 ? 'Projít cíle' : undefined,
  };
}
