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
    title: 'Data zůstávají u vás',
    desc: 'Nic se nikam neposílá. Vše počítá váš prohlížeč, žádná registrace.',
    icon: (
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    ),
  },
];

export default function WelcomeScreen({ onStart, onResume }: Props) {
  const hasSavedData = !!loadState();

  return (
    <div className="py-6 sm:py-10">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-tint-brand text-brand border border-line mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-ink" />
          Zdarma · Bez registrace · Hotovo za 3 minuty
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

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14">
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
      </div>
    </div>
  );
}
