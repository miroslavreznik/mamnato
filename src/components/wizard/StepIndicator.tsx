export interface StepItem {
  step: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: StepItem[];
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

/**
 * Kde v průvodci jsem a kam se dá skočit.
 *
 * Dřív to byla řada koleček s čísly, pod nimi popisky a vedle toho ještě
 * „Krok 6 z 6", dohromady asi sto pixelů, které říkaly totéž třikrát.
 * Zbyl z toho holý proužek s počítadlem, jenže tím se ztratilo i to, **co
 * který dílek je**. Kdo se z výsledků vrátil tlačítkem „Upravit", uviděl
 * „Krok 5 z 6" a pruh beze jmen: chtěl se přesunout na výdaje a neměl podle
 * čeho kliknout.
 *
 * Jména jsou proto zpátky, ale jako popisek dílku, ne jako druhá řada koleček.
 * Hotový krok je tlačítko, na které jde skočit, současný je zvýrazněný
 * a nezačaté kroky jsou jen napsané. Počítadlo zůstává pro čtečky a pro
 * jistotu, ale už není jediné, co uživatel má.
 */
export default function StepIndicator({ currentStep, steps, completedSteps, onStepClick }: StepIndicatorProps) {
  const total = steps.length;
  const currentIndex = steps.findIndex((s) => s.step === currentStep);
  const position = currentIndex >= 0 ? currentIndex + 1 : currentStep;

  return (
    <nav className="mb-6" aria-label="Kroky průvodce">
      <p className="text-xs text-ink-faint text-right mb-1.5">Krok {position} z {total}</p>

      <ol className="flex gap-1">
        {steps.map((item, i) => {
          const done = completedSteps.includes(item.step);
          const isCurrent = item.step === currentStep;
          const canJump = done && !isCurrent;
          const fill = isCurrent || done ? 'bg-ink' : 'bg-shell';
          // Na úzkém okně se popisek zalomí do dvou řádků, neuřízne se:
          // „Vlastní bydlení" i „Vlastní cíle" končily jako „Vlastní…"
          // a nešly od sebe rozeznat, což je přesně to, kvůli čemu tu jména
          // jsou. Pruh zůstane zarovnaný, ten sedí na horní hraně dílku.
          const labelClass = 'block mt-1.5 text-[10px] sm:text-[11px] leading-tight line-clamp-2 '
            + (isCurrent ? 'text-ink font-semibold' : done ? 'text-ink-body' : 'text-ink-faint');

          return (
            <li key={item.step} className="flex-1 min-w-0">
              {canJump ? (
                <button
                  type="button"
                  onClick={() => onStepClick(item.step)}
                  aria-label={`Zpět na krok ${i + 1}: ${item.label}`}
                  className="group block w-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-ink rounded"
                >
                  {/* Proužek je tenký, ale sáhnout se na něj musí dát i prstem.
                      Výšku cíle dělá popisek pod ním, proto tu už není záporný
                      margin: celé tlačítko má přes 40 px. */}
                  <span className={`block h-1.5 rounded-full transition-colors ${fill} group-hover:bg-ink`} />
                  <span className={`${labelClass} group-hover:text-ink`}>{item.label}</span>
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className="block"
                >
                  <span className={`block h-1.5 rounded-full ${fill}`} />
                  <span className={labelClass}>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
