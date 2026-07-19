import type { ReactNode } from 'react';

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

// Sbalitelná tematická sekce výsledků. Řízená zvenčí (stav drží dashboard),
// aby ji šlo otevřít i z horní navigace „přejít na".
export default function ResultsSection({ id, title, subtitle, open, onToggle, children }: Props) {
  return (
    <section id={id} className="scroll-mt-32 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-gray-50/50 dark:bg-gray-800/30">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors"
      >
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        <svg
          className={`no-print w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-3 sm:px-4 pb-4 space-y-6">{children}</div>}
    </section>
  );
}
