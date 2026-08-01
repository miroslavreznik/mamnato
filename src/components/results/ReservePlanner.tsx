import type { WizardState } from '../../types';
import { reserveStatus, monthsToFillReserve, DEFAULT_RESERVE_MONTHS, MAX_RESERVE_MONTHS } from '../../engine/reserve';
import { czk, czkMonthly, formatMonths, monthYearIn, decimal } from '../../engine/format';
import GoalAllocationField from './GoalAllocationField';
import Card from '../ui/Card';
import Callout from '../ui/Callout';
import StatusBadge from '../ui/StatusBadge';
import NumField from '../ui/NumField';
import { fieldClass } from '../ui/fieldClass';

/**
 * Nouzová rezerva jako cíl, který jde nastavit a sledovat.
 *
 * Appka ji ve slovníčku označuje za první věc, která má být hotová, a karta
 * „A co teď" ji uměla doporučit. Nešla ale zapnout, takže se nikde neobjevila
 * vedle důchodu a dítěte: ani v rozpočtu, ani na časové ose, ani mezi cíli
 * v Co kdyby. Doporučení, které nemá v plánu místo, se čte jako poznámka.
 *
 * Karta odpovídá na tři věci a nic víc: kolik mám mít, kolik mám a kdy to
 * bude. Vysvětlení, proč rezerva vůbec, patří do slovníčku.
 */

interface Props {
  state: WizardState;
  monthlyAllocation: number;
  onChangeAllocation: (v: number) => void;
  /** Zápis do plánu: na kolik měsíců má rezerva vystačit. */
  onChangeMonths: (months: number) => void;
}

export default function ReservePlanner({ state, monthlyAllocation, onChangeAllocation, onChangeMonths }: Props) {
  const status = reserveStatus(state);
  const months = monthsToFillReserve(state, monthlyAllocation);
  const progress = status.target > 0 ? Math.min(1, status.current / status.target) : 1;

  return (
    <Card
      title="Nouzová rezerva"
      subtitle="Peníze na nečekaný výdaj nebo výpadek příjmu. Mají být hotové dřív než cokoli dlouhodobého."
    >
      <div className="mb-4">
        <StatusBadge
          status={status.done ? 'good' : monthlyAllocation > 0 ? 'caution' : 'danger'}
          label={status.done ? 'Hotová' : monthlyAllocation > 0 ? 'Buduje se' : 'Zatím na ni nic nejde'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <div className="p-3 rounded-lg bg-sunken">
          <span className="text-sm text-ink-muted">Cílová částka</span>
          <p className="text-lg font-bold text-ink tabular-nums">{czk(status.target)}</p>
        </div>
        <div className="p-3 rounded-lg bg-sunken">
          <span className="text-sm text-ink-muted">Máte stranou</span>
          <p className="text-lg font-bold text-ink tabular-nums">{czk(status.current)}</p>
        </div>
        <div className="p-3 rounded-lg bg-sunken">
          <span className="text-sm text-ink-muted">{status.done ? 'Vydrží' : 'Chybí'}</span>
          <p className={`text-lg font-bold tabular-nums ${status.done ? 'text-good' : 'text-caution'}`}>
            {status.done
              ? `${decimal(Math.min(status.monthsCovered, 99))} měs.`
              : czk(status.gap)}
          </p>
        </div>
      </div>

      {/* Ukazatel je jediné místo, kde je stav vidět bez čtení čísel. */}
      <div
        className="h-2.5 w-full rounded-full bg-sunken overflow-hidden mb-1"
        role="img"
        aria-label={`Rezerva naplněna na ${Math.round(progress * 100)} %`}
      >
        <div
          className={`h-full rounded-full ${status.done ? 'bg-good' : 'bg-caution'}`}
          style={{ width: `${Math.max(2, progress * 100)}%` }}
        />
      </div>
      <p className="text-xs text-ink-faint mb-5">
        {status.afterPurchase
          ? 'Počítá se s tím, co zbyde po zaplacení akontace, a s výdaji po koupi: splátka bývá vyšší než dnešní nájem, takže tatáž rezerva vydrží kratší dobu.'
          : 'Počítá se z nezbytných výdajů, tedy bez zábavy, dovolené a koníčků.'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <div>
          <label className="block text-sm font-medium text-ink-label mb-1">
            Na kolik měsíců má vystačit
          </label>
          <NumField
            value={status.targetMonths}
            onChange={onChangeMonths}
            min={1}
            max={MAX_RESERVE_MONTHS}
            step={1}
            ariaLabel="Na kolik měsíců má rezerva vystačit"
            className={fieldClass('w-full px-3 py-2.5 text-base')}
          />
          <p className="mt-1 text-xs text-ink-faint">
            Doporučení jsou {formatMonths(DEFAULT_RESERVE_MONTHS)}. Kdo má nejistý nebo jediný
            příjem (podnikání, jeden živitel), ať míří na 6 i víc.
          </p>
        </div>
        <div>
          <span className="block text-sm font-medium text-ink-label mb-1">Kdy bude plná</span>
          <p className="text-lg font-bold text-ink">
            {status.done
              ? 'Už je'
              : Number.isFinite(months)
                ? monthYearIn(months)
                : 'Zatím nikdy'}
          </p>
          {!status.done && Number.isFinite(months) && (
            <p className="mt-1 text-xs text-ink-faint">
              Za {formatMonths(months)} při {czkMonthly(monthlyAllocation)}.
            </p>
          )}
        </div>
      </div>

      {status.done ? (
        <Callout tone="good" className="mt-4">
          Rezerva je hotová. Peníze, které na ni šly, se dají přesměrovat na
          dlouhodobé cíle; částku níže si proto můžete klidně vynulovat.
        </Callout>
      ) : monthlyAllocation <= 0 ? (
        <Callout tone="caution" className="mt-4">
          Na rezervu zatím nic neodkládáte, takže se sama nepostaví. Nastavte
          částku níže, nebo si v Co kdyby zkuste vypnout jinou položku a uvidíte,
          kolik se tím uvolní.
        </Callout>
      ) : null}

      <GoalAllocationField
        label="Kolik měsíčně odkládám na rezervu"
        value={monthlyAllocation}
        onChange={onChangeAllocation}
        hint="Částka se promítne do rozpočtu, do časové osy i do celkového verdiktu. Jakmile je rezerva plná, přestane se počítat."
      />
    </Card>
  );
}
