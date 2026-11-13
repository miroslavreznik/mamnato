import type { WizardState } from '../../../types';
import { monthlyDisposable } from '../../../engine/cashflow';
import { calculateAllocations } from '../../../engine/allocation';
import { purchaseCashPlan } from '../../../engine/purchasePlan';
import { wealthTimeline } from '../../../engine/wealthTimeline';
import { czk, czkPerMonth, formatMonths } from '../../../engine/format';
import { StepButton, SliderCard } from './shared';

// O kolik se hýbe krokovacími tlačítky a jaký krok má posuvník.
const STEP = 500;

/**
 * Odkládání na koupi včetně peněz, které při koupi potřebujeme navíc k akontaci.
 */
export default function MonthlySavingSlider({ state, value, onChange }: {
  state: WizardState;
  value: number;
  onChange: (value: number) => void;
}) {
  const gap = purchaseCashPlan(state).cashGap;
  if (gap <= 0) return null;

  const disposable = monthlyDisposable(state);
  const max = Math.max(STEP, Math.ceil(disposable / STEP) * STEP);
  const timeline = wealthTimeline(state, { allocations: { ...calculateAllocations(state), downPayment: value } });
  const ready = timeline.earliestCashReadyMonth;
  const share = disposable > 0 ? (value / disposable) * 100 : 0;

  return (
    <SliderCard>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-ink-label">Kolik měsíčně odkládat na koupi</span>
        <span className="shrink-0 text-sm font-bold text-ink whitespace-nowrap">{czkPerMonth(value)}</span>
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
          aria-label="Měsíční odkládání na koupi"
          className="flex-1 min-w-0 h-2 rounded-lg appearance-none cursor-pointer accent-brand bg-shell"
        />
        <StepButton onClick={() => onChange(Math.min(max, value + STEP))} disabled={value >= max} label="Zvýšit měsíční odkládání">
          +
        </StepButton>
      </div>

      <div className="flex justify-between text-xs text-ink-faint mt-1">
        <span>0 Kč</span>
        <span>{czk(max)}</span>
      </div>

      <p className="mt-1.5 text-sm text-ink-body">
        {ready != null
          ? <>Celou potřebnou hotovost byste měli za <span className="font-semibold text-ink">{formatMonths(ready)}</span>.</>
          : <>Na koupi s nastavenými náklady a rezervou dnes chybí {czk(gap)}. V časovém horizontu plánu se potřebná hotovost nenaspoří.</>}
      </p>

      {value > disposable && disposable > 0 && (
        <p className="mt-1 text-xs text-caution">
          Odkládáte víc, než kolik vám měsíčně zbývá ({czk(disposable)}). Na ostatní cíle by nezbylo nic.
        </p>
      )}
      {value <= disposable && value > 0 && disposable > 0 && (
        <p className="mt-1 text-xs text-ink-muted">
          To je {Math.round(share)} % z toho, co vám měsíčně zbývá po výdajích ({czk(disposable)}).
          Zbytek zůstává na ostatní cíle a volnou rezervu.
        </p>
      )}
    </SliderCard>
  );
}
