import type { WizardState } from '../../types';
import { buildAssumptions } from '../../engine/assumptions';
import { DEFAULTS_DATE } from '../../engine/defaults';
import Card from '../ui/Card';

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
          <dt className="text-sm text-ink-muted">{row.label}</dt>
          <dd>
            <span className="text-sm font-medium text-ink">{row.value}</span>
            {row.source === 'estimate' && (
              <span className="ml-2 text-xs text-caution">odhad</span>
            )}
            {row.note && (
              <span className="block text-xs text-ink-muted">{row.note}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <Card>
      <details className="no-print">
        <summary className="cursor-pointer list-none">
          <span className="text-lg font-semibold text-ink">Z čeho přehled počítá</span>
          <span className="block text-sm text-ink-muted">
            Všechny předpoklady na jednom místě. Co jste zadali vy a co jsme odhadli.
          </span>
        </summary>
        <div className="mt-4">{list}</div>
      </details>

      {/* V tisku se předpoklady ukazují vždy, bez nich se report nedá ověřit. */}
      <div className="hidden print:block">
        <h3 className="text-lg font-semibold text-ink mb-3">Z čeho přehled počítá</h3>
        {list}
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Položky označené jako odhad si appka dopočítala z ostatních hodnot, nezadávali jste je.
        Výchozí ekonomická data jsou z {DEFAULTS_DATE}. Jde o orientační model, ne o nabídku banky.
      </p>
    </Card>
  );
}
