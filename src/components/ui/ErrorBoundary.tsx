import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearState } from '../../store/localStorage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Záchranná síť pro neošetřené chyby při renderu.
 *
 * Bez ní React při výjimce odmountuje celý strom a uživateli zůstane prázdná
 * bílá stránka, po proklikání celého průvodce ten nejhorší možný konec.
 * Nejčastější příčinou bývá rozbitý nebo starý stav v localStorage, proto
 * nabízíme i možnost data smazat a začít znovu.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nikam se nic neposílá, appka běží bez serveru i bez analytiky.
    // Výpis v konzoli je jediná stopa pro případné hlášení chyby.
    console.error('MámNaTo? Neočekávaná chyba:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      clearState();
    } catch {
      // I kdyby úklid selhal, zkusíme aspoň načíst appku znovu.
    }
    window.location.href = window.location.pathname;
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 text-center">
          <div className="text-4xl mb-3" aria-hidden="true">
            😕
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Něco se pokazilo
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
            Omlouváme se, ale aplikace narazila na neočekávanou chybu. Vaše data
            zůstala ve vašem prohlížeči a nikam se neodeslala.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Zkusit znovu
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Smazat data a začít znovu
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Když chyba přetrvává, pomůže obvykle druhá možnost. Nejčastěji za to může
            rozbitým rozpracovaným přehledem uloženým v prohlížeči.
          </p>
        </div>
      </div>
    );
  }
}
