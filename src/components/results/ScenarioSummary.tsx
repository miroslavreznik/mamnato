import type { Scenario } from '../../engine/scenarios';

interface Props {
  scenario: Scenario;
}

export default function ScenarioSummary({ scenario }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-3xl">{scenario.icon}</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{scenario.title}</h3>
        </div>
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
        {scenario.description}
      </p>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Co můžete udělat:</h4>
        <ul className="space-y-2">
          {scenario.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">&#x2022;</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
