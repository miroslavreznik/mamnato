import { useState } from 'react';
import { DEFAULTS_DATE } from '../../engine/defaults';

// '2026-07' → '07/2026'
function formatDataDate(iso: string): string {
  const [year, month] = iso.split('-');
  return month && year ? `${month}/${year}` : iso;
}

/**
 * Právní upozornění k výsledkům.
 *
 * Klíčové body jsou vidět vždy, podrobné znění je rozbalovací, schované
 * podmínky by ztrácely smysl, ale nemá cenu jimi zahltit celý závěr přehledu.
 */
export default function Disclaimer() {
  const [open, setOpen] = useState(false);
  const dataDate = formatDataDate(DEFAULTS_DATE);

  return (
    <div className="mt-8 p-4 bg-sunken border border-line rounded-lg text-xs text-ink-muted leading-relaxed">
      <p className="font-semibold text-ink-label mb-1">Upozornění</p>
      <p>
        MámNaTo? je bezplatný informační a vzdělávací nástroj. Výsledky jsou{' '}
        <strong className="font-semibold">orientační modelové výpočty</strong> vycházející výhradně
        z údajů, které sami zadáte. <strong className="font-semibold">Nejde o finanční, investiční,
        úvěrové ani daňové poradenství</strong> a výpočty nenahrazují konzultaci s odborníkem ani
        posouzení bankou.
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="no-print mt-2 inline-block py-2 text-brand hover:underline"
      >
        {open ? 'Skrýt podrobné podmínky' : 'Zobrazit podrobné podmínky'}
      </button>

      <div className={open ? 'block' : 'hidden print:block'}>
        <dl className="mt-1 space-y-2.5">
          <div>
            <dt className="font-semibold text-ink-body">1. Povaha služby</dt>
            <dd>
              Nástroj slouží k orientačnímu propočtu domácího rozpočtu a dostupnosti bydlení.
              Výstupy jsou zjednodušené modely, nikoli individualizované doporučení ani analýza
              vašich osobních poměrů. Jakékoli formulace typu „doporučujeme", „vyplatí se" nebo
              „bezpečné maximum" jsou obecné informace, ne rada na míru.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-ink-body">
              2. Není poradenství ani zprostředkování
            </dt>
            <dd>
              Provozovatel není oprávněnou osobou podle zákona č. 256/2004 Sb., o podnikání na
              kapitálovém trhu, ani podle zákona č. 257/2016 Sb., o spotřebitelském úvěru, ani
              podle zákona č. 170/2018 Sb., o distribuci pojištění a zajištění. Obsah nepředstavuje
              investiční poradenství ani jinou investiční službu, poradenství ani zprostředkování
              spotřebitelského úvěru (včetně hypotečního), distribuci pojištění ani daňové
              poradenství. Nejde o nabídku, veřejný příslib ani příslib poskytnutí úvěru.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-ink-body">
              3. Přesnost a aktuálnost údajů
            </dt>
            <dd>
              Výchozí hodnoty (úroková sazba, příjmy, ceny nemovitostí, náklady na děti) jsou
              veřejně dostupné průměry k datu poslední revize{' '}
              <span className="whitespace-nowrap">{dataDate}</span> a mohou být neaktuální nebo
              nemusí odpovídat vaší situaci. Výpočty nezohledňují všechny poplatky, daně, pojištění,
              inflaci ani individuální podmínky konkrétní banky. Skutečnou úrokovou sazbu, výši
              splátky i schválení úvěru posuzuje vždy banka individuálně a reálná nabídka se může
              podstatně lišit. Nic zde uvedeného nezaručuje, že úvěr získáte.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-ink-body">4. Odpovědnost</dt>
            <dd>
              Nástroj je poskytován zdarma a „tak, jak je", bez jakékoli záruky za správnost,
              úplnost či nepřetržitou dostupnost. Rozhodnutí učiněná na základě výsledků jsou
              výhradně na vás. V rozsahu, který právní řád připouští, provozovatel neodpovídá za
              škodu vzniklou použitím tohoto nástroje ani spoléháním se na jeho výstupy.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-ink-body">5. Soukromí</dt>
            <dd>
              Zadané údaje zůstávají ve vašem prohlížeči, neodesílají se na žádný server a
              provozovatel k nim nemá přístup.{' '}
              <strong className="font-semibold">Pozor u funkce sdílení:</strong> vygenerovaný odkaz
              obsahuje vaše zadané údaje zakódované přímo v adrese. Kdokoli, kdo odkaz získá, uvidí
              vaše příjmy, výdaje i úspory. Posílejte ho jen lidem, kterým důvěřujete.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-ink-body">6. Doporučení</dt>
            <dd>
              Před uzavřením hypotéky, investicí nebo jiným zásadním finančním rozhodnutím
              konzultujte svou situaci s licencovaným odborníkem: hypotečním specialistou banky,
              samostatným zprostředkovatelem registrovaným u ČNB, investičním nebo daňovým poradcem.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
