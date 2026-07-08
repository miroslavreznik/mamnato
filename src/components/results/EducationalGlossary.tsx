import { useState } from 'react';

interface GlossaryItem {
  term: string;
  explanation: string;
}

const items: GlossaryItem[] = [
  {
    term: 'Nezbytné vs. zbytné výdaje',
    explanation:
      'Nezbytné výdaje musíte platit i při výpadku příjmu — bydlení, jídlo, doprava, splátky. Zbytné jsou ty, které jde dočasně omezit — zábava, dovolená, předplatné. Rozdělení výdajů takhle vám ukáže, kolik doopravdy potřebujete na přežití a jakou rezervu si máte vytvořit.',
  },
  {
    term: 'Nouzová rezerva',
    explanation:
      'Peníze stranou zhruba na 3–6 měsíců nezbytných výdajů, snadno dostupné (spořicí účet, ne investice). Když přijde nečekaná rána — ztráta práce, porouchané auto, nemoc — nemusíte sahat po drahé půjčce ani vytáhnout investice v nejhorší chvíli. Tohle je první věc, kterou má smysl mít hotovou.',
  },
  {
    term: 'LTV a akontace',
    explanation:
      'Akontace je částka, kterou dáte z vlastního při koupi nemovitosti. LTV (loan-to-value) říká, jakou část ceny pokryje hypotéka. Banky v Česku běžně půjčí do 80–90 % hodnoty, takže z vlastního potřebujete zhruba 10–20 %. Čím vyšší akontace, tím nižší úrok i splátka.',
  },
  {
    term: 'DTI a DSTI',
    explanation:
      'Dvě čísla, kterými banka měří, jestli dluh unesete. DTI je poměr celkového dluhu k ročnímu příjmu (orientační strop 8,5×). DSTI je podíl všech splátek na čistém měsíčním příjmu (strop kolem 45 %). Když se do limitů nevejdete, banka buď nepůjčí, nebo dá horší podmínky.',
  },
  {
    term: 'Úroková sazba, fixace a refixace',
    explanation:
      'Úrok je cena za půjčené peníze. Fixace je doba, po kterou máte sazbu zaručenou (např. 5 let). Když fixace skončí, banka nabídne novou sazbu podle aktuálního trhu — tomu se říká refixace. Zhruba rok předem se vyplatí porovnat nabídky i jiných bank, hypotéku lze bez sankce přenést.',
  },
  {
    term: 'RPSN vs. úroková sazba',
    explanation:
      'Úroková sazba je jen cena peněz. RPSN (roční procentní sazba nákladů) navíc zahrnuje poplatky, pojištění a další náklady úvěru — je to poctivější číslo pro srovnání nabídek. Dvě hypotéky se stejným úrokem můžou mít různé RPSN. Vždy porovnávejte RPSN, ne jen úrok.',
  },
  {
    term: 'Náklady na vlastnictví',
    explanation:
      'Vlastní bydlení není jen splátka hypotéky. Připočtěte fond oprav (u bytu v SVJ typicky 1–3 tis. měsíčně), pojištění nemovitosti, daň z nemovitosti a údržbu. Právě tyhle „skryté" položky lidé při srovnání s nájmem často podcení — počítejte s nimi dopředu.',
  },
  {
    term: 'Dobrý a špatný dluh',
    explanation:
      'Dobrý dluh financuje něco, co drží nebo zvyšuje hodnotu, nebo vydělává — třeba hypotéka na bydlení. Špatný dluh financuje spotřebu a bývá drahý — kreditní karty, rychlopůjčky, spotřebák na dovolenou. Špatný dluh splácejte přednostně, u dobrého to takhle nehoří.',
  },
  {
    term: 'Složené úročení',
    explanation:
      'Úroky a výnosy se přičítají k jistině a samy pak nesou další výnos — peníze tak rostou zrychleně, čím déle je necháte pracovat. Proto je u dlouhodobých cílů (důchod) rozhodující začít brzy. U dluhů funguje stejný princip obráceně, proti vám.',
  },
  {
    term: 'Diverzifikace',
    explanation:
      'Rozložení peněz mezi víc aktiv, sektorů a zemí, aby propad jednoho neohrozil celek. Místo sázky na jednu firmu je rozumnější držet široký koš (třeba index světových akcií). Sníží to riziko, aniž byste se museli vzdát většiny výnosu.',
  },
  {
    term: 'Tři kyblíky peněz (podle horizontu)',
    explanation:
      'Peníze je dobré dělit podle toho, kdy je budete potřebovat. Krátký kyblík (do ~2 let) = hotovost a spořicí účet. Střední (2–5 let) = konzervativnější investice. Dlouhý (5+ let) = akcie a ETF, kde krátkodobé výkyvy nevadí. Ke každému cíli sedí jiný kyblík.',
  },
  {
    term: 'Koupě vs. nájem',
    explanation:
      'Nájem není „vyhozené peníze" a koupě není vždy výhra. Záleží na tom, jak dlouho zůstanete, jaký je rozdíl mezi splátkou a nájmem a co byste s ušetřeným udělali. Když si vlastní bydlení natáhne rozpočet nadoraz, nájem a investování rozdílu může dopadnout líp. Kalkulačka výše to porovná.',
  },
  {
    term: 'Pravidlo 4 %',
    explanation:
      'Orientační pravidlo pro rentu: z portfolia lze ročně vybírat zhruba 4 % jeho hodnoty, aniž byste ho vyčerpali. Pro požadovanou měsíční rentu tak potřebujete portfolio přibližně renta × 300. Pomůže odhadnout, kolik je potřeba mít na finanční nezávislost.',
  },
  {
    term: 'Inflace',
    explanation:
      'Postupné znehodnocování peněz — za stejnou částku si příští rok koupíte o něco míň. Peníze ležící bez úroku na běžném účtu proto reálně ztrácejí hodnotu. Naopak z reálné výše dluhu inflace „ukrajuje", takže u hypotéky s fixní splátkou pracuje spíš pro vás.',
  },
];

function GlossaryRow({ item }: { item: GlossaryItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex justify-between items-center w-full text-left py-3"
      >
        <span className="font-medium text-gray-900 dark:text-white">{item.term}</span>
        <span className="text-gray-400 dark:text-gray-500 ml-3 flex-shrink-0">{open ? '−' : '+'}</span>
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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Dobré vědět</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Několik pojmů, které se hodí znát při rozhodování o financích a bydlení.
      </p>
      <div>
        {items.map((item) => (
          <GlossaryRow key={item.term} item={item} />
        ))}
      </div>
    </div>
  );
}
