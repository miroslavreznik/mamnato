import { useId } from 'react';
import { DEFAULTS_DATE } from '../../engine/defaults';
import { fixationYears, loanTermYears, mortgageRateEstimate, ownedUtilities, ownershipCostsEstimate } from '../../engine/mortgage';
import { purchaseOneOffCosts } from '../../engine/purchaseCosts';
import { targetMonthlySurplus } from '../../engine/purchasePlan';
import { MAX_RESERVE_MONTHS, reserveTargetMonths } from '../../engine/reserve';
import { czk } from '../../engine/format';
import type { WizardState } from '../../types';
import NumberInput from '../ui/NumberInput';
import { fieldClass } from '../ui/fieldClass';

export type PurchaseSetting = 'bankAppraisal' | 'purchaseCosts' | 'ownedUtilities' | 'reserveMonths' | 'targetMonthlySurplus';

export interface PurchaseFieldsProps {
  state: WizardState;
  onChange: (field: PurchaseSetting, value: number | undefined) => void;
}

function FieldNote({ children, onReset }: { children: React.ReactNode; onReset?: () => void }) {
  return (
    <p className="-mt-3 mb-4 text-xs leading-relaxed text-ink-muted">
      {children}
      {onReset && <button type="button" className="ml-1 min-h-[32px] font-medium text-brand underline underline-offset-2" onClick={onReset}>Použít výchozí hodnotu</button>}
    </p>
  );
}

export function MonthlySurplusField({ state, onChange }: PurchaseFieldsProps) {
  return (
    <div>
      <NumberInput
        label="Kolik vám má měsíčně zbýt po koupi"
        value={targetMonthlySurplus(state)}
        onChange={(value) => onChange('targetMonthlySurplus', value)}
        tooltip="Peníze, které chcete mít každý měsíc navíc po zaplacení bydlení i ostatních výdajů. Můžete je nechat volné nebo spořit na jiné cíle."
        showSpinner={false}
      />
      <FieldNote onReset={state.property.targetMonthlySurplus === undefined ? undefined : () => onChange('targetMonthlySurplus', undefined)}>
        {state.property.targetMonthlySurplus === undefined ? 'Výchozí nastavení. Částku si můžete upravit.' : 'Vaše nastavení.'}
      </FieldNote>
    </div>
  );
}

export default function PurchaseFields({ state, onChange, showSurplus = true }: PurchaseFieldsProps & { showSurplus?: boolean }) {
  const costs = purchaseOneOffCosts(state);
  const { property } = state;
  return (
    <div className="mt-2 grid gap-x-5 sm:grid-cols-2">
      {state.mortgageFlow !== 'price' && (
        <div>
          <NumberInput
            label="Hodnota bytu podle banky"
            value={property.bankAppraisal ?? 0}
            onChange={(value) => onChange('bankAppraisal', value || undefined)}
            showSpinner={false}
          />
          <FieldNote>Nevyplněná hodnota znamená odhad z kupní ceny. Pokud banka odhadne byt níž, budete potřebovat víc vlastních peněz.</FieldNote>
        </div>
      )}
      <div>
        <NumberInput
          label="Jednorázové náklady při koupi"
          value={property.purchaseCosts ?? costs?.typical ?? 0}
          onChange={(value) => onChange('purchaseCosts', value)}
          showSpinner={false}
        />
        <FieldNote onReset={property.purchaseCosts === undefined ? undefined : () => onChange('purchaseCosts', undefined)}>
          {property.purchaseCosts === undefined && costs ? `Odhad poplatků ${czk(costs.min)} až ${czk(costs.max)}. ` : 'Vaše nastavení. '}
          Přičtěte si i stěhování a vybavení, pokud je budete platit.
        </FieldNote>
      </div>
      <div>
        <NumberInput
          label="Energie a služby v novém bytě"
          value={ownedUtilities(state)}
          onChange={(value) => onChange('ownedUtilities', value)}
          showSpinner={false}
        />
        <FieldNote onReset={property.ownedUtilities === undefined ? undefined : () => onChange('ownedUtilities', undefined)}>
          {property.ownedUtilities === undefined ? 'Odhad podle dnešních záloh. ' : 'Vaše nastavení. '}
          Zadejte měsíční zálohy na energie, vodu a služby. Fond oprav patří do nákladů na vlastnictví.
        </FieldNote>
      </div>
      <div>
        <NumberInput
          label="Rezerva po koupi"
          value={reserveTargetMonths(state)}
          onChange={(value) => onChange('reserveMonths', Math.min(MAX_RESERVE_MONTHS, Math.max(1, Math.round(value))))}
          suffix="měsíců"
          showSpinner={false}
        />
        <FieldNote onReset={state.reserveMonths === undefined ? undefined : () => onChange('reserveMonths', undefined)}>
          {state.reserveMonths === undefined ? 'Výchozí nastavení. ' : 'Vaše nastavení. '}
          Na kolik měsíců nezbytných výdajů chcete mít hotovost po koupi.
        </FieldNote>
      </div>
      {showSurplus && <MonthlySurplusField state={state} onChange={onChange} />}
    </div>
  );
}

