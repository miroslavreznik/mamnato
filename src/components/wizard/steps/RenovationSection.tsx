import type { WizardState } from '../../../types';
import { evaluateRenovation, renovationWithOverrun } from '../../../engine/renovation';
import { czk, czkPerMonth, formatMonths } from '../../../engine/format';
import NumberInput from '../../ui/NumberInput';

/**
 * Rekonstrukce po koupi.
 *
 * Jediná část průvodce, která potřebuje nový vstup, proto je schovaná za
 * odkazem. Kdo nerekonstruuje, uvidí krok stejný jako dřív. Po zapnutí se
 * ptáme na tři věci a hned pod nimi je vidět, co z nich plyne.
 */
export default function RenovationSection({ state, onChange }: { state: WizardState; onChange: (value: WizardState['property']['renovation']) => void }) {
  const renovation = state.property.renovation;
  const renovationPhase = evaluateRenovation(state);

  // Dokud se rekonstrukce nezapne, je tu jen odkaz a průvodce vypadá stejně
  // jako dřív; nikdo se nemusí prokousávat poli, která ho netrápí.
  return (
    <div className="mb-6">
      {!renovation ? (
        <button
          type="button"
          onClick={() => onChange({ cost: 0, months: 6, payingRentMeanwhile: true })}
          className="text-sm text-brand hover:underline min-h-[44px]"
        >
          + Budu rekonstruovat
        </button>
      ) : (
        <div className="p-4 bg-sunken rounded-xl">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-ink-label">Rekonstrukce po koupi</h3>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-xs text-ink-faint hover:text-ink-body shrink-0"
            >
              Zrušit
            </button>
          </div>
          <p className="text-xs text-ink-muted mb-3">
            Rozpočet na rekonstrukci se přičítá ke kupní ceně. Pokud banka zohlední budoucí stav bytu,
            zadejte její odhad hodnoty do nastavení nákladů a rezervy.
          </p>

          <NumberInput
            label="Rozpočet na rekonstrukci"
            value={renovation.cost}
            onChange={(cost) => onChange({ ...renovation, cost })}
            tooltip="Materiál i práce. Stavební práce se běžně prodraží o 15 až 20 %, počítejte s tím i v rezervě."
            step={50000}
          />
          <NumberInput
            label="Jak dlouho potrvá"
            value={renovation.months}
            onChange={(v) => onChange({ ...renovation, months: Math.min(48, Math.max(1, Math.round(v))) })}
            tooltip="Po tuhle dobu se do nemovitosti nedá nastěhovat. Hypotéka se zatím čerpá postupně, takže se platí jen úrok z vyčerpané části."
            suffix="měsíců"
            min={1}
            max={48}
            step={1}
          />

          <label className="flex items-start gap-2 text-sm text-ink-label min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={renovation.payingRentMeanwhile}
              onChange={(e) => onChange({ ...renovation, payingRentMeanwhile: e.target.checked })}
              className="mt-1 w-5 h-5 accent-brand shrink-0"
            />
            <span>
              Během rekonstrukce budu dál platit současné bydlení
              <span className="block text-xs text-ink-muted">
                Nájem i energie ({czkPerMonth(state.expenses.rent + state.expenses.utilities)}) poběží
                souběžně s hypotékou. Odškrtněte, pokud budete bydlet zadarmo, třeba u rodiny.
              </span>
            </span>
          </label>

          {renovationPhase && (
            <div className="mt-3 pt-3 border-t border-line text-xs text-ink-body space-y-1">
              <p>
                <span className="font-medium text-ink-label">Během rekonstrukce zaplatíte bance míň.</span>{' '}
                Hypotéka se čerpá postupně a z nevyčerpané části se neplatí nic, takže místo plné splátky{' '}
                {czk(renovationPhase.fullPayment)} jde jen o úrok:
                na začátku {czk(renovationPhase.interestOnlyStart)},
                na konci {czkPerMonth(renovationPhase.interestOnlyEnd)}.
              </p>
              {renovation.payingRentMeanwhile && (
                <p>
                  Se současným bydlením to dělá zhruba{' '}
                  <span className="font-semibold text-ink">
                    {czkPerMonth(renovationPhase.housingDuringRenovation)}
                  </span>{' '}
                  po dobu {formatMonths(renovation.months)}. Volných vám při současných příjmech zbyde{' '}
                  {czk(renovationPhase.disposableDuringRenovation)}.
                </p>
              )}
              <p className="text-caution">
                Počítejte s rezervou na prodražení. Při obvyklých 20 % navíc by rekonstrukce vyšla na{' '}
                {czk(renovationWithOverrun(state))} a rozdíl se doplácí z vlastních peněz.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
