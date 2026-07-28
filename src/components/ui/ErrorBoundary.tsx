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
      <div className="min-h-screen flex items-center justify-center p-4 bg-sunken">
        <div className="max-w-md w-full bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
          <div className="text-4xl mb-3" aria-hidden="true">
            😕
          </div>
          <h1 className="type-section text-ink mb-2">
            Něco se pokazilo
          </h1>
          <p className="text-sm text-ink-body mb-5">
            Omlouváme se, ale aplikace narazila na neočekávanou chybu. Vaše data
            zůstala ve vašem prohlížeči a nikam se neodeslala.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-xl bg-ink text-page hover:opacity-90 transition-opacity"
            >
              Zkusit znovu
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-xl border border-line-strong text-ink-label hover:bg-sunken transition-colors"
            >
              Smazat data a začít znovu
            </button>
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Když chyba přetrvává, pomůže obvykle druhá možnost. Nejčastěji za to může
            rozbitý rozpracovaný přehled uložený v prohlížeči.
          </p>
        </div>
      </div>
    );
  }
}
