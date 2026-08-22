import { czkPerMonth } from '../../engine/format';

const products = [
  {
    name: 'Doplňkové penzijní spoření (DPS)',
    stateSupport: '20 % z vlastního vkladu 500 až 1 699 Kč; maximum 340 Kč měsíčně od vkladu 1 700 Kč. Přispívat může i zaměstnavatel.',
    tax: 'Do společného limitu 48 000 Kč ročně se počítá část vlastního vkladu nad 1 700 Kč měsíčně.',
    access: 'Peníze jsou určené na stáří; předčasný výběr obvykle znamená ztrátu části podpory.',
    role: 'První vrstva kvůli státnímu příspěvku a jednoduché správě.',
  },
  {
    name: 'DIP',
    stateSupport: 'Bez státního příspěvku. Přispívat může zaměstnavatel; jeho příspěvky na podporované produkty mají společný limit osvobození 50 000 Kč ročně.',
    tax: 'Vlastní vklady lze uplatnit ve společném limitu 48 000 Kč ročně.',
    access: 'Pro zachování podpory nejdříve po 120 měsících a zároveň v 60 letech.',
    role: 'Dlouhý horizont a možnost držet levné fondy či ETF uvnitř daňově podporovaného režimu.',
  },
  {
    name: 'Vlastní ETF účet',
    stateSupport: 'Bez státního příspěvku a bez zvýhodněného příspěvku zaměstnavatele.',
    tax: 'Bez odpočtu produktu na stáří; platí běžná daňová pravidla pro cenné papíry.',
    access: 'Peníze nejsou uzamčené do 60 let.',
    role: 'Flexibilní část dlouhodobého portfolia a plná kontrola nad náklady i složením.',
  },
];

interface Props {
  monthlyContribution: number;
  yearsToRetirement: number;
}

export default function RetirementProductComparison({ monthlyContribution, yearsToRetirement }: Props) {
  const dps = Math.min(1700, Math.max(0, monthlyContribution));
  const rest = Math.max(0, monthlyContribution - dps);
  const longEnoughForDip = yearsToRetirement >= 10;

  let headline = 'Nejdřív vytvořte pravidelnou částku na stáří';
  let explanation = 'Bez pravidelného vkladu nemá volba produktu velký dopad. Začněte částkou, která se vejde vedle ostatních cílů.';

  if (monthlyContribution > 0 && monthlyContribution < 500) {
    headline = 'Pro váš scénář: flexibilní ETF nebo navýšit DPS alespoň na 500 Kč';
    explanation = `Při ${czkPerMonth(monthlyContribution)} ještě DPS nezíská státní příspěvek. Pokud můžete, zvedněte vklad alespoň na 500 Kč; jinak dává větší smysl levné a flexibilní řešení.`;
  } else if (monthlyContribution >= 500 && monthlyContribution < 1700) {
    headline = 'Pro váš scénář: začít doplňkovým penzijním spořením';
    explanation = `Celých ${czkPerMonth(monthlyContribution)} může využít státní příspěvek ve výši 20 % vlastního vkladu. Před sjednáním porovnejte poplatky a dynamickou strategii s vaším horizontem.`;
  } else if (monthlyContribution === 1700) {
    headline = 'Pro váš scénář: DPS pro maximální státní příspěvek';
    explanation = `${czkPerMonth(dps)} do DPS využije maximální státní příspěvek 340 Kč měsíčně. Porovnejte hlavně poplatky a investiční strategii; s dlouhým horizontem bývá důležitá dostatečně dynamická varianta.`;
  } else if (monthlyContribution > 1700) {
    headline = longEnoughForDip
      ? 'Pro váš scénář: DPS jako základ, zbytek do levného DIP nebo ETF'
      : 'Pro váš scénář: DPS jako základ, zbytek držet flexibilně';
    explanation = longEnoughForDip
      ? `${czkPerMonth(dps)} do DPS využije maximální státní příspěvek. Zbývajících ${czkPerMonth(rest)} dává smysl směřovat do nízkonákladového dlouhodobého portfolia: do DIP, pokud využijete daňový odpočet a přijmete uzamčení, jinak na vlastní ETF účet.`
      : `${czkPerMonth(dps)} do DPS využije maximální státní příspěvek. Do důchodu zbývá méně než deset let, takže nový DIP nemusí splnit desetiletou podmínku v okamžiku plánovaného odchodu; zbývajících ${czkPerMonth(rest)} proto držte jen v produktu, jehož termín výběru vám vyhovuje.`;
  }

  return (
    <section className="mb-6" aria-labelledby="retirement-products-title">
      <div className="p-4 sm:p-5 rounded-xl border border-line bg-tint-brand">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Orientační závěr pro váš plán</p>
        <h3 className="mt-1 text-lg font-semibold text-ink">{headline}</h3>
        <p className="mt-2 text-sm text-ink-body">{explanation}</p>
        <p className="mt-2 text-xs text-ink-muted">
          Příspěvek zaměstnavatele využijte přednostně, pokud ho máte. Appka nezná váš daňový základ,
          nabídku zaměstnavatele ani poplatky konkrétních produktů, proto nejde o individuální investiční doporučení.
        </p>
      </div>

      <h3 id="retirement-products-title" className="mt-6 text-base font-semibold text-ink mb-1">
        Kde spořit: DPS, DIP, nebo vlastní ETF?
      </h3>
      <p className="text-sm text-ink-muted mb-4">
        DPS a DIP určují podporu a podmínky výběru. ETF je investice, kterou lze držet samostatně
        a u některých poskytovatelů také uvnitř DIP. Proto je oddělujeme od grafu výnosů níže.
      </p>

      <div className="sm:hidden space-y-3">
        {products.map((product) => (
          <article key={product.name} className="rounded-xl border border-line p-4">
            <h4 className="font-semibold text-ink">{product.name}</h4>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="font-medium text-ink-label">Stát a zaměstnavatel</dt>
                <dd className="text-ink-body">{product.stateSupport}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink-label">Daňový odpočet</dt>
                <dd className="text-ink-body">{product.tax}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink-label">Dostupnost peněz</dt>
                <dd className="text-ink-body">{product.access}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink-label">Role v plánu</dt>
                <dd className="text-ink-body">{product.role}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2 pr-3">Varianta</th>
              <th className="py-2 px-3">Stát a zaměstnavatel</th>
              <th className="py-2 px-3">Daňový odpočet</th>
              <th className="py-2 px-3">Dostupnost peněz</th>
              <th className="py-2 pl-3">Role v plánu</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.name} className="border-b border-line align-top">
                <td className="py-3 pr-3 font-semibold text-ink">{product.name}</td>
                <td className="py-3 px-3 text-ink-body">{product.stateSupport}</td>
                <td className="py-3 px-3 text-ink-body">{product.tax}</td>
                <td className="py-3 px-3 text-ink-body">{product.access}</td>
                <td className="py-3 pl-3 text-ink-body">{product.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        Podmínky podpory jsou shrnuté k srpnu 2026.{' '}
        <a
          href="https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/zamestnanci-zamestnavatele/dotazy-a-odpovedi/2026/aktualni-dotazy-a-odpovedi-k-dani-z"
          target="_blank"
          rel="noreferrer"
          className="text-brand hover:underline"
        >
          Ověřit aktuální podmínky u Finanční správy
        </a>
      </p>
    </section>
  );
}
