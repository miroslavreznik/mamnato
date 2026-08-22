const products = [
  {
    name: 'DIP',
    support: 'Daňový odpočet v rámci společného limitu produktů na stáří a možnost příspěvku zaměstnavatele. Nemá státní příspěvek.',
    access: 'Pro zachování daňové podpory lze vybírat nejdříve po 120 měsících a zároveň v 60 letech.',
    investing: 'Podle poskytovatele může obsahovat ETF, fondy, akcie i konzervativní nástroje. Důležité jsou poplatky a dostupná nabídka.',
    suitable: 'Dlouhodobé investování na stáří, zvlášť při využití odpočtu nebo příspěvku zaměstnavatele.',
  },
  {
    name: 'Doplňkové penzijní spoření',
    support: 'Státní příspěvek, možnost příspěvku zaměstnavatele a při splnění podmínek také daňový odpočet.',
    access: 'Předčasný výběr může znamenat ztrátu části podpory. Investuje se přes účastnické fondy penzijní společnosti.',
    investing: 'Jednodušší obsluha, ale menší kontrola nad portfoliem. Výsledek výrazně ovlivní zvolená strategie a poplatky.',
    suitable: 'Pro ty, kdo chtějí státní podporu a jednoduché řešení bez vlastní správy ETF.',
  },
  {
    name: 'Vlastní ETF účet',
    support: 'Nemá zvláštní podporu produktu na stáří ani daňově zvýhodněný příspěvek zaměstnavatele.',
    access: 'Peníze nejsou uzamčené do 60 let. Při prodeji platí běžná daňová pravidla pro cenné papíry.',
    investing: 'Největší výběr a často nízké náklady, ale také vlastní odpovědnost za brokera, portfolio, daně a disciplínu.',
    suitable: 'Flexibilní dlouhodobé investování pro uživatele, kteří chtějí mít portfolio pod vlastní kontrolou.',
  },
];

export default function RetirementProductComparison() {
  return (
    <section className="mt-8 border-t border-line pt-6" aria-labelledby="retirement-products-title">
      <h3 id="retirement-products-title" className="text-base font-semibold text-ink mb-1">
        DIP, penzijní spoření, nebo vlastní ETF?
      </h3>
      <p className="text-sm text-ink-muted mb-4">
        Nejde o tři stejné investice. DIP a penzijní spoření jsou podporované režimy či produkty,
        zatímco ETF je investiční nástroj, který lze držet i uvnitř některých DIP.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2 pr-3">Varianta</th>
              <th className="py-2 px-3">Podpora</th>
              <th className="py-2 px-3">Dostupnost peněz</th>
              <th className="py-2 px-3">Investování</th>
              <th className="py-2 pl-3">Pro koho</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.name} className="border-b border-line align-top">
                <td className="py-3 pr-3 font-semibold text-ink">{product.name}</td>
                <td className="py-3 px-3 text-ink-body">{product.support}</td>
                <td className="py-3 px-3 text-ink-body">{product.access}</td>
                <td className="py-3 px-3 text-ink-body">{product.investing}</td>
                <td className="py-3 pl-3 text-ink-body">{product.suitable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-tint-brand text-sm text-ink-body">
        Často dává smysl kombinace: využít dostupnou daňovou či státní podporu a příspěvek
        zaměstnavatele v DIP nebo penzijním spoření a další dlouhodobé peníze investovat
        flexibilně přes vlastní ETF účet.
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
