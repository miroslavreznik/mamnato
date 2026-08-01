import type { WizardState } from '../../../types';
import { purchaseOneOffCosts } from '../../../engine/purchaseCosts';
import { czk } from '../../../engine/format';
import Tooltip from '../../ui/Tooltip';
import Disclosure from '../../ui/Disclosure';

/**
 * Jednorázové náklady koupě.
 *
 * Nejsou velké proti ceně nemovitosti, ale odcházejí z rezervy hned na
 * začátku, tedy z peněz, o které se opírá verdikt.
 */
export default function OneOffCosts({ state }: { state: WizardState }) {
  const costs = purchaseOneOffCosts(state);
  if (!costs) return null;

  return (
    <div className="mt-4 p-3 rounded-lg bg-sunken">
      <p className="text-sm font-medium text-ink-label mb-1">
        Kromě akontace počítejte s jednorázovými náklady
        <Tooltip text="Poplatky a služby, které koupi na hypotéku doprovázejí. Daň z nabytí nemovitosti byla zrušena v roce 2020, takže tu není. Ceny služeb se liší podle poskytovatele, proto jsou uvedená rozpětí. Stěhování a vybavení sem nepočítáme, ta se u každého liší příliš." />
      </p>
      <p className="text-xs text-ink-muted mb-2">
        Dohromady zhruba{' '}
        <span className="font-semibold text-ink">{czk(costs.min)} až {czk(costs.max)}</span>.
        O tuhle částku se rezerva sníží hned při koupi, ještě než začnete splácet.
      </p>
      {/* Součet je odpověď, rozpis je jeho odůvodnění. */}
      <Disclosure summary="Rozpis položek">
        <div className="space-y-1 pb-1">
          {costs.items.map((item) => (
            <div key={item.key} className="flex justify-between gap-3 text-xs">
              <span className="text-ink-body">{item.label}</span>
              <span className="text-ink-muted shrink-0">{czk(item.min)} až {czk(item.max)}</span>
            </div>
          ))}
        </div>
      </Disclosure>
    </div>
  );
}
