import { useWhatIf } from '../../store/whatIfStore';
import { mortgageRate, loanTermYears } from '../../engine/mortgage';
import { GOAL_LABELS, customGoalName } from '../../engine/goalNames';
import { czk, formatRate, formatMonths } from '../../engine/format';

/**
 * Ovládání režimu „co kdyby": cíle jako přepínače a pod nimi jejich parametry.
 *
 * Uspořádání je tu celé sdělení. Dřív stály posuvníky nahoře a odkládání cílů
 * pod nimi jako zaškrtávátka, takže nešlo poznat, že „Cena nemovitosti" patří
 * k bydlení a že se dá bydlení taky celé vypnout. Přepínač „Vlastní bydlení"
 * přitom nikdy nebyl jen o spoření: odloží celý cíl, tedy koupě se nekoná,
 * splátka nevznikne a dál se platí nájem. Jmenoval se ale „Spoření na
 * akontaci", což slibovalo mnohem míň, než co dělá.
 *
 * Teď je to seznam cílů, každý s vlastním přepínačem, a parametry visí přímo
 * pod tím cílem, kterého se týkají. Zapnutý cíl své parametry ukáže, vypnutý
 * je schová, protože sazba u nemovitosti, kterou nekupujete, je nesmysl.
 *
 * Posuvníky jsou schválně jen ty, které se dají změnit rozhodnutím: za kolik
 * koupit, za jakou sazbu a jak dlouho zůstat doma s dítětem. Příjem mezi nimi
 * není: „co kdybych bral o deset tisíc víc" je hezká představa, ale plán se
 * podle ní stavět nedá.
 *
 * Vypínání jednotlivých **výdajů** zůstává v grafu na záložce Rozpočet, kde
 * jsou u sebe s čísly, ze kterých vycházejí.
 */

function Slider({ label, value, min, max, step, format, onChange, ariaLabel }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label className="text-[13px] text-ink-body">{label}</label>
        <span className="text-sm font-semibold text-ink tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-brand bg-line"
      />
    </div>
  );
}

