import type { WizardState } from '../../types';
import type { GoalAllocations } from '../../engine/allocation';
import { evaluateOverall } from '../../engine/summary';
import type { GoalStatus, VerdictAnswer } from '../../engine/summary';
import { monthlyDisposable, savingsRate, emergencyRunwayMonths } from '../../engine/cashflow';
import { postPurchaseRunwayMonths, mortgagePayment, downPaymentGap, dsti, requiredDownPayment, downPaymentFraction } from '../../engine/mortgage';
import { monthsToSaveAtAllocation } from '../../engine/allocation';
import { DEFAULTS } from '../../engine/defaults';
import { formatMonths, formatNumber as fmt } from '../../engine/format';
import Tooltip from '../ui/Tooltip';
import BudgetSummary from './BudgetSummary';

interface Props {
  state: WizardState;
  allocations: GoalAllocations;
}

// Odpověď „Mám na to?": zelená ano, jantarová ano s výhradou, oranžová zatím ne
// s cestou ven, červená jasné ne.
const verdictStyles: Record<VerdictAnswer, { box: string; text: string }> = {
  yes: {
    box: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  yes_but: {
    box: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
  },
  no_but: {
    box: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-400',
  },
  no: {
    box: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
  },
};

type Tone = 'good' | 'warn' | 'bad' | 'plain';

interface Kpi {
  label: string;
  tooltip: string;
  value: string;
  unit?: string;
  sub?: string;
  tone: Tone;
  // Naplnění 0..1 pro proužek pod číslem. Ukazuje, jak daleko je hodnota
  // od svého cíle, takže stav jde poznat bez čtení.
  meter?: number;
}

const toneClass: Record<Tone, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-red-600 dark:text-red-400',
  plain: 'text-gray-900 dark:text-white',
};

const meterBar: Record<Tone, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  plain: 'bg-blue-500',
};

