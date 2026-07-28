import { useWizard } from '../../store/wizardStore';
import { previewData, PREVIEW_COLORS } from '../../engine/preview';
import { czk, czkMonthly } from '../../engine/format';

/**
 * Průběžný náhled: co zatím z čísel vychází.
 *
 * Dosud uživatel viděl první číslo až na konci průvodce, po sedmi krocích
 * vyplňování. Když pak výsledek nesedl, neměl tušení, která z těch sedmi
 * obrazovek za to může. Náhled ukazuje dopad každé změny hned.
 *
 * Nezobrazuje verdikt. Ten potřebuje cíle, které se zadávají až v pátém
 * kroku, a předběžné „máte na to" na první obrazovce by byl slib
 * z nekompletních dat. Náhled proto říká jen to, co je jisté: kolik zbývá
 * po výdajích.
 *
 * Hodnoty jsou od začátku předvyplněné průměry ČR, takže náhled má co
 * ukazovat i na prvním kroku. To je záměr: uživatel vidí, do čeho jde,
 * a přepisuje jen to, co u něj sedí jinak.
 *
 * Na mobilu se místo téhle karty ukazuje proužek ve spodní liště
 * (`StepNavigation`). Karta pod formulářem by na malé obrazovce byla až za
 * všemi poli, tedy přesně tam, kam se uživatel při vyplňování nedívá.
 */
export default function LivePreview() {
  const { state } = useWizard();
  const { income, disposable, segments, total } = previewData(state);

  return (
    <div className="rounded-2xl bg-sunken p-5">
      <p className="type-label text-ink-muted">Zatím to vypadá takto</p>

      <p className={`type-hero mt-1.5 ${disposable >= 0 ? 'text-ink' : 'text-danger'}`}>
        {disposable >= 0 ? '+' : '−'}{czk(Math.abs(disposable))}
      </p>
      <p className="text-[13px] text-ink-muted mt-0.5">
        {disposable >= 0
          ? <>zbývá měsíčně z příjmu {czk(income)}</>
          : <>o tolik měsíčně přesahují výdaje příjem {czk(income)}</>}
      </p>

      <div
        className="mt-4 flex gap-0.5 h-3"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${czkMonthly(s.amount)}`).join(', ')}
      >
        {segments.map((seg, i) => {
          const share = total > 0 ? seg.amount / total : 0;
          if (share <= 0) return null;
          return (
            <span
              key={seg.key}
              className={`${PREVIEW_COLORS[seg.key]} ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
              style={{ width: `${share * 100}%` }}
            />
          );
        })}
      </div>

      <dl className="mt-3 space-y-1 text-[13px]">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-baseline justify-between gap-3">
            <dt className="inline-flex items-center gap-2 text-ink-body">
              <span className={`w-2 h-2 rounded-full shrink-0 ${PREVIEW_COLORS[seg.key]}`} aria-hidden="true" />
              {seg.label}
            </dt>
            <dd className={`tabular-nums ${seg.key === 'free' ? 'font-semibold text-ink' : 'text-ink-body'}`}>
              {czk(seg.amount)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs text-ink-muted leading-relaxed">
        Předvyplněno průměry pro ČR. Přepište jen to, co u vás sedí jinak.
      </p>
    </div>
  );
}

/**
 * Totéž na jeden řádek, do spodní lišty na mobilu.
 *
 * Ukazuje jen číslo a poměr. Rozpis po položkách se sem nevejde a hlavně
 * není potřeba: účel proužku je, aby při psaní do pole bylo periferně vidět,
 * že se něco hnulo.
 */
export function LivePreviewStrip() {
  const { state } = useWizard();
  const { disposable, segments, total } = previewData(state);

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted leading-none">Zatím zbývá</p>
        <p className={`text-base font-bold tabular-nums leading-tight ${disposable >= 0 ? 'text-ink' : 'text-danger'}`}>
          {disposable >= 0 ? '+' : '−'}{czk(Math.abs(disposable))}
        </p>
      </div>
      <div className="flex-1 flex gap-0.5 h-2 min-w-0" aria-hidden="true">
        {segments.map((seg, i) => {
          const share = total > 0 ? seg.amount / total : 0;
          if (share <= 0) return null;
          return (
            <span
              key={seg.key}
              className={`${PREVIEW_COLORS[seg.key]} ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
              style={{ width: `${share * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
