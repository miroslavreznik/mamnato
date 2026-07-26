import type { WizardState } from '../../../types';
import { purchaseOneOffCosts } from '../../../engine/purchaseCosts';
import { czk } from '../../../engine/format';
import Tooltip from '../../ui/Tooltip';

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
    <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Kromě akontace počítejte s jednorázovými náklady
        <Tooltip text="Poplatky a služby, které koupi na hypotéku doprovázejí. Daň z nabytí nemovitosti byla zrušena v roce 2020, takže tu není. Ceny služeb se liší podle poskytovatele, proto jsou uvedená rozpětí. Stěhování a vybavení sem nepočítáme, ta se u každého liší příliš." />
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Dohromady zhruba{' '}
        <span className="font-semibold text-gray-900 dark:text-white">{czk(costs.min)} až {czk(costs.max)}</span>.
        O tuhle částku se rezerva sníží hned při koupi, ještě než začnete splácet.
      </p>
      <div className="space-y-1">
        {costs.items.map((item) => (
          <div key={item.key} className="flex justify-between gap-3 text-xs">
            <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
            <span className="text-gray-500 dark:text-gray-400 shrink-0">{czk(item.min)} až {czk(item.max)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
