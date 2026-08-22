import { useState, type ReactNode } from 'react';

/**
 * Na desktopu nechává plánovače cílů pod sebou. Na mobilu z nich dělá
 * přehledné akordeony, aby uživatel nemusel projet několik tisíc pixelů,
 * než najde důchod, dítě nebo rodičovskou.
 */
export default function GoalPlannerPanel({
  id,
  label,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string;
  label: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `goal-panel-${id}`;

  return (
    <section className="sm:contents">
      <button
        type="button"
        className="no-print sm:hidden w-full min-h-[56px] px-4 py-3 rounded-xl border border-line bg-card flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{label}</span>
          {summary && <span className="block mt-0.5 text-xs text-ink-muted">{summary}</span>}
        </span>
        <svg
          className={`w-4 h-4 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div id={panelId} className={`${open ? 'block' : 'hidden'} sm:block print:block`}>
        {children}
      </div>
    </section>
  );
}
