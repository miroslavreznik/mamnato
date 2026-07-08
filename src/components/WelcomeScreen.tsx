import { loadState } from '../store/localStorage';

interface Props {
  onStart: () => void;
  onResume: () => void;
}

const features = [
  {
    title: 'Co si můžu dovolit',
    desc: 'Uvidíte, jestli na vlastní bydlení dosáhnete a co vám k tomu chybí.',
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
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Zdarma · Bez registrace · Hotovo za 3 minuty
        </span>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 text-balance">
          Mám na to vlastní bydlení?
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-8 max-w-xl mx-auto">
          Zadejte příjmy, výdaje a cíle. Za pár minut uvidíte jasný přehled — jestli na hypotéku dosáhnete, kolik můžete spořit a kam vaše peníze plynou.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={onStart}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-base font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] min-h-[48px]"
          >
            {hasSavedData ? 'Začít znovu' : 'Spustit přehled'}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>

          {hasSavedData && (
            <button
              onClick={onResume}
              className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3.5 rounded-xl text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors min-h-[48px]"
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
            className="rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/70 p-5 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {f.icon}
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
