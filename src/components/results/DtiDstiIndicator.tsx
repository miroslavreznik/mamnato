import type { WizardState } from '../../types';
import { dti, dsti } from '../../engine/mortgage';
import { DEFAULTS } from '../../engine/defaults';
import { decimal, percentCompact } from '../../engine/format';
import Tooltip from '../ui/Tooltip';
import Card from '../ui/Card';
import Callout from '../ui/Callout';
import Disclosure from '../ui/Disclosure';

interface Props {
  state: WizardState;
}

function trafficLight(value: number, limit: number): 'green' | 'yellow' | 'red' {
  if (value > limit) return 'red';
  if (value > limit * 0.8) return 'yellow';
  return 'green';
}

const colorClasses = {
  green: 'bg-tint-good text-good border-line',
  yellow: 'bg-tint-caution text-caution border-line',
  red: 'bg-tint-danger text-danger border-line',
};

const dotClasses = {
  green: 'bg-good',
  yellow: 'bg-caution',
  red: 'bg-danger',
};

export default function DtiDstiIndicator({ state }: Props) {
  const dtiVal = dti(state);
  const dstiVal = dsti(state);
  const dtiColor = trafficLight(dtiVal, DEFAULTS.dtiCaution);
  const dstiColor = trafficLight(dstiVal, DEFAULTS.dstiCaution);
  const needsCaution = dtiColor === 'red' || dstiColor === 'red';

  return (
    <Card title="Ukazatele zadluženosti (DTI a DSTI)">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`p-4 rounded-lg border ${colorClasses[dtiColor]}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-3 h-3 rounded-full ${dotClasses[dtiColor]}`} />
            <span className="font-semibold">DTI</span>
            <Tooltip text="DTI říká, kolikrát celkový dluh převyšuje váš čistý roční příjem. Nad hodnotou 8 doporučuje ČNB bankám zvýšenou obezřetnost; nejde o automatické zamítnutí." />
          </div>
          <div className="text-xl sm:text-2xl font-bold whitespace-nowrap">{dtiVal === Infinity ? '∞' : decimal(dtiVal)}×</div>
          <div className="text-xs mt-1">Zvýšená obezřetnost nad {DEFAULTS.dtiCaution}×</div>
        </div>

        <div className={`p-4 rounded-lg border ${colorClasses[dstiColor]}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-3 h-3 rounded-full ${dotClasses[dstiColor]}`} />
            <span className="font-semibold">DSTI</span>
            <Tooltip text="DSTI říká, jaký podíl čistého příjmu tvoří splátky všech úvěrů. Nad 40 % doporučuje ČNB bankám zvýšenou obezřetnost; nejde o závazný limit." />
          </div>
          <div className="text-2xl font-bold">{dstiVal === Infinity ? '∞' : decimal(dstiVal * 100)} %</div>
          <div className="text-xs mt-1">Zvýšená obezřetnost nad {percentCompact(DEFAULTS.dstiCaution)}</div>
        </div>
      </div>

      {needsCaution && (
        <div className="mt-4">
          <Callout tone="danger" border alert>
            Ukazatele jsou v pásmu, které banky posuzují opatrněji. Výsledek není automatické zamítnutí, banka zohlední také stabilitu příjmů, další závazky, rezervy a hodnotu nemovitosti.
          </Callout>
        </div>
      )}

      <Disclosure summary="Co je závazné a co jen zvyklost" className="mt-2">
        <p className="text-xs text-ink-faint pb-1">
        Závazný je dnes už jen limit LTV (výše hypotéky vůči ceně): max. 80 %, u žadatelů mladších 36 let 90 %. Horní limity DTI a DSTI ČNB závazně nevyžaduje; nad DTI 8 a DSTI 40 % ale doporučuje bankám zvýšenou obezřetnost.
      </p>
      </Disclosure>
    </Card>
  );
}
