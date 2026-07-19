import type { WizardState } from '../../types';
import type { GoalAllocations } from '../../engine/allocation';
import { evaluateOverall } from '../../engine/summary';
import type { GoalStatus, OverallStatusKey } from '../../engine/summary';
import { monthlyDisposable, savingsRate, emergencyRunwayMonths } from '../../engine/cashflow';
import { postPurchaseRunwayMonths } from '../../engine/mortgage';
import Tooltip from '../ui/Tooltip';

interface Props {
  state: WizardState;
  allocations: GoalAllocations;
}

const statusStyles: Record<OverallStatusKey, string> = {
  good: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  tight: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  not_yet: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  fix_budget: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
};

const goalDot: Record<GoalStatus, string> = {
  good: 'bg-emerald-500',
  caution: 'bg-amber-500',
  warning: 'bg-red-500',
};

export default function ResultsOverview({ state, allocations }: Props) {
  const summary = evaluateOverall(state, allocations);
  const disposable = monthlyDisposable(state);
  const rate = savingsRate(state);
  // U kupujících je relevantní rezerva PO zaplacení akontace (úspory se z velké
  // části utratí a místo nájmu se platí hypotéka).
  const hasProperty = state.goals.includes('property');
  const runway = hasProperty ? postPurchaseRunwayMonths(state) : emergencyRunwayMonths(state);

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');
  const runwayLabel = runway === Infinity ? '∞' : `${runway.toFixed(1)} měs.`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Verdikt */}
      <div className={`rounded-xl border p-5 mb-5 ${statusStyles[summary.status]}`}>
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">{summary.icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{summary.title}</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary.description}</p>
          </div>
        </div>
      </div>

      {/* KPI dlaždice */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <span className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center">
            Disponibilní částka
            <Tooltip text="Kolik vám měsíčně zbyde po odečtení všech výdajů od čistých příjmů (příjmy − výdaje). Z této částky spoříte na cíle a tvoříte rezervu." />
          </span>
          <p className={`text-xl font-bold ${disposable >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
            {disposable >= 0 ? '+' : ''}{fmt(disposable)} <span className="text-sm font-normal text-gray-400">Kč/měs</span>
          </p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <span className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center">
            Míra úspor
            <Tooltip text="Jaký podíl čistého příjmu vám po výdajích zbývá (disponibilní částka ÷ příjem). Zdravé bývá aspoň 10–20 %." />
          </span>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {(rate * 100).toFixed(1)} <span className="text-sm font-normal text-gray-400">%</span>
          </p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <span className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center">
            {hasProperty ? 'Rezerva po koupi vydrží' : 'Rezerva vydrží'}
            <Tooltip text={hasProperty
              ? 'Kolik měsíců by úspory pokryly nezbytné výdaje při výpadku příjmu — počítáno PO zaplacení akontace a s hypotékou místo nájmu. Ideál je 3–6 měsíců.'
              : 'Kolik měsíců by vaše úspory pokryly nezbytné výdaje při výpadku příjmu (úspory ÷ nezbytné výdaje). Ideál je 3–6 měsíců.'} />
          </span>
          <p className={`text-xl font-bold ${runway >= 6 ? 'text-emerald-600 dark:text-emerald-400' : runway >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
            {runwayLabel}
          </p>
        </div>
      </div>

      {/* Připravenost cílů */}
      {summary.goals.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Připravenost cílů</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {summary.goals.map((g) => (
              <div key={g.key} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${goalDot[g.status]}`} />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{g.label}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400"> — {g.headline}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rozpočtový souhrn */}
      {summary.budget && (
        <div className={`p-3 rounded-lg mb-5 text-sm ${summary.budget.fits ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
          {summary.budget.fits ? (
            <>Cíle vyžadují <strong>{fmt(summary.budget.allocated)} Kč/měs</strong> z <strong>{fmt(summary.budget.disposable)} Kč/měs</strong> disponibilních — zbývá vám ještě <strong>{fmt(summary.budget.surplus)} Kč/měs</strong> volných.</>
          ) : (
            <>Cíle dohromady vyžadují <strong>{fmt(summary.budget.allocated)} Kč/měs</strong>, ale máte <strong>{fmt(summary.budget.disposable)} Kč/měs</strong> — chybí <strong>{fmt(Math.abs(summary.budget.surplus))} Kč/měs</strong>. Upravte částky u cílů níže.</>
          )}
        </div>
      )}

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

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Čísla jsou nejlepší odhad (úroková sazba, výnosy nikdo nepředpoví). Vše se přepočítá, když parametry upravíte — v jednotlivých sekcích níže.
      </p>
    </div>
  );
}
