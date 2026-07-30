import type { WizardState } from '../../types';
import type { GoalAllocations } from '../../engine/allocation';
import { nextStep } from '../../engine/nextStep';
import { czkPerMonth } from '../../engine/format';

/**
 * „A co teď?"
 *
 * Jedna věc, jedna částka, jeden termín. Stojí hned pod odpovědí, protože to
 * je druhá otázka, kterou si člověk položí: nejdřív „mám na to", pak „tak co
 * mám udělat".
 *
 * Schválně to není seznam. Rady „co můžete udělat" v pravém sloupci zůstávají
 * a jsou jich čtyři pět, jenže seznam možností není úkol: kdo si má vybrat,
 * odejde bez rozhodnutí. Tady je vybráno za něj, v pořadí, ve kterém se ty
 * věci musí řešit, a je vidět proč.
 *
 * Text i výběr kroku staví engine (`nextStep`), tady se jen vykresluje.
 */
export default function NextStepCard({ state, allocations, onOpenSection }: {
  state: WizardState;
  allocations: GoalAllocations;
  onOpenSection?: (id: string) => void;
}) {
  const step = nextStep(state, allocations);

  return (
    <div className="rounded-2xl border border-line-strong bg-card p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">A co teď</p>
      <p className="type-section text-ink max-w-[52ch]">{step.action}</p>

      {(step.monthly !== undefined || step.done) && (
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
          {step.monthly !== undefined && (
            <span>
              <span className="block type-hero text-ink leading-none">{czkPerMonth(step.monthly)}</span>
              {/* Bez popisku je to jen číslo. „Kolik" musí být vidět stejně
                  rychle jako „co". */}
              <span className="block mt-1 text-xs text-ink-muted">odkládat měsíčně</span>
            </span>
          )}
          {step.done && (
            <span className="text-sm text-ink-body pb-1">
              hotovo <strong className="text-ink">{step.done}</strong>
            </span>
          )}
        </div>
      )}

      <p className="mt-3 text-sm text-ink-body max-w-[62ch] leading-relaxed">{step.why}</p>

      {step.section && step.actionLabel && onOpenSection && (
        <button
          type="button"
          onClick={() => onOpenSection(step.section!)}
          className="no-print mt-4 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-sm font-semibold bg-ink text-page hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ink"
        >
          {step.actionLabel}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