/** Cíl jako přepínač. Zapnutý = je v plánu, vypnutý = odložený. */
function GoalToggle({ goalKey, label, amount, on, onToggle }: {
  goalKey: string;
  label: string;
  amount: number;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      // Kotva pro testy. Popisek se mění podle toho, jak si uživatel cíl
      // pojmenoval, takže se na něj hledat nedá.
      data-testid={`whatif-goal-${goalKey}`}
      aria-pressed={on}
      onClick={onToggle}
      className={
        'w-full flex items-center gap-2.5 min-h-[44px] px-3 rounded-xl border text-[13px] '
        + 'text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ink '
        + (on
          ? 'border-line-strong bg-card text-ink'
          : 'border-line bg-transparent text-ink-faint')
      }
    >
      {/* Stav nese tvar, ne jen barva: plné kolečko s háčkem proti prázdnému.
          Samotné zešednutí by se v tisku ani při poruše barvocitu nepoznalo. */}
      <span
        aria-hidden="true"
        className={
          'shrink-0 w-4 h-4 rounded-full border-2 inline-flex items-center justify-center '
          + (on ? 'border-brand bg-brand' : 'border-line-strong')
        }
      >
        {on && (
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="var(--card)" strokeWidth="2">
            <path d="M1.5 5.2 L4 7.5 L8.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={on ? 'font-medium' : 'line-through'}>{label}</span>
      {amount > 0 && (
        <span className="ml-auto shrink-0 text-xs text-ink-muted tabular-nums">
          {czk(amount)}
        </span>
      )}
    </button>
  );
}

export default function WhatIfPanel() {
  const {
    baseline, current, overrides, setOverride,
    excludedGoals, toggleGoal, allGoals, allGoalAllocations, touched, reset,
  } = useWhatIf();

  const hasLeave = !!baseline.parentalLeave?.enabled;

  const price = overrides.propertyPrice ?? baseline.property.targetPrice;
  const rate = overrides.mortgageRate ?? mortgageRate(baseline);
  const leave = overrides.parentalLeaveMonths ?? baseline.parentalLeave?.durationMonths ?? 36;

  // Seznam cílů se staví z `allGoals`, ne z `baseline`: odložený cíl
  // z `baseline` zmizí, takže by zmizel i jeho přepínač a nešlo by ho vrátit
  // zpátky jinak než resetem celé stránky.
  //
  // Parametry jsou u svého cíle. Vlastní cíle a důchod jich zatím žádné
  // nemají, tam zůstane jen přepínač.
  const goals: { key: string; label: string; amount: number; params?: React.ReactNode }[] = [
    ...(allGoals.goals.includes('property') ? [{
      key: 'property',
      label: GOAL_LABELS.property,
      amount: allGoalAllocations.downPayment,
      params: (
        <>
          <Slider
            label="Cena nemovitosti"
            ariaLabel="Cena nemovitosti"
            value={price}
            min={1000000}
            max={15000000}
            step={100000}
            format={czk}
            onChange={(v) => setOverride('propertyPrice', v)}
          />
          <Slider
            label="Úroková sazba"
            ariaLabel="Úroková sazba"
            value={Number((rate * 100).toFixed(2))}
            min={2}
            max={9}
            step={0.1}
            format={(v) => `${formatRate(v / 100)} %`}
            onChange={(v) => setOverride('mortgageRate', v / 100)}
          />
          {/* Doba splácení se posuvníkem nemění, ale patří k obrázku: bez ní
              není z čeho poznat, proč splátka vyšla tak, jak vyšla. */}
          <p className="text-xs text-ink-muted">
            Počítáno na {loanTermYears(current)} let splácení.
          </p>
        </>
      ),
    }] : []),
    ...(allGoals.goals.includes('reserve') ? [{
      key: 'reserve',
      label: GOAL_LABELS.reserve,
      amount: allGoalAllocations.reserve,
    }] : []),
    ...(allGoals.goals.includes('child') ? [{
      key: 'child',
      label: GOAL_LABELS.child,
      amount: allGoalAllocations.child,
      params: hasLeave ? (
        <Slider
          label="Délka rodičovské"
          ariaLabel="Délka rodičovské"
          value={leave}
          min={6}
          max={48}
          step={1}
          format={(v) => formatMonths(v)}
          onChange={(v) => setOverride('parentalLeaveMonths', v)}
        />
      ) : undefined,
    }] : []),
    ...(allGoals.goals.includes('retirement') ? [{
      key: 'retirement',
      label: GOAL_LABELS.retirement,
      amount: allGoalAllocations.retirement,
    }] : []),
    ...(allGoals.customGoals ?? []).map((g, i) => ({
      key: `other:${g.id}`,
      label: customGoalName(allGoals, i),
      amount: allGoalAllocations.custom[i] ?? 0,
    })),
  ];

  return (
    // Panel jsou samé ovládací prvky: přepínače, posuvníky a tlačítko zpět.
    // Na papíře nemají co dělat a zakázané tlačítko by se navíc vytisklo tak
    // vybledlé, že by nešlo přečíst.
    <div className="no-print rounded-2xl bg-sunken p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-section text-ink">Cíle a parametry</h3>
        {touched && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-tint-good text-good">
            živě
          </span>
        )}
      </div>
      <p className="text-[13px] text-ink-body leading-relaxed">
        Vypněte cíl a uvidíte plán bez něj, nebo si pohrajte s jeho parametry.
      </p>

      {goals.length > 0 ? (
        <div className="space-y-2.5">
          {goals.map((g) => {
            const on = !excludedGoals.has(g.key);
            return (
              <div key={g.key}>
                <GoalToggle
                  goalKey={g.key}
                  label={g.label}
                  amount={g.amount}
                  on={on}
                  onToggle={() => toggleGoal(g.key)}
                />
                {/* Parametry jen u zapnutého cíle: sazba u nemovitosti,
                    kterou nekupujete, je otázka bez smyslu. */}
                {on && g.params && (
                  <div className="mt-3 mb-1 pl-3 border-l-2 border-line space-y-3">
                    {g.params}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[13px] text-ink-muted">
          Zatím nemáte zvolený žádný cíl. Vypnout jednotlivé výdaje jde
          v záložce Rozpočet.
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        disabled={!touched}
        className="w-full min-h-[44px] rounded-full border border-line-strong text-sm font-semibold text-ink hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Vrátit původní scénář
      </button>
    </div>
  );
}
