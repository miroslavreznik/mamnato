import type { WizardState } from '../../types';
import { evaluateTaxRelief } from '../../engine/taxRelief';
import Tooltip from '../ui/Tooltip';
import { formatNumber as fmt } from '../../engine/format';
import Card from '../ui/Card';


/**
 * Daňové úlevy, o kterých se u hypotéky často zapomíná.
 *
 * Karta je záměrně informativní a do rozpočtu výše se nepromítá. Zvýhodnění
 * na dítě si zaměstnanec obvykle uplatňuje měsíčně u zaměstnavatele, takže
 * už je v čisté mzdě; přičíst ho znovu by znamenalo počítat stejné peníze
 * dvakrát. Je lepší ukázat míň a nelhat.
 */
export default function TaxReliefCard({ state }: { state: WizardState }) {
  const relief = evaluateTaxRelief(state);
  if (!relief) return null;

  return (
    <Card title="Daňové úlevy, na které máte nárok" subtitle="Stát vám část nákladů vrátí přes daně. Ve výpočtech výše s tím schválně nepočítáme, aby
        rozpočet nevypadal lépe, než jaký je.">
      <div className="space-y-3">
        {relief.items.map((item) => (
          <div key={item.key} className="p-3 rounded-lg bg-sunken">
            <div className="flex justify-between items-baseline gap-3">
              <span className="text-sm font-medium text-ink-label">{item.label}</span>
              <span className="text-right shrink-0">
                <span className="font-bold text-ink">{fmt(item.monthly)} Kč</span>
                <span className="text-xs text-ink-faint">/měs</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">{item.how}</p>
            <p className="mt-1 text-xs text-ink-faint">Ročně {fmt(item.yearly)} Kč.</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-between items-baseline border-t border-line pt-3">
        <span className="text-sm text-ink-body">
          Dohromady
          <Tooltip text="Součet ročních úlev přepočtený na měsíc. Uplatní se jen do výše daně, kterou skutečně platíte: odpočet úroků nemůže vrátit víc, než kolik jste na dani odvedli. Zvýhodnění na dítě se naopak může změnit v daňový bonus a vyplatit se i nad rámec daně." />
        </span>
        <span className="text-xl font-bold text-good">
          {fmt(relief.monthly)} Kč/měs.
        </span>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        {relief.childCreditAlreadyClaimed
          ? 'Pozor: zvýhodnění na děti si nejspíš uplatňujete už teď u zaměstnavatele, takže ho máte v čisté mzdě, kterou jste zadali. Novinkou pro vás bude jen odpočet úroků, ten začne platit až po podpisu hypotéky.'
          : 'Odpočet úroků začne platit až po podpisu hypotéky a uplatňuje se v daňovém přiznání nebo ročním zúčtování u zaměstnavatele. Zvýhodnění na dítě až po jeho narození.'}
      </p>
    </Card>
  );
}
