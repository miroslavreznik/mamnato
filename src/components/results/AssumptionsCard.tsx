import type { WizardState } from '../../types';
import { buildAssumptions } from '../../engine/assumptions';
import { DEFAULTS_DATE } from '../../engine/defaults';

/**
 * Předpoklady výpočtu.
 *
 * Ve výsledcích je sbalená, v tisku se rozbaluje vždy (`hidden print:block`),
 * protože právě v tištěném reportu chyběla nejvíc: bez ní se dalo jen hádat,
 * kdo zůstane na rodičovské nebo odkud se vzala sazba.
 */
export default function AssumptionsCard({ state }: { state: WizardState }) {
  const rows = buildAssumptions(state);
  if (rows.length === 0) return null;

  const list = (
    <dl className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label} className="grid sm:grid-cols-[minmax(0,14rem)_1fr] gap-x-4 gap-y-0.5">
          <dt className="text-sm text-gray-500 dark:text-gray-400">{row.label}</dt>
          <dd>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{row.value}</span>
            {row.source === 'estimate' && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">odhad</span>
            )}
            {row.note && (
              <span className="block text-xs text-gray-500 dark:text-gray-400">{row.note}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <details className="no-print">
        <summary className="cursor-pointer list-none">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Z čeho přehled počítá</span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">
            Všechny předpoklady na jednom místě. Co jste zadali vy a co jsme odhadli.
          </span>
        </summary>
        <div className="mt-4">{list}</div>
      </details>

      {/* V tisku se předpoklady ukazují vždy, bez nich se report nedá ověřit. */}
      <div className="hidden print:block">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Z čeho přehled počítá</h3>
        {list}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Položky označené jako odhad si appka dopočítala z ostatních hodnot, nezadávali jste je.
        Výchozí ekonomická data jsou z {DEFAULTS_DATE}. Jde o orientační model, ne o nabídku banky.
      </p>
    </div>
  );
}