// Stav cíle slovem, ne jen barvou. Samotná tečka nešla bez legendy pochopit
// a legenda navíc pro tři stavy nemá cenu.
const goalBadge: Record<GoalStatus, { label: string; className: string }> = {
  good: {
    label: 'V pořádku',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  caution: {
    label: 'Pozor',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  warning: {
    label: 'Nevychází',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
};

export default function ResultsOverview({ state, allocations }: Props) {
  const summary = evaluateOverall(state, allocations);
  const disposable = monthlyDisposable(state);
  const rate = savingsRate(state);
  // U kupujících je relevantní rezerva PO zaplacení akontace (úspory se z velké
  // části utratí a místo nájmu se platí hypotéka).
  const hasProperty = state.goals.includes('property');
  const runway = hasProperty ? postPurchaseRunwayMonths(state) : emergencyRunwayMonths(state);

  const runwayLabel = runway === Infinity ? '∞' : runway.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const runwayTone: Tone = runway >= 6 ? 'good' : runway >= 3 ? 'warn' : 'bad';

  // Dlaždice se liší podle toho, co uživatel řeší. U hypotéky jsou nejdůležitější
  // splátka a akontace (jinak schované ve sbalené sekci Bydlení), ne obecné
  // ukazatele rozpočtu, které stejně vidí hned pod tím v grafu.
  const kpis: Kpi[] = hasProperty
    ? [
        (() => {
          const payment = mortgagePayment(state);
          const dstiPct = dsti(state);
          return {
            label: 'Měsíční splátka',
            tooltip: 'Odhadovaná splátka hypotéky při zadané ceně, akontaci, sazbě a délce splácení. Kolik z příjmu ukrojí, ukazuje řádek pod částkou (DSTI).',
            value: fmt(payment),
            unit: 'Kč/měs.',
            sub: isFinite(dstiPct) ? `${Math.round(dstiPct * 100)} % čistého příjmu` : undefined,
            tone: !isFinite(dstiPct) || dstiPct > DEFAULTS.dstiLimit ? 'bad' : dstiPct > DEFAULTS.dstiLimit * 0.85 ? 'warn' : 'plain',
            // Proužek vůči obvyklému bankovnímu stropu DSTI.
            meter: isFinite(dstiPct) ? dstiPct / DEFAULTS.dstiLimit : 1,
          };
        })(),
        (() => {
          const gap = downPaymentGap(state);
          const months = monthsToSaveAtAllocation(state, allocations.downPayment);
          const required = requiredDownPayment(state.property.targetPrice, downPaymentFraction(state));
          return {
            label: 'Chybějící akontace',
            tooltip: 'Rozdíl mezi akontací, kterou banka požaduje (20 % ceny, u žadatelů do 36 let 10 %), a tím, co pokryjete z úspor. Bez ní vám banka hypotéku neposkytne.',
            value: gap > 0 ? fmt(gap) : '0',
            unit: 'Kč',
            sub: gap > 0
              ? (isFinite(months) ? `naspoříte za ${formatMonths(months, true)}` : 'zatím na ni nic neodkládáte')
              : 'akontaci máte pokrytou',
            tone: gap > 0 ? (isFinite(months) ? 'warn' : 'bad') : 'good',
            // Kolik z požadované akontace je už pokryto.
            meter: required > 0 ? (required - gap) / required : 1,
          };
        })(),
        {
          label: 'Rezerva po koupi vydrží',
          tooltip: 'Kolik měsíců by úspory pokryly nezbytné výdaje při výpadku příjmu, počítáno PO zaplacení akontace a s hypotékou místo nájmu. Ideál je 3–6 měsíců.',
          value: runwayLabel,
          unit: 'měs.',
          tone: runwayTone,
          meter: runway === Infinity ? 1 : runway / 6,
        },
      ]
    : [
        {
          label: 'Disponibilní částka',
          tooltip: 'Kolik vám měsíčně zbyde po odečtení všech výdajů od čistých příjmů (příjmy − výdaje). Z této částky spoříte na cíle a tvoříte rezervu.',
          value: `${disposable >= 0 ? '+' : ''}${fmt(disposable)}`,
          unit: 'Kč/měs.',
          tone: disposable >= 0 ? 'plain' : 'bad',
        },
        {
          label: 'Míra úspor',
          tooltip: 'Jaký podíl čistého příjmu vám po výdajích zbývá (disponibilní částka ÷ příjem). Zdravé bývá aspoň 10–20 %.',
          value: (rate * 100).toFixed(1),
          unit: '%',
          tone: rate >= 0.2 ? 'good' : rate >= 0.1 ? 'plain' : 'warn',
          meter: rate / 0.2,
        },
        {
          label: 'Rezerva vydrží',
          tooltip: 'Kolik měsíců by vaše úspory pokryly nezbytné výdaje při výpadku příjmu (úspory ÷ nezbytné výdaje). Ideál je 3–6 měsíců.',
          value: runwayLabel,
          unit: 'měs.',
          tone: runwayTone,
          meter: runway === Infinity ? 1 : runway / 6,
        },
      ];

  // Bydlení patří mezi cíle jako každý jiný. Dřív se odsud vyřazovalo,
  // protože ho pokrývají dlaždice nad tím, jenže ty ukazují jen čísla
  // (splátka, akontace, rezerva). Odpověď „vychází ten cíl, nebo ne?"
  // v přehledu chyběla, přestože je to ten největší závazek ze všech.
  const readinessGoals = summary.goals;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Odpověď na otázku z názvu appky i její rozbor. Jedna karta, aby se
          totéž neříkalo dvakrát za sebou. */}
      <div className={`rounded-xl border p-5 sm:p-6 mb-5 ${verdictStyles[summary.verdict.answer].box}`}>
        <div className="text-center">
          <span className="text-3xl leading-none" aria-hidden="true">{summary.icon}</span>
          <p className="mt-1 text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight">
            <span className={verdictStyles[summary.verdict.answer].text}>{summary.verdict.headline}</span>
            {summary.verdict.qualifier && (
              <>
                <span className={verdictStyles[summary.verdict.answer].text}>,</span>{' '}
                <span className="text-gray-500 dark:text-gray-400 font-bold">{summary.verdict.qualifier}</span>
              </>
            )}
            <span className={verdictStyles[summary.verdict.answer].text}>
              {summary.verdict.answer === 'yes' || summary.verdict.answer === 'no' ? '.' : '…'}
            </span>
          </p>
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            {summary.verdict.reason}
          </p>
        </div>

        {/* U vlastního bydlení jsou otázky ve skutečnosti dvě: jestli na něj
            dosáhnete a jestli po něm zbyde na zbytek. Jedna nálepka je slučuje
            a uživatel pak nepozná, která z nich ho brzdí. */}
        {summary.verdict.questions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 space-y-2">
            {summary.verdict.questions.map((q) => (
              <div key={q.question} className="flex items-start gap-2.5">
                <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${goalBadge[q.status].className}`}>
                  {goalBadge[q.status].label}
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-200 min-w-0">
                  <span className="font-semibold">{q.question}</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{q.answer}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Čísla, na kterých verdikt stojí */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <span className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center">
              {k.label}
              <Tooltip text={k.tooltip} />
            </span>
            <p className={`text-xl font-bold whitespace-nowrap ${toneClass[k.tone]}`}>
              {k.value}
              {k.unit && <span className="text-sm font-normal text-gray-400"> {k.unit}</span>}
            </p>
            {k.meter !== undefined && (
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                <div
                  className={`h-full rounded-full ${meterBar[k.tone]}`}
                  style={{ width: `${Math.max(4, Math.min(100, k.meter * 100))}%` }}
                />
              </div>
            )}
            {k.sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Stav jednotlivých cílů */}
      {readinessGoals.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Jak jste na tom s cíli</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {readinessGoals.map((g) => (
              <div key={g.key} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{g.label}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${goalBadge[g.status].className}`}>
                    {goalBadge[g.status].label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{g.headline}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rozpočtový souhrn: dnes a po koupi */}
      {summary.budget && <BudgetSummary now={summary.budget} after={summary.budgetAfter} />}

      {/* Tipy */}
      {summary.tips.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Co můžete udělat:</h4>
          <ul className="space-y-1.5">
            {summary.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-blue-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
