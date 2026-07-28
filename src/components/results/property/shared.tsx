import type { ReactNode } from 'react';
import Tooltip from '../../ui/Tooltip';

// Drobné stavební kameny karty nemovitosti. Používá je víc bloků, proto
// sedí tady a ne v jednom z nich.

/**
 * Krokovací tlačítko k posuvníku. Na mobilu se posuvníkem těžko trefuje
 * přesná hodnota, tlačítka dávají spolehlivý krok.
 */
export function StepButton({ onClick, disabled, label, children }: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-line-strong bg-card text-ink-body text-lg font-bold hover:bg-sunken disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

/** Řádek „popisek : hodnota" v přehledu. */
export function Row({ label, value, highlight, bold, tooltip }: {
  label: string;
  value: string;
  highlight?: 'red' | 'green';
  bold?: boolean;
  tooltip?: string;
}) {
  const valueColor = highlight === 'red' ? 'text-danger' : highlight === 'green' ? 'text-good' : 'text-ink';
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-ink-body flex items-center min-w-0">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      {/* Částka se nikdy nesmí zalomit doprostřed: na mobilu by se rozpadla přes dva řádky. */}
      <span className={`shrink-0 whitespace-nowrap ${bold ? 'text-base sm:text-lg font-bold' : 'font-semibold'} ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}

/** Obal posuvníku se šedým pozadím, aby všechny vypadaly stejně. */
export function SliderCard({ children }: { children: ReactNode }) {
  return <div className="p-3 rounded-lg bg-sunken">{children}</div>;
}
