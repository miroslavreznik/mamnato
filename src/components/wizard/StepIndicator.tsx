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
 * Kde v průvodci jsem.
 *
 * Dřív to byla řada koleček s čísly, pod nimi popisky a vedle toho ještě
 * „Krok 6 z 6", dohromady asi sto pixelů, které říkaly totéž třikrát.
 * Na mobilu se popisky lámaly do dvou řádků („Vlastní bydlení").
 *
 * Zbyl proužek a počítadlo. Název kroku nese jeho vlastní nadpis hned pod
 * tím, opakovat ho i tady by byla ta stejná chyba v malém.
 *
 * Proužek je rozdělený na dílky po krocích: hotové dílky jsou tlačítka, takže
 * se pořád dá skočit zpět na už vyplněný krok, jen to nezabírá čtvrtinu
 * obrazovky.
 */
export default function StepIndicator({ currentStep, steps, completedSteps, onStepClick }: StepIndicatorProps) {
  const total = steps.length;
  const currentIndex = steps.findIndex((s) => s.step === currentStep);
  const position = currentIndex >= 0 ? currentIndex + 1 : currentStep;

  return (
    <nav className="mb-6" aria-label="Kroky průvodce">
      <p className="text-xs text-gray-400 dark:text-gray-500 text-right mb-1.5">Krok {position} z {total}</p>

      <ol className="flex gap-1">
        {steps.map((item, i) => {
          const done = completedSteps.includes(item.step);
          const isCurrent = item.step === currentStep;
          const canJump = done && !isCurrent;
          const fill = isCurrent || done
            ? 'bg-blue-600 dark:bg-blue-500'
            : 'bg-gray-200 dark:bg-gray-700';

          return (
            <li key={item.step} className="flex-1">
              {canJump ? (
                <button
                  type="button"
                  onClick={() => onStepClick(item.step)}
                  aria-label={`Zpět na krok ${i + 1}: ${item.label}`}
                  // Proužek je tenký, ale sáhnout se na něj musí dát i prstem,
                  // proto je kolem něj neviditelná výplň do 44 px.
                  className="group block w-full py-3 -my-3 cursor-pointer"
                >
                  <span className={`block h-1.5 rounded-full transition-colors ${fill} group-hover:bg-blue-700 dark:group-hover:bg-blue-400`} />
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`block h-1.5 rounded-full ${fill}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