type MortgageSetting = 'mortgageRate' | 'loanTermYears' | 'fixationYears' | 'ownershipCosts';

export function MortgageTermsFields({ state, onChange }: { state: WizardState; onChange: (field: MortgageSetting, value: number | undefined) => void }) {
  const id = useId();
  const rate = mortgageRateEstimate(state);
  const ownership = ownershipCostsEstimate(state);
  const years = loanTermYears(state);
  const fixation = fixationYears(state);

  return (
    <div className="grid gap-x-5 sm:grid-cols-2">
      <div>
        <NumberInput
          label="Úroková sazba hypotéky"
          value={Math.round(rate.value * 10000) / 100}
          onChange={(value) => onChange('mortgageRate', Math.min(20, value) / 100)}
          suffix="%"
          showSpinner={false}
        />
        <FieldNote onReset={rate.overridden ? () => onChange('mortgageRate', undefined) : undefined}>
          {rate.overridden ? 'Vaše nastavení.' : `Odhad podle fixace a sazeb nových hypoték (${DEFAULTS_DATE}).`}
        </FieldNote>
      </div>
      <div className="mb-4">
        <label htmlFor={`${id}-term`} className="mb-1 block text-sm font-medium text-ink-label">Délka hypotéky</label>
        <select id={`${id}-term`} value={years} onChange={(event) => onChange('loanTermYears', Number(event.target.value))} className={fieldClass('w-full px-3 py-2.5 text-base')}>
          {[15, 20, 25, 30].map((value) => <option key={value} value={value}>{value} let</option>)}
        </select>
      </div>
      <div className="mb-4">
        <label htmlFor={`${id}-fixation`} className="mb-1 block text-sm font-medium text-ink-label">Fixace sazby</label>
        <select id={`${id}-fixation`} value={fixation} onChange={(event) => onChange('fixationYears', Number(event.target.value))} className={fieldClass('w-full px-3 py-2.5 text-base')}>
          {[1, 3, 5, 7, 10].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'rok' : value === 3 ? 'roky' : 'let'}</option>)}
        </select>
      </div>
      <div>
        <NumberInput
          label="Fond oprav, údržba a pojištění bytu za měsíc"
          value={ownership.value}
          onChange={(value) => onChange('ownershipCosts', value)}
          showSpinner={false}
        />
        <FieldNote onReset={ownership.overridden ? () => onChange('ownershipCosts', undefined) : undefined}>
          {ownership.overridden ? 'Vaše nastavení.' : 'Odhad podle ceny nemovitosti. Zahrnuje také daň z nemovitosti.'}
        </FieldNote>
      </div>
    </div>
  );
}
