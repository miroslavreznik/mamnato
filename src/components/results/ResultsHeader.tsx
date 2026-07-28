import type { UserMode } from '../../types';

/**
 * Akce nad přehledem: sdílení, tisk, úprava, začít znovu.
 *
 * Bývala to samostatná karta pod hlavičkou se čtyřmi tlačítky. Spolu
 * s hlavičkou aplikace a lištou záložek z toho byly tři pruhy nad obsahem,
 * které na mobilu snědly skoro třetinu první obrazovky, tedy přesně toho
 * místa, kde má být vidět odpověď.
 *
 * Akce teď sedí přímo v horní liště jako text. Jsou to doplňkové úkony:
 * hlavní věc na téhle obrazovce je odpověď, ne tisk.
 *
 * Na užších oknech zůstane jen ikona a popisek nese `aria-label`, takže se
 * čtečkou i testem najde dál.
 *
 * „Začít znovu" je za oddělovačem a v barvě stavu: je to nevratný krok, který
 * nemá soupeřit o pozornost se sdílením a tiskem. Popisek u něj zůstává vidět
 * i na mobilu, samotná ikona by se dala kliknout omylem.
 */

const MODE_LABELS: Record<UserMode, string> = {
  individual: 'Jednotlivec',
  couple: 'Pár',
  family: 'Rodina',
};

// Ikony jsou 24×24 obrysové, stejně jako ve zbytku appky.
const Icon = ({ path }: { path: string }) => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

function Action({ label, onClick, icon, tone = 'plain', title, alwaysLabel = false }: {
  label: string;
  onClick: () => void;
  icon: string;
  tone?: 'plain' | 'danger';
  title?: string;
  // Popisek i na úzkém okně. Vyhrazeno pro nevratné akce.
  alwaysLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-2 rounded-full text-[13px] font-semibold transition-colors ${
        tone === 'danger' ? 'text-danger hover:bg-tint-danger' : 'text-ink-muted hover:text-ink hover:bg-sunken'
      }`}
    >
      <Icon path={icon} />
      {/* Popisek se ukazuje až od 2xl. S pěti záložkami se vešel i na 1280 px,
          se šesti už ne a „Slovníček" se ořízl. Akce jsou doplňkové, popisek
          nese `aria-label` i `title`, takže se ztratí jen text, ne význam. */}
      <span className={alwaysLabel ? '' : 'hidden 2xl:inline'}>{label}</span>
    </button>
  );
}

/** Nálepka s režimem domácnosti, vedle značky v liště. */
export function ModeChip({ mode }: { mode: UserMode }) {
  return (
    <span className="hidden sm:inline-flex shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-shell text-ink-body">
      {MODE_LABELS[mode]}
    </span>
  );
}

export default function ResultsHeader({ shareCopied, onShare, onPrint, onEdit, onReset }: {
  shareCopied: boolean;
  onShare: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  return (
    <>
      {shareCopied ? (
        // Potvrzení má popisek vidět vždycky, na rozdíl od ostatních akcí.
        // Zatržítko samo o sobě není zpětná vazba: uživatel právě klikl na
        // sdílení a potřebuje vědět, že se něco stalo, ne hádat z ikony.
        // Je to na chvíli, takže krátké přeskládání lišty za to stojí.
        <span className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-[13px] font-semibold text-good whitespace-nowrap">
          <Icon path="M20 6 9 17l-5-5" />
          Odkaz zkopírován
        </span>
      ) : (
        <Action
          label="Sdílet přehled"
          onClick={onShare}
          title="Zkopíruje odkaz, který obsahuje vaše zadaná data (v adrese). Nic se neukládá na server."
          icon="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
        />
      )}
      <Action
        label="Vytisknout / PDF"
        onClick={onPrint}
        icon="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"
      />
      <Action
        label="Upravit údaje"
        onClick={onEdit}
        icon="M11 4H4v16h16v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"
      />
      <span className="w-px h-6 mx-0.5 bg-line" aria-hidden="true" />
      <Action
        label="Začít znovu"
        onClick={onReset}
        tone="danger"
        alwaysLabel
        title="Smaže zadané údaje a spustí průvodce od začátku."
        icon="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"
      />
    </>
  );
}
