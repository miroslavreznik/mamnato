import type { ReactNode } from 'react';

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  /** Zobrazená záložka. Ostatní se nevykreslují, aby stránka nebyla nekonečná. */
  active: boolean;
  children: ReactNode;
}

/**
 * Jedna záložka výsledků.
 *
 * Dřív to byl sbalitelný akordeon a všechny sekce šlo mít otevřené naráz.
 * Na mobilu z toho vznikla stránka vysoká 13 639 px, tedy zhruba šestnáct
 * obrazovek scrollování, ve které se nedalo orientovat; verdikt, kvůli
 * kterému sem člověk přišel, byl na prvních 800 px a zbytek byla hromada.
 * Se záložkami je vidět vždy jedna část a nadpis nad ní říká, co uživatel čte.
 *
 * Panel schválně nemá vlastní rámeček. Dřív se rámečky vršily do tří úrovní
 * (sekce → karta → verdikt) a na mobilu z 390 px zbylo po odsazeních asi
 * 300 px na obsah, přičemž všechny hrany měly skoro stejnou váhu. Rámeček
 * teď nese jen karta uvnitř.
 */
export default function ResultsSection({ id, title, subtitle, active, children }: Props) {
  return (
    <section
      id={id}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      hidden={!active}
      className="scroll-mt-32"
    >
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
