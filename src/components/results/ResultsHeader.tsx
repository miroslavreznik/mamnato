import type { ReactNode } from 'react';
import type { UserMode } from '../../types';

/**
 * Hlavička výsledků: název plánu, režim a akce nad ním.
 *
 * Čtyři plnotučná tlačítka s popiskem se na užších oknech lámala do dvou
 * nerovných řádků a přebíjela nadpis, pod nímž hned následoval druhý pruh
 * s navigací. Dvě lišty podobné váhy pod sebou vypadaly jako nedodělek.
 *
 * Akce jsou proto v jedné kartě s nadpisem, na mobilu jen jako ikony
 * (popisek nese `aria-label`, takže se čtečkou i testem najdou dál).
 * „Začít znovu" je za oddělovačem a bez rámečku: je to nevratný krok,
 * který nemá soupeřit o pozornost se sdílením a tiskem.
 */

const MODE_LABELS: Record<UserMode, string> = {
  individual: 'Jednotlivec',
  couple: 'Pár',
  family: 'Rodina',
};

function Action({ label, onClick, icon, tone = 'plain', title, alwaysLabel = false }: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  tone?: 'plain' | 'danger';
  title?: string;
  // Popisek i na mobilu. Vyhrazeno pro nevratné akce: samotná ikona
  // u „Začít znovu" by se dala kliknout omylem.
  alwaysLabel?: boolean;
}) {
  const styles = tone === 'danger'
    ? 'text-danger hover:bg-tint-danger'
    : 'text-ink-body hover:bg-sunken hover:text-ink';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-sm font-medium transition-colors ${styles}`}
    >
      {icon}
      <span className={alwaysLabel ? '' : 'hidden sm:inline'}>{label}</span>
    </button>
  );
}

// Ikony jsou 24×24 obrysové, stejně jako ve zbytku appky.
const Icon = ({ path }: { path: string }) => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

export default function ResultsHeader({ mode, shareCopied, onShare, onPrint, onEdit, onReset }: {
  mode: UserMode;
  shareCopied: boolean;
  onShare: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-line bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <h2 className="text-xl font-semibold text-ink truncate">Váš finanční plán</h2>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-sunken text-ink-body">
          {MODE_LABELS[mode]}
        </span>
      </div>

      <div className="no-print flex items-center gap-0.5">
        {shareCopied ? (
          <span className="inline-flex items-center gap-1.5 min-h-[44px] px-2.5 sm:px-3 text-sm font-medium text-good">
            <Icon path="M20 6 9 17l-5-5" />
            <span className="hidden sm:inline">Odkaz zkopírován</span>
          </span>
        ) : (
          <Action
            label="Sdílet přehled"
            onClick={onShare}
            title="Zkopíruje odkaz, který obsahuje vaše zadaná data (v adrese). Nic se neukládá na server."
            icon={<Icon path="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />}
          />
        )}
        <Action
          label="Vytisknout / PDF"
          onClick={onPrint}
          icon={<Icon path="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />}
        />
        <Action
          label="Upravit údaje"
          onClick={onEdit}
          icon={<Icon path="M11 4H4v16h16v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />}
        />
        <span className="w-px h-6 mx-1 bg-shell" aria-hidden="true" />
        <Action
          label="Začít znovu"
          onClick={onReset}
          tone="danger"
          alwaysLabel
          title="Smaže zadané údaje a spustí průvodce od začátku."
          icon={<Icon path="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />}
        />
      </div>
    </div>
  );
}
