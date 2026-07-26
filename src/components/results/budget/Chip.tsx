// Přepínače režimu „co kdyby". Vypnutím položky se přepočítá celý přehled,
// proto musí být jasně vidět, co je zapnuté a co ne, a to i bez barev
// (proškrtnutí + aria-pressed).

// Jednotný přepínač pro výdaj, položku rozpisu i cíl.
export function Chip({ label, color, off, onClick, note, title }: {
  label: string;
  color: string;
  off: boolean;
  onClick: () => void;
  note?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={!off}
      className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-xs border transition-colors ${
        off
          ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 line-through'
          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: off ? 'transparent' : color, border: off ? `1px solid ${color}` : 'none' }}
      />
      {label}
      {note && <span className="text-[10px] text-amber-600 dark:text-amber-400">{note}</span>}
    </button>
  );
}
