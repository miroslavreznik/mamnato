import { useWhatIf } from '../../store/whatIfStore';
import { mortgageRate, loanTermYears } from '../../engine/mortgage';
import { czk, formatRate, formatMonths } from '../../engine/format';

/**
 * Ovládání režimu „co kdyby": tři posuvníky a tlačítko zpět.
 *
 * Posuvníky jsou schválně jen tři a jsou to ty, které se skutečně dají
 * změnit rozhodnutím: za kolik koupit, za jakou sazbu a jak dlouho zůstat
 * doma. Příjem mezi nimi není: „co kdybych bral o deset tisíc víc" je hezká
 * představa, ale plán se podle ní stavět nedá.
 *
 * Vypínání jednotlivých **výdajů** zůstává v grafu na záložce Rozpočet, kde
 * jsou u sebe s čísly, ze kterých vycházejí. Odkládání **cílů** je naopak
 * tady: „co kdybych auto o rok odložil" je přesně ta otázka, na kterou je
 * tahle záložka. Dřív se cíl dal odložit jen v kartě vlastních cílů, kde to
 * byl místní stav a nezměnilo to ani verdikt, ani rozpočet; jen zešedla
 * karta.
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

export default function WhatIfPanel() {
  const {
    baseline, current, overrides, setOverride,
    excludedGoals, toggleGoal, allGoals, allGoalAllocations, touched, reset,
  } = useWhatIf();

  const hasProperty = baseline.goals.includes('property');
  const hasLeave = !!baseline.parentalLeave?.enabled;

  // Seznam cílů, které jde odložit. Vlastní cíle po jednom, ostatní jako
  // celek: „odložit důchod" je jedno rozhodnutí, kdežto vlastních cílů bývá
  // víc a odkládá se konkrétní z nich.
  //
  // Staví se z `allGoals`, ne z `baseline`: odložený cíl z `baseline` zmizí,
  // takže by zmizel i jeho přepínač a nešlo by ho vrátit zpátky.
  const goalToggles: { key: string; label: string; amount: number }[] = [
    ...(allGoals.goals.includes('property') ? [{ key: 'property', label: 'Spoření na akontaci', amount: allGoalAllocations.downPayment }] : []),
    ...(allGoals.goals.includes('retirement') ? [{ key: 'retirement', label: 'Spoření na důchod', amount: allGoalAllocations.retirement }] : []),
    ...(allGoals.goals.includes('child') ? [{ key: 'child', label: 'Rezerva na dítě', amount: allGoalAllocations.child }] : []),
    ...(allGoals.customGoals ?? []).map((g, i) => ({
      key: `other:${g.id}`,
      label: g.name.trim() || `Vlastní cíl ${i + 1}`,
      amount: allGoalAllocations.custom[i] ?? 0,
    })),
  ];

  const price = overrides.propertyPrice ?? baseline.property.targetPrice;
  const rate = overrides.mortgageRate ?? mortgageRate(baseline);
  const leave = overrides.parentalLeaveMonths ?? baseline.parentalLeave?.durationMonths ?? 36;

  return (
    // Panel jsou samé ovládací prvky: posuvníky a tlačítko zpět. Na papíře
    // nemají co dělat a zakázané tlačítko by se navíc vytisklo tak vybledlé,
    // že by nešlo přečíst.
    <div className="no-print rounded-2xl bg-sunken p-5 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-section text-ink">Co kdyby</h3>
        {touched && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-tint-good text-good">
            živě
          </span>
        )}
      </div>
      <p className="text-[13px] text-ink-body leading-relaxed">
        Hýbejte čímkoli. Cesta vlevo se překreslí při každém pohybu a původní
        scénář zůstane vidět jako přerušovaný obrys.
      </p>

      {hasProperty && (
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
        </>
      )}

      {hasLeave && (
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
      )}

      {!hasProperty && !hasLeave && (
        <p className="text-[13px] text-ink-muted">
          Posuvníky se nabízejí u vlastního bydlení a u rodičovské. Vypnout
          jednotlivé výdaje jde v záložce Rozpočet.
        </p>
      )}

      {goalToggles.length > 0 && (
        <div className="pt-1">
          <h4 className="text-[13px] font-semibold text-ink-label mb-1">Odložit cíl</h4>
          <p className="text-xs text-ink-muted mb-2">
            Odložený cíl přestane ukrajovat z rozpočtu a peníze se uvolní
            ostatním. Přepočítá se celý přehled včetně odpovědi nahoře.
          </p>
          <div className="space-y-1">
            {goalToggles.map((g) => {
              const off = excludedGoals.has(g.key);
              return (
                <label
                  key={g.key}
                  className="flex items-center gap-2.5 min-h-[44px] cursor-pointer text-[13px] text-ink-body"
                >
                  <input
                    type="checkbox"
                    checked={!off}
                    onChange={() => toggleGoal(g.key)}
                    className="w-4 h-4 shrink-0 accent-brand"
                  />
                  <span className={off ? 'line-through text-ink-faint' : ''}>{g.label}</span>
                  {g.amount > 0 && (
                    <span className="ml-auto shrink-0 text-xs text-ink-muted tabular-nums">
                      {czk(g.amount)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Doba splácení se posuvníkem nemění, ale patří k obrázku: bez ní
          není z čeho poznat, proč splátka vyšla tak, jak vyšla. */}
      {hasProperty && (
        <p className="text-xs text-ink-muted">
          Počítáno na {loanTermYears(current)} let splácení.
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
