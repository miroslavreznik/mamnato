import { useRef } from 'react';

export interface TabDef {
  id: string;
  label: string;
}

/**
 * Záložky výsledků.
 *
 * Nahradily akordeon, ve kterém šlo mít otevřené všechno naráz. Lišta zůstává
 * u horního okraje, takže je pořád vidět, kde uživatel je a kam může přejít.
 *
 * Klávesnice se u záložek chová jinak než u seznamu tlačítek: tabulátorem se
 * vstoupí do lišty jako celku a mezi záložkami se přepíná šipkami. Bez toho
 * by uživatel klávesnice musel projít všechny záložky, aby se dostal
 * k obsahu té vybrané.
 */
export default function ResultsTabs({ tabs, active, onSelect }: {
  tabs: TabDef[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const move = (delta: number) => {
    const index = tabs.findIndex((t) => t.id === active);
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onSelect(next.id);
    // Fokus musí jít za výběrem, jinak šipka přepne záložku, ale klávesnice
    // zůstane na té původní.
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLButtonElement>(`#tab-${next.id}`)?.focus();
    });
  };

  return (
    <nav
      aria-label="Části přehledu"
      className="no-print sticky top-16 z-30 mb-5 -mx-4 sm:mx-0 px-2 py-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-y sm:border sm:rounded-2xl border-line"
    >
      <div
        ref={listRef}
        role="tablist"
        className="flex gap-1 overflow-x-auto"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
        }}
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={tab.id}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              className={`shrink-0 px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium rounded-xl transition-colors ${
                selected
                  ? 'bg-blue-600 text-white'
                  : 'text-ink-body hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
