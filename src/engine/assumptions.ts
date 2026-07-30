import type { WizardState } from '../types';
import { DEFAULTS, DEFAULTS_DATE } from './defaults';
import {
  mortgageRate,
  loanTermYears,
  fixationYears,
  isRateOverridden,
  ownershipCosts,
  isOwnershipCostsOverridden,
  effectiveDownPayment,
  loanAmount,
  totalProjectCost,
  renovationCost,
  downPaymentFraction,
} from './mortgage';
import { evaluateParentalLeave } from './parentalLeave';
import { planHorizonMonths } from './wealthTimeline';
import { formatMonths, formatYears, czk, czkMonthly, percentCompact } from './format';

/**
 * Předpoklady, ze kterých přehled počítá.
 *
 * Vzniklo to poté, co si uživatel nechal výsledky zkontrolovat jiným
 * nástrojem a ten musel půlku předpokladů dohadovat zpětně z čísel: kdo
 * zůstane doma na rodičovské šlo poznat jen z toho, že aritmetika sedí
 * pro jeden z platů. Když jsou předpoklady napsané, dá se výsledek ověřit
 * i zpochybnit, a je vidět, že jde o model, ne o nabídku.
 *
 * Zobrazuje se ve výsledcích i v tisku.
 */

export interface Assumption {
  label: string;
  value: string;
  // Odkud hodnota je: co zadal uživatel vs. co appka odhadla.
  source: 'user' | 'estimate';
  note?: string;
}

export function buildAssumptions(state: WizardState): Assumption[] {
  const rows: Assumption[] = [];
  const buying = state.goals.includes('property');

  if (buying) {
    const renovation = renovationCost(state);
    rows.push({
      label: 'Cena nemovitosti',
      value: czk(state.property.targetPrice),
      source: 'user',
    });

    if (renovation > 0) {
      const r = state.property.renovation!;
      rows.push({
        label: 'Rekonstrukce',
        value: `${czk(renovation)}, ${formatMonths(r.months)}`,
        source: 'user',
        note: r.payingRentMeanwhile
          ? 'Během rekonstrukce se dál platí současné bydlení, takže nájem a splátka běží souběžně.'
          : 'Během rekonstrukce se za současné bydlení neplatí.',
      });
      rows.push({
        label: 'Celková investice',
        value: czk(totalProjectCost(state)),
        source: 'estimate',
        note: 'Cena plus rekonstrukce. Akontace i LTV se počítají z téhle částky, protože banka půjčuje proti hodnotě po rekonstrukci.',
      });
    }

    rows.push({
      label: 'Akontace z vlastních peněz',
      value: `${czk(effectiveDownPayment(state))} (${percentCompact(effectiveDownPayment(state) / Math.max(1, totalProjectCost(state)))} z investice)`,
      source: state.savings.downPaymentFromSavings != null ? 'user' : 'estimate',
      note: state.savings.downPaymentFromSavings != null
        ? undefined
        : `Bez vlastního nastavení počítáme s povinným minimem ${percentCompact(downPaymentFraction(state))}, zbytek úspor zůstává jako rezerva.`,
    });

    rows.push({ label: 'Výše hypotéky', value: czk(loanAmount(state)), source: 'estimate' });

    rows.push({
      label: 'Úroková sazba',
      value: `${percentCompact(mortgageRate(state))} ročně`,
      source: isRateOverridden(state) ? 'user' : 'estimate',
      note: isRateOverridden(state)
        ? 'Zadali jste ji ručně, takže se podle fixace nemění.'
        : `Odvozeno z délky fixace. Základ je průměrná sazba nových hypoték dle ČBA (${DEFAULTS_DATE}) pro pětiletou fixaci.`,
    });

    rows.push({ label: 'Délka splácení', value: formatYears(loanTermYears(state)), source: 'user' });
    rows.push({ label: 'Fixace sazby', value: formatYears(fixationYears(state)), source: 'user' });

    rows.push({
      label: 'Náklady na vlastnictví',
      value: czkMonthly(ownershipCosts(state)),
      source: isOwnershipCostsOverridden(state) ? 'user' : 'estimate',
      note: isOwnershipCostsOverridden(state)
        ? 'Zadali jste je ručně, s cenou nemovitosti se nemění.'
        : `Odhad ${(DEFAULTS.ownershipCostRate * 100).toLocaleString('cs-CZ')} % z ceny ročně: fond oprav, údržba, pojištění a daň z nemovitých věcí. Energie v tom nejsou, ty jsou mezi výdaji.`,
    });
  }

  const leave = evaluateParentalLeave(state);
  if (leave) {
    rows.push({
      label: 'Na rodičovské zůstane',
      value: `Osoba ${leave.parent} (příjem ${czkMonthly(leave.lostSalary)})`,
      source: 'user',
      note: 'Právě tenhle příjem během rodičovské vypadne. U druhé osoby by výsledek vypadal jinak.',
    });
    rows.push({ label: 'Délka rodičovské', value: formatMonths(leave.durationMonths), source: 'user' });

    const manualBenefit = state.parentalLeave?.monthlyBenefit != null;
    rows.push({
      label: 'Dávky během rodičovské',
      value: manualBenefit
        ? `${czkMonthly(leave.monthlyBenefit)} po celou dobu`
        : leave.phases.map((p) => `${p.label}: ${czk(p.monthlyBenefit)}`).join('; '),
      source: manualBenefit ? 'user' : 'estimate',
      note: manualBenefit
        ? 'Zadali jste je ručně.'
        : 'Mateřská se odhaduje z příjmu pečujícího rodiče podle redukčních hranic ČSSZ, potom se čerpá rodičovský příspěvek 350 000 Kč.',
    });
  }

  rows.push({
    label: 'Čisté měsíční příjmy',
    value: czk((state.income.person1NetMonthly ?? 0) + (state.income.person2NetMonthly ?? 0) + (state.income.parentalAllowance ?? 0)),
    source: 'user',
  });
  rows.push({ label: 'Naspořeno', value: czk(state.savings.totalSavings), source: 'user' });

  // Poslední řádek schválně: je to předpoklad o celém přehledu, ne o jednom
  // údaji. Bez něj se dlouhá časová osa čte jako předpověď v budoucích
  // korunách, což by u třicetiletého horizontu byla docela jiná zpráva.
  rows.push({
    label: 'Horizont plánu',
    value: formatYears(Math.round(planHorizonMonths(state) / 12)),
    source: 'estimate',
    note: 'Cesta počítá do odchodu do důchodu, kde ji přebírá důchodová projekce, nejméně ale deset let, '
      + 'aby měl plán co ukázat i těsně před ním. '
      + 'Příjmy i výdaje drží konstantní, takže jsou všechny částky v dnešních cenách: '
      + 'mzdy a výdaje rostou s inflací zhruba stejně a v poměru se vykrátí. '
      + 'Naspořená částka se ale neúročí, což je záměrně konzervativní.',
  });

  return rows;
}
