import type { WizardState } from '../../types';
import { openPlausibilityNotes } from '../../engine/plausibility';

/**
 * Upozornění, že zadané číslo vypadá nereálně.
 *
 * Záměrně **nic nezakazuje**: neblokuje průchod průvodcem, nepřepisuje
 * hodnoty a nesahá na verdikt. Hraničních případů je spousta a appka o nich
 * neví, takže poslední slovo má uživatel. Proto má každá poznámka tlačítko
 * „Je to tak", které ji odklepne natrvalo (`state.dismissedChecks`).
 *
 * Vzhledem je to poznámka, ne poplach. Kdyby to křičelo jako chyba,
 * naučí se to lidé odklikávat, aniž by si to přečetli, a kontrola tím
 * ztratí smysl.
 */
/**
 * Totéž jedním řádkem, pro Přehled.
 *
 * Verdikt je to první, co uživatel vidí, a stojí na zadaných výdajích.
 * Kdo si jídlo zadal za 3 000 pro dva, měl by u zeleného „Máte na to"
 * vidět aspoň to, že odpověď stojí na čísle, které vypadá nízko. Celý
 * rozbor sem ale nepatří: opravit se to dá jen v Rozpočtu, kam vede odkaz.
 */
export function PlausibilityHint({ state, onOpen }: {
  state: WizardState;
  onOpen?: () => void;
}) {
  const notes = openPlausibilityNotes(state);
  if (notes.length === 0) return null;

  const n = notes.length;
  // Skloňování podle číslovky, ne podle jednotného a množného čísla:
  // „2 položky vypadají", ale „5 položek vypadá".
  const what = n === 1
    ? 'Jedna zadaná položka výdajů vypadá nízko'
    : n <= 4
      ? `${n} zadané položky výdajů vypadají nízko`
      : `${n} zadaných položek výdajů vypadá nízko`;

  return (
    <div
      data-testid="kontrola-vstupu-souhrn"
      className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 p-3 rounded-lg bg-sunken border border-line text-sm"
    >
      <svg
        className="w-4 h-4 shrink-0 text-caution" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
      <span className="text-ink-body">{what}. Odpověď níže z nich počítá.</span>
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="no-print inline-flex items-center gap-1 font-medium text-brand hover:underline"
        >
          Zkontrolovat v Rozpočtu
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      )}
    </div>
  );
}

export default function PlausibilityNotes({ state, onDismiss, className = '' }: {
  state: WizardState;
  /** Odklepnutí jedné poznámky. Bez toho se tlačítko nekreslí. */
  onDismiss?: (key: string) => void;
  className?: string;
}) {
  const notes = openPlausibilityNotes(state);
  if (notes.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`.trimEnd()} data-testid="kontrola-vstupu">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
        Stojí za kontrolu
      </p>
      {notes.map((note) => (
        <div
          key={note.key}
          data-testid={`kontrola-${note.key}`}
          className="flex items-start gap-3 p-3 rounded-lg bg-sunken border border-line"
        >
          <svg
            className={`w-4 h-4 mt-0.5 shrink-0 ${note.tone === 'caution' ? 'text-caution' : 'text-ink-faint'}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16.5v.01" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{note.title}</p>
            <p className="mt-0.5 text-sm text-ink-body leading-relaxed">{note.detail}</p>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(note.key)}
              className="no-print shrink-0 min-h-[44px] px-2 -my-1 text-xs font-medium text-ink-muted hover:text-ink hover:underline"
            >
              Je to tak
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
