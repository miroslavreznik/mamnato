import type { ReactNode } from 'react';

interface Props {
  /** Zadal hodnotu uživatel ručně? */
  overridden: boolean;
  /** Vysvětlení, jak odhad vzniká. Ukáže se, dokud uživatel nic nezadal. */
  explanation: ReactNode;
  /** Co by appka odhadla teď. Ukáže se u ručně zadané hodnoty pro srovnání. */
  suggestion: ReactNode;
  /** Popisek odkazu, kterým se uživatel vrátí k odhadu. */
  revertLabel: string;
  onRevert: () => void;
  className?: string;
}

/**
 * Poznámka pod polem, které si appka umí odhadnout.
 *
 * Uživatel musí u každého dopočítaného čísla vidět, odkud se vzalo. Text se
 * proto liší podle toho, jestli platí odhad, nebo jeho vlastní hodnota, a
 * v druhém případě nabízí cestu zpátky.
 *
 * Dřív byla tahle trojice (vysvětlení / „zadáno ručně" / odkaz zpět) rozepsaná
 * zvlášť u sazby, u nákladů na vlastnictví i u dávek na rodičovské, pokaždé
 * trochu jinak.
 */
export default function EstimateNote({
  overridden,
  explanation,
  suggestion,
  revertLabel,
  onRevert,
  className = 'text-xs text-gray-500 dark:text-gray-400',
}: Props) {
  if (!overridden) return <p className={className}>{explanation}</p>;

  return (
    <p className={className}>
      {suggestion}{' '}
      <button
        type="button"
        onClick={onRevert}
        className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200"
      >
        {revertLabel}
      </button>
    </p>
  );
}
