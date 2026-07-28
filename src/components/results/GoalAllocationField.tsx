import NumField from '../ui/NumField';
import { fieldClass } from '../ui/fieldClass';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}

/**
 * Měsíční částka, kterou uživatel na daný cíl odkládá.
 *
 * Patří do karty konkrétního cíle, ne do rozpočtu: rozpočet ukazuje, kam
 * peníze tečou, kdežto rozhodnutí „kolik na to dávám" se dělá u cíle, kde
 * je vidět, co za to bude.
 */
export default function GoalAllocationField({ label, value, onChange, hint }: Props) {
  return (
    <div className="mt-4 pt-4 border-t border-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium text-ink-label">{label}</label>
        <NumField
          value={value}
          onChange={onChange}
          ariaLabel={label}
          step={500}
          suffix="Kč"
          className={fieldClass('w-28 text-right pr-8 pl-2 py-2.5 text-base')}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
