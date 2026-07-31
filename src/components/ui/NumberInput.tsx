import { useState, useEffect, useId, useRef, useCallback } from 'react';
import Tooltip from './Tooltip';
import { groupThousands, stripGroupSeparators, reformatWithCaret } from './numericText';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  showSpinner?: boolean;
  error?: string;
  liveFormat?: boolean; // enable thousand separators while typing (default true for Kč)
  disabled?: boolean;
}

export default function NumberInput({
  label,
  value,
  onChange,
  tooltip,
  suffix = 'Kč',
  min = 0,
  max = 999000000,
  step = 1000,
  showSpinner = true,
  error,
  liveFormat,
  disabled = false,
}: NumberInputProps) {
  // Default liveFormat: true for Kč, false for %, roky, měsíců, let, dětí
  const shouldLiveFormat = liveFormat ?? !['%', 'let', 'roky', 'měsíců', 'dětí'].includes(suffix);

  const formatForDisplay = useCallback((val: number) => {
    if (shouldLiveFormat) {
      return groupThousands(String(Math.round(val)));
    }
    return val.toLocaleString('cs-CZ');
  }, [shouldLiveFormat]);

  const [displayValue, setDisplayValue] = useState(formatForDisplay(value));
  const [isFocused, setIsFocused] = useState(false);
  const prevValueRef = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);
  // Popisek nebyl s polem svázaný, takže odečítač obrazovky četl jen „editační
  // pole" a klepnutí na popisek pole nezaostřilo. Jméno drží aria-label, aby
  // se do něj nezapočítal tooltip vložený uvnitř <label>.
  const inputId = useId();

  // Sync display when value changes externally (e.g. spinner, shorthand).
  // Záměrná synchronizace zobrazení s propem, když pole není ve fokusu.
  // Během psaní si displayValue drží rozepsaný text uživatele.
  useEffect(() => {
    if (!isFocused && value !== prevValueRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayValue(formatForDisplay(value));
    }
    prevValueRef.current = value;
  }, [value, isFocused, formatForDisplay]);

  // Restore cursor position after live formatting
  useEffect(() => {
    if (cursorRef.current !== null && inputRef.current && isFocused) {
      const pos = cursorRef.current;
      inputRef.current.setSelectionRange(pos, pos);
      cursorRef.current = null;
    }
  });

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (shouldLiveFormat) {
      // Keep formatted display, select all
      setDisplayValue(formatForDisplay(value));
    } else {
      setDisplayValue(String(value).replace('.', ','));
    }
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Try shorthand parsing immediately (5.5M, 550k)
    const normalized = stripGroupSeparators(raw).replace(',', '.');
    const shorthandMatch = normalized.match(/^(-?\d*\.?\d+)(mil|m|k)$/i);
    if (shorthandMatch) {
      const base = parseFloat(shorthandMatch[1]);
      const unit = shorthandMatch[2].toLowerCase();
      const multiplier = unit === 'k' ? 1_000 : 1_000_000;
      if (!isNaN(base)) {
        const val = base * multiplier;
        onChange(val);
        setDisplayValue(formatForDisplay(val));
        setIsFocused(false);
        return;
      }
    }

    if (shouldLiveFormat) {
      // Kurzor se kotví k číslici, u které uživatel stál. Pozice ve znacích se
      // přeskupením tisíců posune, počet číslic před kurzorem ne. Bez toho
      // kurzor po smazání první číslice odskočil až za poslední nulu.
      const cursorPos = e.target.selectionStart ?? raw.length;
      const { text: formatted, caret } = reformatWithCaret(raw, cursorPos);
      setDisplayValue(formatted);
      cursorRef.current = caret;

      // Commit to state on every keystroke
      const parsed = parseInt(stripGroupSeparators(formatted).replace(/\D/g, ''), 10) || 0;
      onChange(Math.max(min, parsed));
    } else {
      setDisplayValue(raw);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (shouldLiveFormat) {
      // Already committed on every keystroke, just reformat display
      setDisplayValue(formatForDisplay(value));
      return;
    }
    const normalized = stripGroupSeparators(displayValue).replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(normalized);

    if (!isNaN(parsed)) {
      const clamped = Math.max(min, parsed);
      onChange(clamped);
      setDisplayValue(formatForDisplay(clamped));
    } else {
      setDisplayValue(formatForDisplay(value));
    }
  };

  const increment = () => {
    const newVal = Math.round((value + step) * 1e6) / 1e6;
    if (newVal <= max) {
      onChange(newVal);
      setDisplayValue(formatForDisplay(newVal));
    }
  };

  const decrement = () => {
    const newVal = Math.round((value - step) * 1e6) / 1e6;
    if (newVal >= min) {
      onChange(newVal);
      setDisplayValue(formatForDisplay(newVal));
    }
  };

  const isInvalid = value < min || value > max || !!error;

  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink-label mb-1">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </label>
      <div className="flex items-center gap-1.5">
        {showSpinner && (
          <button
            type="button"
            onClick={decrement}
            disabled={disabled}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-line-strong bg-card text-ink-body hover:bg-sunken text-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
            aria-label={`Snížit: ${label}`}
          >
            −
          </button>
        )}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="decimal"
            aria-label={label}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            className={`w-full px-3 py-2.5 pr-12 border rounded-lg text-base focus:outline-none focus:ring-2 bg-card text-ink disabled:opacity-60 disabled:cursor-not-allowed ${
              isInvalid
                ? 'border-danger focus:ring-danger'
                : 'border-line-strong focus:ring-ink focus:border-ink'
            }`}
            aria-invalid={isInvalid}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint text-sm pointer-events-none">
            {suffix}
          </span>
        </div>
        {showSpinner && (
          <button
            type="button"
            onClick={increment}
            disabled={disabled}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-line-strong bg-card text-ink-body hover:bg-sunken text-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
            aria-label={`Zvýšit: ${label}`}
          >
            +
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      {!error && value < min && (
        <p className="mt-1 text-sm text-danger">Hodnota musí být alespoň {formatForDisplay(min)}</p>
      )}
    </div>
  );
}
