import type { ReactNode } from 'react';
import BrandMark from './BrandMark';
import ThemeToggle from './ThemeToggle';

/**
 * Horní lišta aplikace.
 *
 * Na výsledcích byly dřív tři pruhy pod sebou: hlavička se značkou, karta
 * s názvem plánu a akcemi, a pod ní lišta se záložkami. Tři lišty podobné
 * váhy nad obsahem vypadaly jako nedodělek a na mobilu zabraly skoro třetinu
 * první obrazovky, tedy přesně toho místa, kde má být vidět odpověď.
 *
 * Teď je lišta jedna a obsah se do ní vkládá: uprostřed záložky, vpravo akce.
 * Průvodce a úvod nechávají obojí prázdné, takže jim zbyde jen značka.
 *
 * Na užších oknech se záložky odsunou pod značku, protože vedle sebe se
 * pět záložek a tři akce do 390 px nevejdou. Přeskládá je zalomení flexu,
 * ne druhá kopie: dvě kopie by znamenaly dvě sady `id`, což rozbije
 * `aria-controls` u záložek a v testu se pak `#tab-cile` najde dvakrát.
 */
export default function AppBar({ onHome, chip, center, actions }: {
  onHome: () => void;
  /** Nálepka vedle značky, například režim domácnosti. */
  chip?: ReactNode;
  /** Střed lišty. Na mobilu se přesune na druhý řádek. */
  center?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="no-print sticky top-0 z-40 backdrop-blur-md bg-card/80 border-b border-line">
      <div className="mx-auto max-w-app px-4">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-3 gap-y-2 py-2 lg:py-0 lg:h-16">
          <button
            onClick={onHome}
            className="flex items-center gap-2.5 shrink-0"
            aria-label="MámNaTo? Domů"
          >
            <BrandMark className="w-9 h-9" />
            {/* Otazník je součástí značky vedle, proto tady není podruhé.
                Celý název nese `aria-label` na tlačítku i na značce. */}
            <span className="type-section text-ink">MámNaTo</span>
          </button>

          {chip}

          <div className="ml-auto flex items-center gap-1 shrink-0 order-1 lg:order-none">
            {actions}
            <ThemeToggle />
          </div>

          {/* Na mobilu druhý řádek přes celou šířku, na desktopu střed lišty. */}
          {center && (
            <div className="w-full order-2 lg:order-none lg:w-auto lg:flex-1 lg:flex lg:justify-center min-w-0">
              {center}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
