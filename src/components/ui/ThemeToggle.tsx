import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mamnato_theme';

/**
 * Výchozí je **tmavý** režim, ne ten systémový.
 *
 * Appka je z velké části graf a čísla na něm: stuha, barvy napětí, čáry
 * srovnání. Na tmavém podkladu je to znát a čte se to líp než na papírově
 * světlém, takže tak vypadá appka poprvé.
 *
 * Systémová předvolba se tím na první návštěvě obchází. Je to vědomá volba,
 * ne opomenutí: kdo chce světlý, přepne, a od té chvíle platí jeho volba,
 * protože uložená předvolba má přednost před vším ostatním.
 *
 * Tisk to neřeší; ten si dark mód vypíná sám (`ResultsDashboard`), aby se
 * na papír netiskla tmavá plocha.
 */
function getInitialTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <button
      onClick={toggle}
      className="p-2.5 rounded-lg hover:bg-sunken bg-card/80 backdrop-blur shadow-sm transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
      aria-label={theme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
    >
      {theme === 'light' ? (
        <svg className="w-5 h-5 text-ink-body" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-caution" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )}
    </button>
  );
}
