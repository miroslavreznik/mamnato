import { useState, useEffect, useRef } from 'react';

interface TooltipProps {
  text: string;
}

export default function Tooltip({ text }: TooltipProps) {
  // Tři nezávislé důvody, proč nápovědu ukázat. Kdyby se míchaly do jednoho
  // stavu, klepnutí na mobilu by ji hned zase zavřelo (hover + klik naráz).
  const [pinned, setPinned] = useState(false); // klepnutí / kliknutí
  const [hovered, setHovered] = useState(false); // jen skutečná myš
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const show = pinned || hovered || keyboardFocus;

  // Otevřenou (připnutou) nápovědu jde zavřít klepnutím jinam nebo Escapem.
  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPinned(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pinned]);

  return (
    <span ref={wrapRef} className="relative inline-block ml-1 align-middle">
      <button
        type="button"
        className="w-6 h-6 rounded-full bg-shell text-ink-body text-xs font-bold inline-flex items-center justify-center hover:bg-shell dark:hover:bg-sunken focus:outline-none focus:ring-2 focus:ring-ink"
        onClick={() => setPinned((v) => !v)}
        // Hover jen pro myš, dotyk jinak nápovědu otevře a zavře zároveň.
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHovered(false); }}
        // Fokus ukazuje nápovědu při procházení klávesnicí, ne po klepnutí.
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setKeyboardFocus(true); }}
        onBlur={() => setKeyboardFocus(false)}
        aria-label="Nápověda"
        aria-expanded={show}
      >
        ?
      </button>
      {show && (
        <span
          role="tooltip"
          // Tmavá bublina se světlým textem. `bg-card` tu být nesmí: v novém
          // vzhledu má karta stejnou barvu jako stránka, takže `text-page`
          // na ní byl neviditelný a nápověda se sice otevřela, ale nedala
          // se přečíst. Šipka pod bublinou má `border-t-ink` odjakživa.
          className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 block w-64 max-w-[calc(100vw-2rem)] p-2 text-sm font-normal text-left normal-case tracking-normal text-page bg-ink rounded-lg shadow-lg"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-ink" />
        </span>
      )}
    </span>
  );
}
