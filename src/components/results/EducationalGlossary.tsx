import { useState } from 'react';

/**
 * Slovníček pojmů, které appka používá ve výsledcích.
 *
 * Psaný pro člověka, který o financích nikdy nečetl. Tři pravidla:
 *
 *  1. První věta říká, co to je, bez dalšího odborného slova. Když se pojmu
 *     nedá vyhnout, vysvětlí se hned za ním.
 *  2. Druhá věta ukazuje číslo nebo příklad, protože „poměr dluhu k příjmu"
 *     si nikdo nepředstaví, ale „na 40 000 čistého vyjde splátka 18 000" ano.
 *  3. Poslední věta říká, co s tím uživatel má dělat.
 *
 * Pojmy jsou v pořadí, v jakém na ně člověk ve výsledcích narazí, a rozdělené
 * do skupin. Plochý seznam dvaceti hesel se nedá přehlédnout.
 */

interface GlossaryItem {
  term: string;
  explanation: string;
}

interface GlossaryGroup {
  title: string;
  items: GlossaryItem[];
}

const groups: GlossaryGroup[] = [
  {
    title: 'Váš rozpočet',
    items: [
      {
        term: 'Čistý příjem',
        explanation:
          'Částka, která vám opravdu přijde na účet, tedy po zdanění a odvodech. Není to hrubá mzda ze smlouvy: z hrubých 50 000 Kč bývá čistých zhruba 40 000 Kč. Do appky patří vždycky ta čistá, protože z ní se platí nájem i splátky.',
      },
      {
        term: 'Nezbytné a zbytné výdaje',
        explanation:
          'Nezbytné výdaje platíte i ve chvíli, kdy přijdete o práci: bydlení, jídlo, doprava, splátky. Zbytné jde na pár měsíců omezit, aniž by se něco zhroutilo: zábava, dovolená, předplatné. Rozdělení není soud nad tím, jak žijete; slouží k tomu, aby appka spočítala, kolik doopravdy potřebujete na přežití.',
      },
      {
        term: 'Disponibilní částka a volná rezerva',
        explanation:
          'Disponibilní částka je to, co vám měsíčně zbude po zaplacení všech výdajů. Volná rezerva je to, co z ní zbývá i po odečtení peněz, které posíláte na cíle. Když je volná rezerva nula, rozpočet sice vychází, ale první nečekaný výdaj ho rozhodí.',
      },
      {
        term: 'Nouzová rezerva',
        explanation:
          'Peníze stranou na 3 až 6 měsíců nezbytných výdajů, dostupné do pár dnů (spořicí účet, ne akcie). Při výdajích 25 000 Kč měsíčně je to 75 000 až 150 000 Kč. Je to první věc, kterou má smysl mít hotovou, dřív než cokoli jiného: bez ní se každá rána řeší drahou půjčkou. Nepleťte si ji s volnou rezervou, ta je měsíční; tahle je naspořená.',
      },
      {
        term: 'Inflace',
        explanation:
          'Zdražování, kvůli kterému si za stejnou částku příští rok koupíte míň. Peníze bez úroku na běžném účtu proto potichu ztrácejí hodnotu. U hypotéky s pevnou splátkou pracuje inflace naopak pro vás: splátka zůstává stejná, ale příjmy postupně rostou.',
      },
    ],
  },
  {
    title: 'Hypotéka a bydlení',
    items: [
      {
        term: 'Akontace a LTV',
        explanation:
          'Akontace je částka, kterou při koupi zaplatíte z vlastních peněz. LTV je zkratka pro to, jakou část ceny pokryje hypotéka. Banky běžně půjčí 80 % ceny; nejmladšímu žadateli do 36 let až 90 %. U bytu za 5 milionů to znamená mít z vlastního 1 milion, u mladších žadatelů 500 tisíc.',
      },
      {
        term: 'Jistina, úrok a splátka',
        explanation:
          'Jistina je půjčená částka. Úrok je cena za to, že si ji můžete půjčit. Měsíční splátka je po celou dobu stejná, ale její složení se mění: na začátku jde většina na úroky a jistina klesá jen pomalu. Proto se mimořádná splátka v prvních letech vyplatí nejvíc.',
      },
      {
        term: 'Fixace a refixace',
        explanation:
          'Fixace je doba, po kterou máte úrokovou sazbu zaručenou, typicky 3 až 10 let. Po jejím konci banka nabídne novou sazbu podle toho, jak se mezitím vyvinul trh, a tomu se říká refixace. Delší fixace je jistota, kterou si banka nechá zaplatit o něco vyšší sazbou; kratší je levnější, ale dřív vás vystaví tomu, jaké budou sazby potom.',
      },
      {
        term: 'RPSN',
        explanation:
          'Roční procentní sazba nákladů, tedy úrok i se všemi poplatky a povinným pojištěním. Dvě hypotéky se stejným úrokem můžou mít různé RPSN podle toho, co všechno k nim banka přibalí. Při porovnávání nabídek se dívejte na RPSN, ne jen na úrok.',
      },
      {
        term: 'DTI a DSTI',
        explanation:
          'Dvě čísla, kterými banka měří, jestli dluh unesete. DTI porovnává celkový dluh s ročním příjmem; obvyklé vodítko je 8,5násobek. DSTI porovnává všechny měsíční splátky s čistým příjmem, obvykle nejvýš 45 %, což při čistém příjmu 40 000 Kč znamená splátky do zhruba 18 000 Kč měsíčně. Česká národní banka jako závazné limity zrušila (DSTI v červenci 2023, DTI v lednu 2024), banky je ale stejně posuzují.',
      },
      {
        term: 'Náklady na vlastnictví',
        explanation:
          'Vlastní bydlení není jen splátka. Připočtěte příspěvky do fondu oprav, ze kterého společenství vlastníků platí opravy domu (u bytu běžně 1 000 až 3 000 Kč měsíčně), pojištění nemovitosti, daň z nemovitých věcí a peníze na vlastní opravy. Appka počítá s 1 % z ceny ročně; právě tyhle položky lidé při srovnání s nájmem nejčastěji zapomenou.',
      },
      {
        term: 'Odhad banky',
        explanation:
          'Banka půjčuje podle ceny, kterou nemovitosti přiřkne její odhadce, ne podle té, na které jste se dohodli s prodávajícím. Když odhad vyjde níž, banka půjčí méně a rozdíl doplácíte z vlastního. U vyhroceného trhu se to stává, proto se hodí mít malou rezervu i nad rámec akontace.',
      },
      {
        term: 'Odpočet úroků z daní',
        explanation:
          'Úroky z hypotéky na vlastní bydlení si můžete odečíst od základu daně, nejvýš 150 000 Kč ročně. Nevrátí se vám celá ta částka, ale 15 % z ní, tedy nejvýš 22 500 Kč za rok. Uplatňuje se v daňovém přiznání nebo u zaměstnavatele v ročním zúčtování a s klesající jistinou úleva každý rok o něco klesá.',
      },
      {
        term: 'Koupě nebo nájem',
        explanation:
          'Nájem nejsou „vyhozené peníze" a koupě není automaticky výhra. Rozhoduje, jak dlouho v bytě zůstanete, jak velký je rozdíl mezi splátkou a nájmem a co byste s ušetřeným rozdílem dělali. Když vás vlastní bydlení natáhne nadoraz, nájem s investováním rozdílu může dopadnout líp.',
      },
    ],
  },
  {
    title: 'Spoření a cíle',
    items: [
      {
        term: 'Složené úročení',
        explanation:
          'Výnos se přičte k naspořené částce a příští rok vydělává i on. Tisícovka měsíčně při 7 % ročně je za 10 let asi 170 tisíc, ale za 30 let asi 1,2 milionu, i když jste vložili jen 360 tisíc. Proto u dlouhých cílů rozhoduje spíš to, kdy začnete, než kolik odkládáte.',
      },
      {
        term: 'Peníze podle toho, kdy je budete potřebovat',
        explanation:
          'Na co sáhnete do dvou let (rezerva, akontace), patří na spořicí účet: nesmí to zrovna klesnout. Na co máte pět a víc let (důchod), snese akcie a indexové fondy, protože propad má čas se srovnat. Nejčastější chyba je obojí naopak: rezerva v akciích a důchod na běžném účtu.',
      },
      {
        term: 'Diverzifikace',
        explanation:
          'Rozložení peněz mezi víc firem, oborů a zemí, aby propad jednoho neohrozil celek. Místo sázky na jednu akcii se drží široký koš, třeba index světových akcií. Sníží to riziko, aniž byste se museli vzdát většiny výnosu.',
      },
      {
        term: 'Pravidlo 4 %',
        explanation:
          'Orientační pravidlo pro rentu: z naspořeného portfolia lze ročně vybírat asi 4 %, aniž by se vyčerpalo. Pro rentu 20 000 Kč měsíčně tedy potřebujete zhruba 6 milionů, protože potřebná částka je měsíční renta krát 300. Appka podle toho počítá, kolik z vašeho spoření na důchod nakonec zbude.',
      },
      {
        term: 'Čisté jmění',
        explanation:
          'Všechno, co vlastníte, minus všechno, co dlužíte. Po koupi bytu za 5 milionů s hypotékou 4 miliony je vaše čisté jmění 1 milion, ne 5. Splácením a růstem cen roste, proto graf srovnání s nájmem sleduje právě tohle číslo, ne výši splátky.',
      },
      {
        term: 'Dobrý a špatný dluh',
        explanation:
          'Dobrý dluh platí něco, co si drží hodnotu nebo vydělává, typicky hypotéka na bydlení, a bývá levný. Špatný dluh platí spotřebu a bývá drahý: kreditní karty, rychlé půjčky, úvěr na dovolenou. Špatný dluh splácejte přednostně, dřív než začnete investovat.',
      },
    ],
  },
  {
    title: 'Rodina a stát',
    items: [
      {
        term: 'Mateřská a rodičovský příspěvek',
        explanation:
          'To nejsou dvě jména pro totéž. Mateřská (peněžitá pomoc v mateřství) se vyplácí 28 týdnů, tedy zhruba půl roku, a odvíjí se od vaší mzdy, takže bývá vyšší. Pak nastupuje rodičovský příspěvek, kde je na celou dobu pevný balík 350 000 Kč na dítě: čím déle jste doma, tím nižší měsíční částka.',
      },
      {
        term: 'Daňové zvýhodnění na dítě',
        explanation:
          'Sleva na dani za každé vyživované dítě, ročně 15 204 Kč na první, 22 320 Kč na druhé a 27 840 Kč na třetí a další. Není to totéž co odpočet úroků: ten snižuje základ daně, tohle se odečítá rovnou od daně, a pokud je vyšší než vaše daň, rozdíl vám stát vyplatí jako daňový bonus. Zaměstnanci ho většinou čerpají už teď přímo ve mzdě, proto appka tuhle částku znovu nepřičítá k příjmu.',
      },
      {
        term: 'Náklady na dítě',
        explanation:
          'Dítě není jednorázový výdaj, ale patnáct až dvacet let běžných nákladů, které rostou s věkem. Appka počítá s průměrem přes prvních 18 let, takže v batolecím věku bude skutečnost nižší a u studenta vyšší. Podstatné je, že se ta částka odečítá z rozpočtu každý měsíc, ne že se jednou naspoří.',
      },
    ],
  },
];

function GlossaryRow({ item }: { item: GlossaryItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex justify-between items-center gap-3 w-full text-left py-3 min-h-[44px]"
      >
        <span className="font-medium text-gray-900 dark:text-white">{item.term}</span>
        <span className="text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <p className="pb-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.explanation}</p>
      )}
    </div>
  );
}

export default function EducationalGlossary() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Pojmy, které appka ve výsledcích používá, vysvětlené normálně a s příklady.
        Nemusíte je znát dopředu; jsou tu pro chvíli, kdy na některý narazíte.
      </p>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.title}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
              {group.title}
            </h4>
            <div>
              {group.items.map((item) => (
                <GlossaryRow key={item.term} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
