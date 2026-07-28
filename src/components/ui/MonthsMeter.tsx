/**
 * Rezerva v měsících jako dlaždice, ne jako proužek.
 *
 * Doporučení je 3 až 6 měsíců výdajů, což je počítaná věc, a tenký proužek
 * z ní dělal spojitou škálu, na které nešlo poznat, jestli jsou to dva měsíce
 * nebo dva a půl. Dlaždice se dají spočítat pohledem a rozdíl mezi „mám tři"
 * a „mám skoro tři" je vidět na první pohled.
 *
 * Neúplný měsíc se kreslí poloviční sytostí. Zaokrouhlit nahoru by lhalo
 * (2,1 měsíce není tříměsíční rezerva), zaokrouhlit dolů by zahodilo rozdíl
 * mezi 2,0 a 2,9.
 */
export default function MonthsMeter({ months, target = 6, tone, className = '' }: {
  months: number;
  /** Kolik dlaždic se kreslí. Doporučení je šest měsíců výdajů. */
  target?: number;
  tone: 'good' | 'caution' | 'danger';
  className?: string;
}) {
  const fill = { good: 'bg-good', caution: 'bg-caution', danger: 'bg-danger' }[tone];
  const whole = Math.floor(Math.min(months, target));
  const partial = Math.min(months, target) - whole;

  return (
    <div
      className={`flex gap-1 ${className}`.trimEnd()}
      role="img"
      aria-label={`Rezerva vydrží ${months.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} z doporučených ${target} měsíců`}
    >
      {Array.from({ length: target }, (_, i) => {
        const state = i < whole ? 'full' : i === whole && partial > 0.05 ? 'partial' : 'empty';
        return (
          <span
            key={i}
            className={`flex-1 h-6 rounded-md ${state === 'empty' ? 'bg-shell' : fill} ${state === 'partial' ? 'opacity-50' : ''}`.trimEnd()}
          />
        );
      })}
    </div>
  );
}
