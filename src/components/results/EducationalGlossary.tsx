import { useState } from 'react';

interface GlossaryItem {
  term: string;
  explanation: string;
}

const items: GlossaryItem[] = [
  {
    term: 'Rezervní fond (nouzová rezerva)',
    explanation:
      'Peníze stranou na 3–6 měsíců nezbytných výdajů, ideálně na spořicím účtu. Slouží jako polštář pro nečekané situace (ztráta příjmu, oprava, nemoc). Doporučuje se ho vytvořit dřív, než se pustíte do větších investic nebo koupě nemovitosti.',
  },
  {
    term: 'DTI a DSTI',
    explanation:
      'Ukazatele, podle kterých banky (a ČNB) posuzují únosnost dluhu. DTI je poměr celkového dluhu k ročnímu příjmu (limit 8,5×). DSTI je podíl měsíčních splátek na čistém měsíčním příjmu (limit 45 %). Čím nižší, tím bezpečnější a tím snáz hypotéku dostanete.',
  },
  {
    term: 'Dobrý a špatný dluh',
    explanation:
      'Dobrý dluh financuje něco, co roste na hodnotě nebo vydělává (hypotéka na bydlení, které se zhodnocuje). Špatný dluh financuje spotřebu a bývá drahý (kreditní karty, rychlopůjčky, spotřebák na dovolenou). Špatný dluh se vyplatí splatit co nejdřív, u dobrého to tak spěchat nemusí.',
  },
  {
    term: 'Diverzifikace',
    explanation:
      'Rozložení peněz mezi více aktiv, sektorů a regionů, aby výkyv jednoho z nich neohrozil celé úspory. Místo sázky na jednu firmu je rozumnější držet široký koš (např. index světových akcií). Snižuje riziko, aniž byste museli obětovat většinu výnosu.',
  },
  {
    term: 'Tři kyblíky peněz (horizont)',
    explanation:
      'Peníze je užitečné dělit podle toho, kdy je budete potřebovat. Krátký kyblík (do ~2 let) = hotovost a spořicí účet. Střední (2–5 let) = konzervativnější investice. Dlouhý (5+ let) = akcie a ETF, kde krátkodobé výkyvy nevadí. Ke každému cíli patří jiný kyblík.',
  },
  {
    term: 'Pravidlo 4 %',
    explanation:
      'Zjednodušené pravidlo pro rentu: z portfolia lze ročně bezpečně vybírat zhruba 4 % jeho hodnoty, aniž byste ho vyčerpali. Pro měsíční rentu tak potřebujete portfolio přibližně ve výši renta × 300. Pomáhá odhadnout, kolik je potřeba naspořit na finanční nezávislost.',
  },
  {
    term: 'Inflace',
    explanation:
      'Postupné znehodnocování peněz — za stejnou částku si příští rok koupíte o něco méně. Peníze ležící bez úroku na běžném účtu proto reálně ztrácejí hodnotu. Zároveň inflace „ukrajuje" i z reálné výše dluhů (u hypotézy s fixní splátkou pracuje ve váš prospěch).',
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
