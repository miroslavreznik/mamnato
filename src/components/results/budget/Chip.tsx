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
          ? 'border-line text-ink-faint line-through'
          : 'border-line-strong text-ink-label hover:bg-sunken/50'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: off ? 'transparent' : color, border: off ? `1px solid ${color}` : 'none' }}
      />
      {label}
      {note && <span className="text-[10px] text-caution">{note}</span>}
    </button>
  );
}
