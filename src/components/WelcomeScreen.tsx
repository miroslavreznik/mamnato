import type { MortgageFlow } from '../types';
import { loadState } from '../store/localStorage';

interface Props {
  onStart: (flow: MortgageFlow | 'full') => void;
  onResume: () => void;
  hasSavedData?: boolean;
}

const choices = [
  {
    flow: 'property',
    title: 'Prověřit konkrétní byt',
    description: 'Zjistěte, kolik potřebujete při koupi a kolik vám bude zbývat po nastěhování.',
  },
  {
    flow: 'price',
    title: 'Zjistit, jak drahý byt hledat',
    description: 'Spočítejte si cenový strop podle úspor a toho, kolik chcete mít měsíčně stranou.',
  },
  {
    flow: 'full',
    title: 'Sestavit finanční plán',
    description: 'Propojte rozpočet s rezervou, bydlením, dětmi nebo důchodem.',
  },
] as const;

export default function WelcomeScreen({ onStart, onResume, hasSavedData = !!loadState() }: Props) {
  return (
    <div className="mx-auto py-6 sm:py-12">
      <header className="max-w-2xl">
        <h1 className="type-display mb-4 text-balance text-ink">Mám na vlastní bydlení?</h1>
        <p className="max-w-xl text-lg leading-relaxed text-ink-body">
          Prověřte si hypotéku sami nebo ve dvou. Uvidíte, kolik potřebujete na začátku a co koupě udělá s vaším rozpočtem.
        </p>
      </header>

      {hasSavedData && (
        <button
          type="button"
          onClick={onResume}
          className="mt-6 inline-flex min-h-[44px] items-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-brand hover:bg-tint-brand focus-visible:ring-2 focus-visible:ring-ink"
        >
          Pokračovat tam, kde jste skončili
        </button>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {choices.map(({ flow, title, description }) => (
          <div
            key={flow}
            className="relative rounded-2xl border border-line bg-card p-5 transition-colors hover:border-line-strong hover:bg-raised focus-within:ring-2 focus-within:ring-ink"
          >
            <button
              type="button"
              onClick={() => onStart(flow)}
              aria-label={title}
              className="flex w-full items-start justify-between gap-2 rounded text-left font-semibold text-ink after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
            >
              {title}
              <svg className="mt-0.5 size-4 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>
          </div>
        ))}
      </div>

      <p className="mt-7 max-w-lg text-sm leading-relaxed text-ink-muted">
        Zdarma a bez registrace. Údaje zůstávají v prohlížeči. Výsledek je orientační model pro domácnost.
      </p>
    </div>
  );
}
