import { useState } from 'react';

interface NumFieldProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Lehké číselné pole pro kompaktní vstupy (rozpisy, cíle, kalkulačky).
 *
 * Řeší otravnou nulu: prázdné pole se nedrží jako „0", kterou nejde smazat.
 * Během psaní si drží přesně to, co uživatel napsal (žádná vnucená nula
 * před číslem), a nulová hodnota se zobrazuje jako prázdno.
 */
export default function NumField({
  value,
  onChange,
  min = 0,
  max = Infinity,
  className,
  placeholder = '0',
  ariaLabel,
}: NumFieldProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  // Během psaní ukazujeme přesně zadaný text; jinak hezky s oddělovači tisíců
  // (např. „300 000", „7,5"), konzistentně s hlavním NumberInput.
  const shown = focused ? draft : value ? value.toLocaleString('cs-CZ') : '';

  return (
    <input
      type="text"
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value ? String(value) : '');
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,-]/g, '');
        setDraft(raw);
        if (raw.trim() === '' || raw === '-') {
          onChange(clamp(0));
          return;
        }
        const n = Number(raw.replace(',', '.'));
        if (!Number.isNaN(n)) onChange(clamp(n));
      }}
      onBlur={() => setFocused(false)}
    />
  );
}
