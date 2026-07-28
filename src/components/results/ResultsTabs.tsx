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
    <nav aria-label="Části přehledu" className="no-print min-w-0">
      <div
        ref={listRef}
        role="tablist"
        // Na úzkém okně se pilulky zalomí do dalšího řádku, neposouvají se.
        // Posun schovává část záložek za okraj, takže uživatel neví, co mu
        // uniká, a na dotyku se do lišty snadno trefí prstem při scrollování
        // stránky. Zalomení má všechno vidět naráz.
        //
        // Zaoblení jde s tím: dokonale kulatý obal vypadá u dvou řádků jako
        // omyl, proto se plné kolečko nechává až na desktop, kde je řádek jeden.
        className="flex flex-wrap lg:flex-nowrap justify-center gap-0.5 p-1 rounded-2xl lg:rounded-full bg-shell"
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
              // Šířka podle textu, ne rovným dílem. Rovné dělení fungovalo,
              // dokud byly záložky tři; u šesti by z „Rozpočet" a „Cíle" byly
              // stejně široké pilulky a kratší popisek by plaval v prázdnu.
              className={`shrink-0 whitespace-nowrap px-3 min-h-[44px] lg:min-h-[40px] text-[13px] font-semibold rounded-full transition-colors ${
                selected
                  ? 'bg-raised text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink-body'
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
