import { loadState } from '../store/localStorage';

interface Props {
  onStart: () => void;
  onResume: () => void;
}

export default function WelcomeScreen({ onStart, onResume }: Props) {
  const hasSavedData = !!loadState();

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="text-6xl mb-6">🏠💰</div>

      <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
        Mám na to?
      </h2>

      <p className="text-lg text-gray-600 dark:text-gray-300 max-w-lg mb-8 leading-relaxed">
        Zadej příjmy, výdaje a své plány. Za pár minut zjistíš, jestli si můžeš dovolit vlastní bydlení, nebo jak nejlépe začít spořit.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onStart}
          className="w-full px-8 py-3.5 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors min-h-[44px] shadow-sm"
        >
          {hasSavedData ? 'Začít znovu' : 'Začít'}
        </button>

        {hasSavedData && (
          <button
            onClick={onResume}
            className="w-full px-8 py-3 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors min-h-[44px]"
          >
            Pokračovat tam, kde jste skončili
          </button>
        )}
      </div>

      <div className="mt-12 grid grid-cols-3 gap-6 text-center max-w-md">
        <div>
          <div className="text-2xl mb-1">📊</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Přehled financí</p>
        </div>
        <div>
          <div className="text-2xl mb-1">🔒</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Data zůstávají u vás</p>
        </div>
        <div>
          <div className="text-2xl mb-1">⚡</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Výsledky za 3 minuty</p>
        </div>
      </div>
    </div>
  );
}
