interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface SortedTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  nameFormatter?: (name: string) => string;
}

export default function SortedTooltip({
  active,
  payload,
  label,
  labelFormatter,
  nameFormatter,
}: SortedTooltipProps) {
  if (!active || !payload?.length) return null;

  const sorted = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
  const formattedLabel = labelFormatter && label != null ? labelFormatter(label) : `${label}`;

  return (
    <div className="bg-card border border-line rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-ink mb-1.5">{formattedLabel}</p>
      {sorted.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-ink-body">
            {nameFormatter ? nameFormatter(entry.name) : entry.name}:
          </span>
          <span className="ml-auto font-medium text-ink">
            {Number(entry.value).toLocaleString('cs-CZ')} Kč
          </span>
        </div>
      ))}
    </div>
  );
}
