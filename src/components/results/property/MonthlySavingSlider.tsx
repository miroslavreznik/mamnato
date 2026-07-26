import type { WizardState } from '../../../types';
import { downPaymentGap } from '../../../engine/mortgage';
import { monthlyDisposable } from '../../../engine/cashflow';
import { monthsToSaveAtAllocation } from '../../../engine/allocation';
import { czk, czkPerMonth, formatMonths } from '../../../engine/format';
import { StepButton, SliderCard } from './shared';

// O kolik se hýbe krokovacími tlačítky a jaký krok má posuvník.
const STEP = 500;

/**
 * Kolik měsíčně odkládat na chybějící akontaci.
 *
 * Akontace je cíl jako každý jiný: něco na ni měsíčně jde a podle toho se
 * počítá, kdy bude naspořená. Dřív appka mlčky předpokládala, že na ni jde
 * celá disponibilní částka, takže slibovala termín, který platil jen tomu,
 * kdo nespoří na nic dalšího.
 */
export default function MonthlySavingSlider({ state, value, onChange }: {
  state: WizardState;
  value: number;
  onChange: (value: number) => void;
}) {
  const gap = downPaymentGap(state);
  if (gap <= 0) return null;

  const disposable = monthlyDisposable(state);
  const max = Math.max(STEP, Math.ceil(disposable / STEP) * STEP);
  const months = monthsToSaveAtAllocation(state, value);
  const share = disposable > 0 ? (value / disposable) * 100 : 0;

  return (
    <SliderCard>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Kolik měsíčně odkládat na akontaci</span>
        <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">{czkPerMonth(value)}</span>
      </div>

      <div className="flex items-center gap-2">
        <StepButton onClick={() => onChange(Math.max(0, value - STEP))} disabled={value <= 0} label="Snížit měsíční odkládání">
          −
        </StepButton>
        <input
          type="range"
          min={0}
          max={max}
          step={STEP}
          value={Math.min(value, max)}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Měsíční odkládání na akontaci"
          className="flex-1 min-w-0 h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 bg-gray-200 dark:bg-gray-600"
        />
        <StepButton onClick={() => onChange(Math.min(max, value + STEP))} disabled={value >= max} label="Zvýšit měsíční odkládání">
          +
        </StepButton>
      </div>

      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0 Kč</span>
        <span>{czk(max)}</span>
      </div>

      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
        {value > 0
          ? <>Chybějících {czk(gap)} takhle naspoříte za <span className="font-semibold text-gray-900 dark:text-white">{formatMonths(months)}</span>.</>
          : <>Dokud na akontaci nic neodkládáte, chybějících {czk(gap)} nenaspoříte.</>}
      </p>

      {value > disposable && disposable > 0 && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          Odkládáte víc, než kolik vám měsíčně zbývá ({czkPerMonth(disposable)}). Na ostatní cíle by nezbylo nic.
        </p>
      )}
      {value <= disposable && value > 0 && disposable > 0 && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          To je {Math.round(share)} % z toho, co vám měsíčně zbývá po výdajích ({czkPerMonth(disposable)}).
          Zbytek zůstává na ostatní cíle a volnou rezervu.
        </p>
      )}
    </SliderCard>
  );
}
