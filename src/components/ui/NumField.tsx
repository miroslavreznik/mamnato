import { useEffect, useRef, useState } from 'react';
import { groupThousands, reformatWithCaret, stripGroupSeparators } from './numericText';

interface NumFieldProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  // Když je zadán krok, přibydou tlačítka − a + (stejně jako v průvodci).
  step?: number;
  // Jednotka zobrazená uvnitř pole (Kč, %).
  suffix?: string;
}

/**
 * Lehké číselné pole pro kompaktní vstupy (rozpisy, cíle, kalkulačky).
 *
 * Řeší otravnou nulu: prázdné pole se nedrží jako „0", kterou nejde smazat.
 * Během psaní si drží přesně to, co uživatel napsal (žádná vnucená nula
 * před číslem), a nulová hodnota se zobrazuje jako prázdno.
 *
 * Formátování tisíců i kotvení kurzoru sdílí s `NumberInput` přes `numericText`,
 * aby se obě pole ovládala stejně.
 */
export default function NumField({
  value,
  onChange,
  min = 0,
  max = Infinity,
  className,
  placeholder = '0',
  ariaLabel,
  step,
  suffix,
}: NumFieldProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  // Během psaní ukazujeme přesně zadaný text; jinak hezky s oddělovači tisíců
  // (např. „300 000", „7,5"), konzistentně s hlavním NumberInput.
  const shown = focused ? draft : value ? value.toLocaleString('cs-CZ') : '';

  // Kurzor se musí nastavit až po vykreslení nového textu, jinak ho React
  // vzápětí přepíše a kurzor skončí na konci pole.
  useEffect(() => {
    if (caretRef.current !== null && inputRef.current && focused) {
      const pos = caretRef.current;
      inputRef.current.setSelectionRange(pos, pos);
      caretRef.current = null;
    }
  });

  const input = (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      onFocus={(e) => {
        // Draft se zakládá na tom, co je v poli vidět, ne na holém čísle.
        // Kdyby se text při fokusu změnil (z „3 150" na „3150"), přepsal by
        // React obsah pole zrovna ve chvíli, kdy do něj něco zapisuje uživatel
        // nebo test, a znaky by se místo nahrazení připsaly.
        setFocused(true);
        setDraft(value ? value.toLocaleString('cs-CZ') : '');
        // Výběr musí proběhnout hned. Odložení přes requestAnimationFrame
        // dokázalo označit text až uprostřed psaní a další znak pak smazal,
        // co bylo napsáno předtím.
        e.currentTarget.select();
      }}
      onChange={(e) => {
        // Oddělovače tisíců se dopisují rovnou při psaní. Dřív se ze zadaného
        // textu vyhazovaly, text se tím zkrátil a prohlížeč odložil kurzor
        // na konec pole i uprostřed opravy.
        const typed = e.target.value;
        const { text, caret } = reformatWithCaret(typed, e.target.selectionStart ?? typed.length);
        setDraft(text);
        caretRef.current = caret;

        const raw = stripGroupSeparators(text).replace(',', '.');
        if (raw.trim() === '' || raw === '-') {
          onChange(clamp(0));
          return;
        }
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(clamp(n));
      }}
      onBlur={() => setFocused(false)}
    />
  );

  if (step == null && !suffix) return input;

  // Pole (případně s jednotkou uvnitř) roste do zbylého místa vedle tlačítek.
  const field = suffix ? (
    <div className="relative flex-1 min-w-0">
      {input}
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint text-xs pointer-events-none">
        {suffix}
      </span>
    </div>
  ) : (
    <div className="flex-1 min-w-0">{input}</div>
  );

  if (step == null) return field;

  // Krok zaokrouhlujeme, aby desetinné kroky (0,5 %) nenasbíraly chyby floatu.
  const bump = (direction: 1 | -1) => {
    const next = Math.round((value + direction * step) * 1e6) / 1e6;
    const clamped = clamp(next);
    onChange(clamped);
    // Když je pole rozepsané, musí se s hodnotou posunout i zobrazený text.
    if (focused) setDraft(clamped ? groupThousands(String(clamped).replace('.', ',')) : '');
  };

  const btn =
    'flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-line-strong ' +
    'dark:border-line bg-card text-ink-body text-lg font-bold ' +
    'hover:bg-sunken disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={value <= min}
        aria-label={ariaLabel ? `Snížit: ${ariaLabel}` : 'Snížit'}
        className={btn}
      >
        −
      </button>
      {field}
      <button
        type="button"
        onClick={() => bump(1)}
        disabled={value >= max}
        aria-label={ariaLabel ? `Zvýšit: ${ariaLabel}` : 'Zvýšit'}
        className={btn}
      >
        +
      </button>
    </div>
  );
}
