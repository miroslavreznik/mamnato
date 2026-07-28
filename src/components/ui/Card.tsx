import type { ReactNode } from 'react';
import Tooltip from './Tooltip';

/**
 * Karta výsledků.
 *
 * Obal karty byl zkopírovaný v devatenácti souborech jako řetězec tříd, takže
 * každá změna vzhledu se dělala devatenáctkrát a na jedno místo se zapomnělo.
 *
 * Hlavička má dvě podoby, obě se sem vešly beze změny rozestupů: samotný
 * nadpis (`mb-4`), nebo nadpis těsně nad podnadpisem (`mb-1` a `mb-4`).
 */
export default function Card({ title, subtitle, tooltip, children, className = '' }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Nápověda vedle nadpisu. */
  tooltip?: string;
  children: ReactNode;
  /** Doplňkové třídy obalu. Pro výjimky, ne pro barvy. */
  className?: string;
}) {
  return (
    <div className={`bg-card rounded-xl shadow-sm border border-line p-6 ${className}`.trimEnd()}>
      {title && (
        <h3 className={`type-section text-ink ${subtitle ? 'mb-1' : 'mb-4'}`}>
          {title}
          {tooltip && <Tooltip text={tooltip} />}
        </h3>
      )}
      {subtitle && <p className="text-sm text-ink-muted mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}
