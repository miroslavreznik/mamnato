import { useState } from 'react';

/**
 * „Do těch čísel se dá sáhnout."
 *
 * Přehled vypadá jako report, ale editovatelný je skoro celý: akontace,
 * sazba, výdaje, částky u cílů, délka rodičovské, termín koupě i dítěte
 * na časové ose.
 * Nikde to není napsané, takže uživatel se vracel do průvodce tlačítkem
 * „Upravit" i tam, kde stačilo přepsat pole před sebou.
 *
 * Je to nápověda, ne varování: zavře se křížkem a víckrát se neukáže.
 * Zavření si pamatuje `localStorage`, stejně jako zbytek appky; je to
 * předvolba zobrazení, ne zadaný údaj, proto má vlastní klíč a neputuje
 * do sdíleného odkazu.
 */

const KEY = 'mamnato.hint.editable.dismissed';

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    // Soukromý režim nebo zakázané úložiště: nápověda se prostě ukáže zas.
    return false;
  }
}

export default function EditableHint() {
  const [hidden, setHidden] = useState(wasDismissed);
  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      // Nevadí, jen se příště ukáže znovu.
    }
  };

  return (
    <div className="no-print mb-5 flex items-start gap-3 rounded-xl bg-sunken px-4 py-3">
      <svg
        className="w-5 h-5 shrink-0 mt-0.5 text-ink-muted"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      >
        <path d="M11 4H4v16h16v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
      </svg>
      <p className="min-w-0 text-sm text-ink-body">
        <span className="font-semibold text-ink">Čísla v přehledu nejsou jen k prohlížení.</span>{' '}
        Kde je pole, posuvník nebo přepínač, dá se do něj sáhnout: výdaje v Rozpočtu,
        akontace a sazba v Bydlení, částky u cílů. Přehled se přepočítá hned a změna se uloží.
        Do průvodce se kvůli tomu vracet nemusíte. Puntíkem na časové ose navíc posunete
        termín koupě nebo narození dítěte; to je úvaha nad grafem a neukládá se.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Skrýt nápovědu"
        className="shrink-0 -my-1 -mr-2 w-11 h-11 inline-flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-card focus:outline-none focus:ring-2 focus:ring-ink"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
