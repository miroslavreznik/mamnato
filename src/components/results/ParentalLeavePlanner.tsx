import type { WizardState, ParentalLeave } from '../../types';
import {
  evaluateParentalLeave,
  defaultCaringParent,
  parentSalary,
  benefitEstimate,
  PPM_WEEKS,
} from '../../engine/parentalLeave';
import NumField from '../ui/NumField';
import Tooltip from '../ui/Tooltip';
import EstimateNote from '../ui/EstimateNote';
import { formatNumber as fmt } from '../../engine/format';
import Card from '../ui/Card';

interface Props {
  state: WizardState;
  onChange: (v: ParentalLeave | undefined) => void;
}


export default function ParentalLeavePlanner({ state, onChange }: Props) {
  const pl = state.parentalLeave;
  const enabled = !!pl?.enabled;
  const impact = evaluateParentalLeave(state);

  const enable = () => {
    // Dávka se schválně nevyplňuje: odhadne se z příjmu pečujícího rodiče
    // (mateřská prvních 28 týdnů, pak rodičovský příspěvek).
    onChange({ enabled: true, parent: defaultCaringParent(state), durationMonths: 36 });
  };
  const update = (patch: Partial<ParentalLeave>) => {
    if (pl) onChange({ ...pl, ...patch });
  };

  const changeDuration = (durationMonths: number) => update({ durationMonths });

  // Odhad podle fází vs. ručně zadaná částka, stejný vzorec jako u sazby
  // a nákladů na vlastnictví (viz engine/estimate.ts).
  const benefit = benefitEstimate(state);
  const benefitOverridden = benefit?.overridden ?? false;
  const resetBenefit = () => {
    if (pl) onChange({ enabled: pl.enabled, parent: pl.parent, durationMonths: pl.durationMonths });
  };

  if (!enabled || !impact) {
    return (
      <Card title="Rodičovská: co udělá s rozpočtem" subtitle="Když jeden z vás zůstane doma s dítětem, na čas klesne příjem (mateřská a rodičovská bývají nižší než mzda). Spočítejte si, jestli to rozpočet, a hlavně splátka hypotéky, během volna zvládne.">        <button
          onClick={enable}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
        >
          Spočítat dopad rodičovské
        </button>
      </Card>
    );
  }

  const hasProperty = state.goals.includes('property');
  const leaveNeg = impact.disposableDuringLeave < 0;
  const afterPurchase = impact.disposableDuringLeaveAfterPurchase;
  const afterNeg = afterPurchase !== null && afterPurchase < 0;

  const tile = (label: string, value: number, opts?: { negativeBad?: boolean; tooltip?: string }) => {
    const bad = opts?.negativeBad && value < 0;
    return (
      <div className="p-3 rounded-lg bg-sunken">
        <span className="text-xs text-ink-muted inline-flex items-center">
          {label}
          {opts?.tooltip && <Tooltip text={opts.tooltip} />}
        </span>
        <p className={`text-xl font-bold ${bad ? 'text-danger' : 'text-ink'}`}>
          {value >= 0 ? '' : '−'}{fmt(Math.abs(value))} <span className="text-sm font-normal text-gray-400">Kč/měs.</span>
        </p>
      </div>
    );
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-lg font-semibold text-ink">Rodičovská: co udělá s rozpočtem</h3>
        <button onClick={() => onChange(undefined)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
          Skrýt
        </button>
      </div>
      <p className="text-sm text-ink-muted mb-4">
        Budoucí scénář: po dobu volna nahradí mzdu pečujícího rodiče dávky. Parametry si upravte podle sebe.
      </p>

      {/* Ovládání scénáře */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div>
          <label className="block text-xs text-ink-muted mb-1">Doma zůstane</label>
          <div className="flex gap-1">
            {([1, 2] as const).map((p) => (
              <button
                key={p}
                onClick={() => update({ parent: p })}
                aria-pressed={impact.parent === p}
                className={`flex-1 px-2 py-2 text-sm rounded-lg border ${
                  impact.parent === p
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-line-strong text-ink-body'
                }`}
              >
                {/* „✓" je jediné, co v tisku spolehlivě přežije; podle barvy
                    pozadí nešlo z reportu poznat, kdo vlastně zůstane doma. */}
                {impact.parent === p ? '✓ ' : ''}Osoba {p}
                <span className="block text-[10px] text-gray-400">{fmt(parentSalary(state, p))} Kč</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Délka volna (měsíce)</label>
          <NumField
            value={impact.durationMonths}
            onChange={changeDuration}
            min={1}
            max={48}
            ariaLabel="Délka volna v měsících"
            step={1}
            className="w-full px-3 py-2.5 border border-line-strong dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Příjem během volna (dávky)</label>
          <NumField
            value={impact.monthlyBenefit}
            onChange={(v) => update({ monthlyBenefit: v })}
            min={0}
            ariaLabel="Měsíční příjem během volna"
            step={1000}
            suffix="Kč"
            className="w-full px-3 py-2.5 pr-9 border border-line-strong dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
          <EstimateNote
            overridden={benefitOverridden}
            className="mt-1 text-[10px] text-gray-400"
            explanation="Průměr za celé volno. Skutečný průběh je rozepsaný níže."
            suggestion="Zadáno ručně, platí po celé volno."
            revertLabel="Vrátit odhad"
            onRevert={resetBenefit}
          />
        </div>
      </div>

      {/* Průběh dávek. Bez tohohle rozpisu vypadá začátek volna dramatičtěji,
          než jaký je: mateřská je výrazně vyšší než rodičovský příspěvek. */}
      {!benefitOverridden && impact.phases.length > 1 && (
        <div className="mb-4 p-3 rounded-lg bg-sunken">
          <p className="text-xs font-medium text-ink-label mb-2">
            Dávky se v čase mění
            <Tooltip text={`Mateřská (peněžitá pomoc v mateřství) se vyplácí ${PPM_WEEKS} týdnů a činí 70 % redukovaného denního vyměřovacího základu, takže u vyšších příjmů je výrazně vyšší než rodičovský příspěvek. Počítáme ji z čisté mzdy pečujícího rodiče přes odhad hrubé mzdy, přesnou částku určí ČSSZ. Po jejím konci se čerpá rodičovský příspěvek 350 000 Kč, rozložený na zbytek volna.`} />
          </p>
          <div className="space-y-1">
            {impact.phases.map((phase) => (
              <div key={phase.key} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {phase.label} <span className="text-gray-400">({Math.round(phase.months)} měs.)</span>
                </span>
                <span className="font-semibold text-ink">{fmt(phase.monthlyBenefit)} Kč/měs.</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Mateřská = 70 % z redukovaného denního základu vaší mzdy. Rodičovský příspěvek = 350 000 Kč
            dělených zbývajícími {Math.round(impact.phases[1]?.months ?? 0)} měsíci.
          </p>
        </div>
      )}

      {/* Dopad */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {tile('Příjem nyní', impact.incomeNow, { tooltip: 'Součet současných čistých měsíčních příjmů domácnosti.' })}
        {tile('Příjem během volna', impact.incomeDuringLeave, { tooltip: 'Příjem domácnosti, kde mzdu pečujícího rodiče nahradí dávky (mateřská/rodičovská).' })}
        {tile('Volná rezerva nyní', impact.disposableNow, { negativeBad: true, tooltip: 'Co měsíčně zbyde po zaplacení všech výdajů (příjem − výdaje) při současných příjmech.' })}
        {tile('Volná rezerva během volna', impact.disposableDuringLeave, { negativeBad: true, tooltip: 'Co měsíčně zbyde po výdajích v období rodičovské se sníženým příjmem, ještě před případnou splátkou hypotéky.' })}
      </div>

      {hasProperty && afterPurchase !== null && (
        <div className={`p-3 rounded-lg mb-3 text-sm ${afterNeg ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'}`}>
          {afterNeg ? (
            <>
              Po koupi byste během rodičovské byli <strong>−{fmt(Math.abs(afterPurchase))} Kč/měs. v mínusu</strong>, splátku hypotéky a nezbytné výdaje byste z běžného příjmu neutáhli.{' '}
              {impact.reserveAfter <= 0 ? (
                <>Po zaplacení akontace vám přitom <strong>nezbude žádná rezerva</strong>, ze které byste schodek kryli. Počítejte s došetřením, levnější nemovitostí nebo kratším volnem.</>
              ) : impact.monthsCovered !== null && impact.monthsCovered >= impact.durationMonths ? (
                <>Rezerva, která vám po akontaci zbyde (~<strong>{fmt(impact.reserveAfter)} Kč</strong>), schodek za celé volno ({fmt(impact.shortfallTotal)} Kč) <strong>pokryje</strong>, ale z velké části na něj padne.</>
              ) : (
                <>Rezerva po akontaci (~<strong>{fmt(impact.reserveAfter)} Kč</strong>) pokryje jen asi <strong>{impact.monthsCovered} z {impact.durationMonths} měsíců</strong> volna, na zbytek schodku ({fmt(Math.max(0, impact.shortfallTotal - impact.reserveAfter))} Kč) je potřeba došetřit, zlevnit nemovitost nebo volno zkrátit.</>
              )}
            </>
          ) : (
            <>I po koupi byste během rodičovské měli <strong>+{fmt(afterPurchase)} Kč/měs.</strong> po zaplacení splátky a nezbytných výdajů. Rozpočet volno ustojí.</>
          )}
        </div>
      )}

      {leaveNeg && !hasProperty && (
        <div className="p-3 rounded-lg mb-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
          Během rodičovské by výdaje převýšily příjem o <strong>{fmt(Math.abs(impact.disposableDuringLeave))} Kč/měs.</strong>.{' '}
          {impact.reserveAfter > 0 && impact.monthsCovered !== null ? (
            impact.monthsCovered >= impact.durationMonths ? (
              <>Vaše úspory ({fmt(impact.reserveAfter)} Kč) schodek za celé volno ({fmt(impact.shortfallTotal)} Kč) pokryjí.</>
            ) : (
              <>Vaše úspory ({fmt(impact.reserveAfter)} Kč) pokryjí jen asi {impact.monthsCovered} z {impact.durationMonths} měsíců volna.</>
            )
          ) : (
            <>Nemáte rezervu, ze které byste schodek kryli. Budete ji potřebovat vytvořit.</>
          )}
        </div>
      )}

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Za celé volno ({impact.durationMonths} měs.) klesne příjem dohromady o{' '}
        <span className="font-semibold text-ink">{fmt(impact.savingsLostTotal)} Kč</span>
        {', o tolik méně naspoříte (nebo tolik budete potřebovat v rezervě).'}
      </p>
    </Card>
  );
}
