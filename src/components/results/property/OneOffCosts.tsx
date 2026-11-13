import type { WizardState } from '../../../types';
import { purchaseClosingCosts, purchaseOneOffCosts } from '../../../engine/purchaseCosts';
import { czk } from '../../../engine/format';
import Tooltip from '../../ui/Tooltip';
import Disclosure from '../../ui/Disclosure';

/**
 * Náklady odečtené při koupi, s rozpětím výchozího odhadu.
 */
export default function OneOffCosts({ state }: { state: WizardState }) {
  const costs = purchaseOneOffCosts(state);
  if (!costs) return null;

  return (
    <aside className="mt-4 p-3 rounded-lg border border-line bg-sunken" aria-label="Informace o jednorázových nákladech koupě">
      <p className="text-sm font-medium text-ink-label mb-1">
        Jednorázové náklady zahrnuté do plánu
        <Tooltip text="Vedle kupní ceny počítáme s poplatky za koupi. Stěhování a vybavení si můžete přičíst ve vlastním nastavení." />
      </p>
      <p className="text-xs text-ink-muted mb-2">
        <span className="font-semibold text-ink">{czk(purchaseClosingCosts(state))}</span>{' '}
        {state.property.purchaseCosts === undefined
          ? `jako střed odhadu poplatků ${czk(costs.min)} až ${czk(costs.max)}.`
          : 'podle vaší zadané částky.'}
      </p>
      {/* Součet je odpověď, rozpis je jeho odůvodnění. */}
      <Disclosure summary="Rozpis výchozího odhadu poplatků">
        <div className="space-y-1 pb-1">
          {costs.items.map((item) => (
            <div key={item.key} className="flex justify-between gap-3 text-xs">
              <span className="text-ink-body">{item.label}</span>
              <span className="text-ink-muted shrink-0">{czk(item.min)} až {czk(item.max)}</span>
            </div>
          ))}
        </div>
      </Disclosure>
    </aside>
  );
}
