import { useId, useState } from 'react';
import type { WizardState } from '../../types';
import { buildAssumptions } from '../../engine/assumptions';
import { DEFAULTS_DATE } from '../../engine/defaults';
import Card from '../ui/Card';

/**
 * Předpoklady výpočtu.
 *
 * Ve výsledcích je sbalená, na papíře se rozbaluje vždy (`print-open`),
 * protože právě v tištěném reportu chyběla nejvíc: bez ní se dalo jen hádat,
 * kdo zůstane na rodičovské nebo odkud se vzala sazba.
 *
 * Sbaleno neznamená schováno. Dřív to bylo `<details>` s `list-none`, tedy
 * bez trojúhelníčku, bez šipky a bez jakékoli změny při najetí myší: nadpis
 * vypadal jako každý jiný nadpis v přehledu a nic neprozrazovalo, že se pod
 * ním něco skrývá. Teď je to celé tlačítko se šipkou, která se otočí, a se
 * slovem, co se stane („Zobrazit rozpis" / „Skrýt rozpis").
 */
export default function AssumptionsCard({ state }: { state: WizardState }) {
  const rows = buildAssumptions(state);
  const [open, setOpen] = useState(false);
  const id = useId();
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
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="no-print w-full flex items-start gap-3 text-left -m-2 p-2 rounded-xl hover:bg-sunken focus:outline-none focus:ring-2 focus:ring-ink transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="type-section text-ink">Z čeho přehled počítá</span>
          <span className="block text-sm text-ink-muted">
            Všechny předpoklady na jednom místě. Co jste zadali vy a co jsme odhadli.
          </span>
        </span>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-sm text-brand font-medium mt-0.5">
          {open ? 'Skrýt rozpis' : 'Zobrazit rozpis'}
          <svg
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {/* V tisku se předpoklady ukazují vždy, bez nich se report nedá ověřit. */}
      <div
        id={id}
        data-testid="predpoklady"
        className="mt-4 print-open"
        style={open ? undefined : { display: 'none' }}
      >
        <h3 className="hidden print:block type-section text-ink mb-3">Z čeho přehled počítá</h3>
        {list}
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Položky označené jako odhad si appka dopočítala z ostatních hodnot, nezadávali jste je.
        Výchozí ekonomická data jsou z {DEFAULTS_DATE}. Jde o orientační model, ne o nabídku banky.
      </p>
    </Card>
  );
}
