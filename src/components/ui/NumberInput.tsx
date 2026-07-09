import { useState, useEffect, useRef, useCallback } from 'react';
import Tooltip from './Tooltip';

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

function formatWithThousands(digits: string): string {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0'); // non-breaking space
}

function stripSpaces(s: string): string {
  return s.replace(/[\s\u00A0]/g, '');
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
      return formatWithThousands(String(Math.round(val)));
    }
    return val.toLocaleString('cs-CZ');
  }, [shouldLiveFormat]);

  const [displayValue, setDisplayValue] = useState(formatForDisplay(value));
  const [isFocused, setIsFocused] = useState(false);
  const prevValueRef = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  // Sync display when value changes externally (e.g. spinner, shorthand).
  // Záměrná synchronizace zobrazení s propem, když pole není ve fokusu —
  // během psaní si displayValue drží rozepsaný text uživatele.
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
    const normalized = stripSpaces(raw).replace(',', '.');
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
      const cursorPos = e.target.selectionStart ?? raw.length;
      // Count digits before cursor in the raw input
      const digitsBeforeCursor = stripSpaces(raw.slice(0, cursorPos)).replace(/[^\d]/g, '').length;

      const digits = stripSpaces(raw).replace(/[^\d]/g, '');
      const formatted = formatWithThousands(digits);
      setDisplayValue(formatted);

      // Commit to state on every keystroke
      const parsed = parseInt(digits, 10) || 0;
      onChange(Math.max(min, parsed));

      // Calculate new cursor position: find where the Nth digit is in formatted string
      let digitCount = 0;
      let newCursorPos = formatted.length;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== '\u00A0' && formatted[i] !== ' ') {
          digitCount++;
          if (digitCount === digitsBeforeCursor) {
            newCursorPos = i + 1;
            break;
          }
        }
      }
      cursorRef.current = newCursorPos;
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
    const normalized = stripSpaces(displayValue).replace(',', '.').replace(/[^0-9.-]/g, '');
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
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </label>
      <div className="flex items-center gap-1.5">
        {showSpinner && (
          <button
            type="button"
            onClick={decrement}
            disabled={disabled}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700"
            aria-label="Snížit"
          >
            −
          </button>
        )}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            className={`w-full px-3 py-2.5 pr-12 border rounded-lg text-base focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed ${
              isInvalid
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            }`}
            aria-invalid={isInvalid}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
            {suffix}
          </span>
        </div>
        {showSpinner && (
          <button
            type="button"
            onClick={increment}
            disabled={disabled}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700"
            aria-label="Zvýšit"
          >
            +
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {!error && value < min && (
        <p className="mt-1 text-sm text-red-600">Hodnota musí být alespoň {formatForDisplay(min)}</p>
      )}
    </div>
  );
}
