import { loadState } from '../store/localStorage';

interface Props {
  onStart: () => void;
  onResume: () => void;
}

const features = [
  {
    title: 'Co si můžu dovolit',
    desc: 'Uvidíte, jestli na vlastní bydlení dosáhnete a co vám po něm zbyde na ostatní cíle.',
    icon: (
      <path d="M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5M9.5 20v-5h5v5" />
    ),
  },
  {
    title: 'Kam tečou peníze',
    desc: 'Přehledný rozpad příjmů, výdajů a spoření na vaše cíle.',
    icon: (
      <path d="M4 19V5m0 14h16M8 15l3-4 3 3 5-7" />
    ),
  },
  {
    title: 'Odnesete si to',
    desc: 'Přehled si vytisknete do PDF nebo pošlete odkazem komukoli, s kým se radíte.',
    icon: (
      <path d="M6 9V4h12v5M6 18h12v-5H6zM6 14h12M8 4v5m8-5v5" />
    ),
  },
];

/**
 * Čtyři věty o tom, co se **nestane**.
 *
 * Přišlo to ze zpětné vazby: „zdarma" a „bez registrace" lidem neodpoví na
 * to, čeho se u finanční kalkulačky doopravdy bojí, tedy jestli za tím
 * nestojí banka a jestli jim za týden nezačne někdo volat s nabídkou
 * hypotéky. Odpověď musí být vidět dřív, než začnou psát příjmy, ne až
 * v podmínkách dole.
 *
 * Stojí to na **jednom místě**, v kartě pod dlaždicemi. Nejdřív to bylo
 * rozseté na tři: odznáček nad nadpisem, seznam pod tlačítkem a dlaždice
 * „Data zůstávají u vás". Každé to říkalo trochu jinak a dohromady to
 * působilo jako přemlouvání.
 *
 * Každá věta je ověřitelná: appka nemá backend, produkční CSP má
 * `connect-src 'none'`, nikde se neptá na jméno ani kontakt a nemá
 * analytiku. Kdyby se cokoli z toho změnilo, musí se změnit i tenhle výčet.
 */
const promises = [
  'Zdarma a bez registrace',
  'Nejsme banka ani zprostředkovatel',
  'Nechceme jméno, e-mail ani telefon',
  'Nikdo vás nebude obvolávat s nabídkami',
  'Čísla zůstávají ve vašem prohlížeči',
];

export default function WelcomeScreen({ onStart, onResume }: Props) {
  const hasSavedData = !!loadState();

  return (
    <div className="py-6 sm:py-10">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-tint-brand text-brand border border-line mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-ink" />
          Hotovo za 3 minuty
        </span>

        <h1 className="type-display text-ink mb-4 text-balance">
          Mám na vlastní bydlení a na své cíle?
        </h1>

        <p className="text-lg text-ink-body leading-relaxed mb-8 max-w-xl mx-auto">
          Zadejte příjmy, výdaje a cíle. Za pár minut uvidíte základní finanční plán: jestli na vlastní bydlení dosáhnete, co vám po splátce zbyde na ostatní cíle a kam vaše peníze plynou.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={onStart}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-xl bg-ink text-page text-base font-semibold hover:opacity-90 transition-all active:scale-[0.98] min-h-[48px]"
          >
            {hasSavedData ? 'Začít znovu' : 'Spustit přehled'}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>

          {hasSavedData && (
            <button
              onClick={onResume}
              className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3.5 rounded-xl text-brand font-medium border border-line hover:bg-tint-brand transition-colors min-h-[48px]"
            >
              Pokračovat tam, kde jste skončili
            </button>
          )}
        </div>

      </div>

      {/* Co appka umí a co po vás nechce, v jedné mřížce.
          Dřív to bylo na třech místech: odznáček nahoře („Zdarma · Bez
          registrace"), seznam pod tlačítkem a dlaždice „Data zůstávají
          u vás". Trojí obměna téhož vypadá jako přemlouvání, ne jako slib. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-line bg-card/70 p-5 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-tint-brand flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {f.icon}
              </svg>
            </div>
            <h3 className="font-semibold text-ink mb-1">{f.title}</h3>
            <p className="text-sm text-ink-muted leading-relaxed">{f.desc}</p>
          </div>
        ))}

        {/* Slib přes celou šířku, ne čtvrtá dlaždice v řadě: je to jiný druh
            informace než „co uvidíte" a čte se jako výčet, ne jako odstavec. */}
        <div className="sm:col-span-3 rounded-2xl border border-line bg-card/70 p-5 text-left">
          <h3 className="font-semibold text-ink mb-3">Nejsme banka a nic po vás nechceme</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            {promises.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-ink-body">
                <svg className="w-4 h-4 shrink-0 mt-0.5 text-good" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
          {/* Zbylo jen to, co výčet neřekne. Věta o prohlížeči byla i tady
              i v patičce pod tím, tedy třetí obměna téhož na jedné obrazovce. */}
          <p className="mt-3 text-xs text-ink-muted">
            Je to vzdělávací a informační nástroj, ne nabídka ani poradenství.
          </p>
        </div>
      </div>
    </div>
  );
}
