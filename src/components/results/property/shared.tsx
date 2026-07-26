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
      className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
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
  const valueColor = highlight === 'red' ? 'text-red-600' : highlight === 'green' ? 'text-green-600' : 'text-gray-900 dark:text-white';
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-gray-600 dark:text-gray-300 flex items-center min-w-0">
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
  return <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">{children}</div>;
}
