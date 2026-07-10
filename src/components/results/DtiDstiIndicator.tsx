import type { WizardState } from '../../types';
import { dti, dsti } from '../../engine/mortgage';
import { DEFAULTS } from '../../engine/defaults';
import Tooltip from '../ui/Tooltip';
import Alert from '../ui/Alert';

interface Props {
  state: WizardState;
}

function trafficLight(value: number, limit: number): 'green' | 'yellow' | 'red' {
  if (value > limit) return 'red';
  if (value > limit * 0.8) return 'yellow';
  return 'green';
}

const colorClasses = {
  green: 'bg-green-100 text-green-800 border-green-300',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  red: 'bg-red-100 text-red-800 border-red-300',
};

const dotClasses = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

export default function DtiDstiIndicator({ state }: Props) {
  const dtiVal = dti(state);
  const dstiVal = dsti(state);
  const dtiColor = trafficLight(dtiVal, DEFAULTS.dtiLimit);
  const dstiColor = trafficLight(dstiVal, DEFAULTS.dstiLimit);
  const overLimit = dtiColor === 'red' || dstiColor === 'red';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ukazatele zadluženosti (DTI a DSTI)</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`p-4 rounded-lg border ${colorClasses[dtiColor]}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-3 h-3 rounded-full ${dotClasses[dtiColor]}`} />
            <span className="font-semibold">DTI</span>
            <Tooltip text="DTI říká, kolikrát váš roční příjem pokryje celkový dluh (nová hypotéka i zůstatek stávajících úvěrů). Závazný horní limit ČNB od ledna 2024 nevyžaduje; banky ho ale běžně posuzují, obvykle kolem 8,5×." />
          </div>
          <div className="text-2xl font-bold">{dtiVal === Infinity ? '∞' : dtiVal.toFixed(1)}×</div>
          <div className="text-xs mt-1">Orientační limit bank: {DEFAULTS.dtiLimit}×</div>
        </div>

        <div className={`p-4 rounded-lg border ${colorClasses[dstiColor]}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-3 h-3 rounded-full ${dotClasses[dstiColor]}`} />
            <span className="font-semibold">DSTI</span>
            <Tooltip text="DSTI říká, jaký podíl příjmu tvoří splátky všech úvěrů. Závazný horní limit ČNB od července 2023 nevyžaduje; banky ho ale běžně posuzují, obvykle kolem 45 %." />
          </div>
          <div className="text-2xl font-bold">{dstiVal === Infinity ? '∞' : (dstiVal * 100).toFixed(1)} %</div>
          <div className="text-xs mt-1">Orientační limit bank: {(DEFAULTS.dstiLimit * 100).toFixed(0)} %</div>
        </div>
      </div>

      {overLimit && (
        <div className="mt-4">
          <Alert type="error">
            Vaše zadluženost překračuje běžná bankovní vodítka. Banka může hypotéku odmítnout nebo nabídnout horší podmínky.
          </Alert>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        Závazný je dnes už jen limit LTV (výše hypotéky vůči ceně): max 80 %, u žadatelů do 36 let 90 %. Horní limity DTI a DSTI ČNB závazně nevyžaduje — banky je ale posuzují jako interní vodítko.
      </p>
    </div>
  );
}
