import type { ReactNode } from 'react';

export type NumberTone = 'good' | 'caution' | 'danger' | 'plain';

/**
 * Číslo, kvůli kterému karta existuje: popisek, částka, jednotka a k tomu
 * volitelně proužek naplnění a poznámka pod ním.
 *
 * Dřív to byla čtveřice řádků rozepsaná v každé kartě zvlášť, pokaždé o kus
 * jinak (jednou `text-xl`, jinde `text-2xl`, proužek chvíli 6 px a chvíli
 * žádný). Číslo je přitom to hlavní, co má z karty jít přečíst na dálku,
 * takže se nemá lišit podle toho, kde stojí.
 *
 * Proužek je v návrhu 10 px, ne 6: v šesti pixelech se rozdíl mezi „těsně pod
 * limitem" a „přes limit" nedal poznat.
 */

const TONE: Record<NumberTone, { text: string; bar: string }> = {
  good: { text: 'text-good', bar: 'bg-good' },
  caution: { text: 'text-caution', bar: 'bg-caution' },
  danger: { text: 'text-danger', bar: 'bg-danger' },
  plain: { text: 'text-ink', bar: 'bg-ink' },
};

export default function HeroNumber({ label, value, unit, note, tone = 'plain', meter, children, className = '' }: {
  label: ReactNode;
  value: string;
  unit?: string;
  /** Vysvětlivka pod číslem, například „41 % příjmu". */
  note?: ReactNode;
  tone?: NumberTone;
  /** Naplnění 0..1. Bez něj se proužek nekreslí. */
  meter?: number;
  /** Vlastní grafika místo proužku, například měřič měsíců. */
  children?: ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={`p-3 rounded-lg bg-sunken ${className}`.trimEnd()}>
      <span className="text-xs text-ink-muted inline-flex items-center">{label}</span>
      <p className={`type-hero whitespace-nowrap mt-0.5 ${t.text}`}>
        {value}
        {unit && <span className="text-sm font-normal font-sans text-ink-muted"> {unit}</span>}
      </p>
      {meter !== undefined && (
        <div className="mt-2 h-2.5 rounded-full bg-shell overflow-hidden">
          {/* Nula se kreslí jako prázdná kolejnice, ne jako krátký pahýl.
              Pahýl vypadal ve dvouapůlmilimetrovém proužku jako tečka
              a četl se jako „něco tam je", což u nuly není pravda.
              Nenulové, ale drobné hodnoty naopak minimum potřebují,
              jinak by se ztratily úplně. */}
          {meter > 0 && (
            <div
              className={`h-full rounded-full ${t.bar}`}
              style={{ width: `${Math.max(4, Math.min(100, meter * 100))}%` }}
            />
          )}
        </div>
      )}
      {children && <div className="mt-2">{children}</div>}
      {note && <p className="text-xs text-ink-muted mt-1.5">{note}</p>}
    </div>
  );
}
