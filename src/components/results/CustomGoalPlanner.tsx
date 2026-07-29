import { useState, useMemo, useEffect } from 'react';
import type { WizardState, CustomGoal } from '../../types';
import type { GoalAllocations } from '../../engine/allocation';
import { goalProgress } from '../../engine/savings';
import { budgetNow } from '../../engine/budget';
import { czk, czkMonthly, czkPerMonth, formatMonths } from '../../engine/format';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useChartColors, gridProps, axisProps } from './chartTheme';
import NumField from '../ui/NumField';
import { StepButton } from './property/shared';
import Card from '../ui/Card';
import Callout from '../ui/Callout';
import StatusBadge from '../ui/StatusBadge';
import { fieldClass } from '../ui/fieldClass';

/**
 * Vlastní finanční cíle: kolik na každý měsíčně dávám a jestli to stačí.
 *
 * **Cíl je měsíční částka jako každý jiný výdaj.** Dává se z volných peněz,
 * ubírá je ostatním cílům a otázka zní jediná: vyjde s ní zadaný termín?
 *
 * Dřív tu byla dvě pojetí naráz. Pole „kolik na tento cíl měsíčně dávám"
 * hlásilo jedno číslo, a hned pod ním stálo druhé, protože stav počítal
 * `allocateGoals(cíle, disponibilní částka)`, což pole ignorovalo a rozdělilo
 * peníze podle pořadí cílů. Na obrazovce tak stálo „dávám 14 667 Kč"
 * a „na tento cíl odkládáte 33 334 Kč". Engine navíc rozděloval jiný balík
 * než karta, takže si verdikt nahoře a karta mohly odporovat.
 *
 * S tím zmizely i priority. Šipky a čísla „#1, #2" existovaly jen kvůli
 * tomu rozdělování; pořadí teď na nic nemá vliv a ovládací prvek, který nic
 * nedělá, je horší než žádný.
 *
 * **Odložit nebo zrušit cíl se dá v Co kdyby.** Dřív to byl místní stav
 * téhle karty, takže odložení nezměnilo ani verdikt, ani rozpočet: jen
 * zešedla karta. Teď je to vypnutá položka jako každá jiná.
 */

interface Props {
  state: WizardState;
  onChangeGoals: (goals: CustomGoal[]) => void;
  allocations: GoalAllocations;
  onChangeAllocation: (index: number, value: number) => void;
}

const STEP = 500;

let nextId = 1;
function makeId() {
  return `goal-${Date.now()}-${nextId++}`;
}

function newGoal(): CustomGoal {
  return { id: makeId(), name: '', targetAmount: 500000, targetMonths: 24 };
}

function recommendInstrument(months: number) {
  if (months <= 12) return 'Spořicí účet';
  if (months <= 60) return 'Spořicí účet nebo konzervativní dluhopisy';
  return 'Akciový index (SP500 / globální)';
}

/**
 * Kolik na cíl měsíčně dávám.
 *
 * Horní mez je vlastní částka plus to, co je zrovna volné: víc než volné
 * peníze rozdat nejde, a kdyby to šlo, rozpočet by tiše spadl do mínusu
 * a appka by přitom tvrdila, že cíl vychází. Když je volných nula, jde
 * částka jen dolů, dokud se neubere jinde. To je celá odpověď na otázku
 * „mám na to": buď se to do volných peněz vejde, nebo ne.
 */
function AllocationSlider({ value, free, onChange }: {
  value: number;
  free: number;
  onChange: (v: number) => void;
}) {
  const max = Math.max(value, value + free);
  return (
    <div className="mt-4 pt-4 border-t border-line max-w-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
        {/* Popisek nemá `htmlFor`: posuvník si nese vlastní `aria-label`,
            protože ho čte i klávesnice a dotykové čtečky. */}
        <span className="text-sm font-medium text-ink-label">Kolik na tento cíl měsíčně dávám</span>
        <span data-testid="goal-allocation" className="text-sm font-semibold text-ink tabular-nums">
          {czkPerMonth(value)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <StepButton onClick={() => onChange(Math.max(0, value - STEP))} disabled={value <= 0} label="Ubrat z cíle">
          −
        </StepButton>
        <input
          type="range"
          min={0}
          max={Math.max(STEP, max)}
          step={STEP}
          value={Math.min(value, Math.max(STEP, max))}
          aria-label="Kolik na tento cíl měsíčně dávám"
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 min-w-0 h-1.5 rounded-full appearance-none cursor-pointer accent-brand bg-line"
        />
        <StepButton
          onClick={() => onChange(Math.min(max, value + STEP))}
          disabled={free < STEP}
          label="Přidat na cíl"
        >
          +
        </StepButton>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        {free > 0
          ? `Volných zbývá ${czkMonthly(free)}, o tolik se dá ještě přidat.`
          : 'Volné peníze jsou rozdané. Přidat jde jen tím, že jinde uberete.'}
      </p>
    </div>
  );
}

export default function CustomGoalPlanner({ state, onChangeGoals, allocations, onChangeAllocation }: Props) {
  const colors = useChartColors();
  const goals = useMemo(() => state.customGoals ?? [], [state.customGoals]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Kdyby uživatel dorazil bez zadaného cíle, nabídneme jeden prázdný.
  useEffect(() => {
    if (goals.length === 0) onChangeGoals([newGoal()]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rozpočet počítá se všemi cíli, ne jen s vlastními: akontace a důchod
  // ukusují ze stejných peněz, takže „volné" musí být volné doopravdy.
  const budget = budgetNow(state, allocations);
  const free = Math.max(0, budget.surplus);

  const progress = useMemo(
    () => goals.map((g, i) => goalProgress(g, allocations.custom[i] ?? 0)),
    [goals, allocations.custom]
  );

  // Odpověď za všechny cíle najednou: kolik by dohromady potřebovaly a kolik
  // je na ně k dispozici, tedy co už na nich leží plus to, co je volné.
  const needed = progress.reduce((s, p) => s + (Number.isFinite(p.requiredMonthly) ? p.requiredMonthly : 0), 0);
  const onCustom = allocations.custom.reduce((s, v) => s + v, 0);
  const available = onCustom + free;
  const allFit = progress.every((p) => p.achievable);

  const updateGoal = (id: string, field: keyof CustomGoal, value: string | number) => {
    onChangeGoals(goals.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  };

  const removeGoal = (id: string) => {
    if (goals.length > 1) onChangeGoals(goals.filter((g) => g.id !== id));
  };

  return (
    <Card>
      <h3 className="type-section text-ink mb-2">Vlastní finanční cíle</h3>
      <p className="text-sm text-ink-muted mb-4">
        Na každý cíl dáváte část volných peněz. Uvidíte hned, jestli s tou
        částkou stihnete termín, který jste zadali.
      </p>

      <div className="p-4 rounded-xl border border-line bg-sunken mb-4">
        {/* Na mobilu pod sebe. Ve třech sloupcích na 390 px se lámalo
            i „50 000 Kč/měs." a z panelu byla kaše. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
          <div className="flex justify-between sm:block">
            <span className="text-ink-muted">Zbývá po výdajích</span>
            <p className="font-semibold text-ink">{czkPerMonth(budget.disposable)}</p>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-ink-muted">Rozdáno na cíle</span>
            <p className="font-semibold text-ink">{czkPerMonth(budget.allocated)}</p>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-ink-muted">Volných zbývá</span>
            <p className={`font-semibold ${budget.surplus >= 0 ? 'text-good' : 'text-danger'}`}>
              {czkPerMonth(budget.surplus)}
            </p>
          </div>
        </div>

        {goals.length > 0 && (
          <Callout tone={allFit ? 'good' : needed <= available ? 'caution' : 'danger'} className="mt-3">
            {allFit ? (
              <>Na všechny vlastní cíle v zadaných termínech máte.</>
            ) : needed <= available ? (
              <>
                Na všechny cíle byste měli, jen jsou peníze zatím rozdělené jinak.
                Dohromady potřebují <strong>{czkMonthly(needed)}</strong> a k dispozici je{' '}
                <strong>{czk(available)}</strong>. Přidejte u cílů níže.
              </>
            ) : (
              <>
                Na všechny cíle v zadaných termínech nemáte. Dohromady by potřebovaly{' '}
                <strong>{czkMonthly(needed)}</strong>, k dispozici je <strong>{czk(available)}</strong>.
                Chybí <strong>{czk(needed - available)}</strong>. Pomůže delší termín, nižší
                částka, nebo některý cíl odložit v Co kdyby.
              </>
            )}
          </Callout>
        )}
      </div>

      <div className="space-y-6">
        {goals.map((goal, index) => {
          const given = allocations.custom[index] ?? 0;
          const p = progress[index];
          const chartMonths = given > 0 ? Math.min(p.monthsNeeded, 360) : 0;

          return (
            <div key={goal.id} className="border border-line rounded-xl p-4">
              <div className="flex justify-between items-start gap-2 mb-3">
                <StatusBadge
                  status={p.achievable ? 'good' : given > 0 ? 'caution' : 'danger'}
                  label={p.achievable ? 'Vyjde v termínu' : given > 0 ? 'Potřebuje víc času' : 'Zatím nic neodkládáte'}
                />
                {goals.length > 1 && (
                  <button onClick={() => removeGoal(goal.id)} className="text-danger hover:underline text-sm shrink-0">
                    Odebrat
                  </button>
                )}
              </div>

              {/* Stejné rozvržení jako v průvodci: název přes celou šířku,
                  částka a doba pod ním. Ve třech sloupcích se do polí
                  s krokovacími tlačítky nevešla šestimístná částka.
                  `max-w-2xl` proto, že karta cílů je na záložce sama a zabírá
                  celou šířku; bez něj bylo pole na název cíle přes tisíc
                  pixelů široké. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-ink-muted mb-1">Název cíle</label>
                  {/* Popisky nad poli nemají `htmlFor`, takže samy o sobě
                      pole nepojmenují. Číselná pole si jméno nesou v `ariaLabel`,
                      tohle textové ho nemělo žádné a čtečka i test ho našly
                      jen podle nápovědy v placeholderu. */}
                  <input
                    type="text"
                    value={goal.name}
                    onChange={(e) => updateGoal(goal.id, 'name', e.target.value)}
                    placeholder="např. Auto, dovolená…"
                    aria-label="Název cíle"
                    className={fieldClass('w-full px-3 py-2.5 text-base')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Cílová částka (Kč)</label>
                  <NumField
                    value={goal.targetAmount}
                    onChange={(v) => updateGoal(goal.id, 'targetAmount', v)}
                    ariaLabel="Cílová částka"
                    step={10000}
                    className={fieldClass('w-full px-3 py-2.5 text-base')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Za kolik měsíců</label>
                  <NumField
                    value={goal.targetMonths}
                    onChange={(v) => updateGoal(goal.id, 'targetMonths', v)}
                    min={1}
                    ariaLabel="Za kolik měsíců"
                    step={1}
                    className={fieldClass('w-full px-3 py-2.5 text-base')}
                  />
                </div>
              </div>

              <AllocationSlider
                value={given}
                free={free}
                onChange={(v) => onChangeAllocation(index, v)}
              />

              {/* Zarovnáno na stejnou šířku jako pole nad tím. Bez toho
                  končila pole v půlce karty a věty pod nimi až u pravého
                  okraje. */}
              <div className="mt-4 space-y-2 max-w-2xl">
                {/* Bez termínu se potřebná částka spočítat nedá. Pole má
                    minimum jedna, takže je to spíš pojistka než stav, který
                    uživatel uvidí. */}
                {Number.isFinite(p.requiredMonthly) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-body">Aby termín vyšel, potřebuje:</span>
                    <span className="font-semibold text-ink">{czkPerMonth(p.requiredMonthly)}</span>
                  </div>
                )}

                {p.achievable ? (
                  <Callout tone="good" pad="p-2 rounded-lg">
                    S {czkMonthly(given)} na cíl dosáhnete za {formatMonths(p.monthsNeeded)},
                    tedy v termínu.
                  </Callout>
                ) : given > 0 ? (
                  <Callout tone="caution" pad="p-2 rounded-lg">
                    S {czkMonthly(given)} na cíl dosáhnete za {formatMonths(p.monthsNeeded)}.
                    Zadaný termín je {formatMonths(goal.targetMonths)}, takže do něj chybí{' '}
                    <strong>{czkMonthly(p.missingMonthly)}</strong>.
                  </Callout>
                ) : (
                  <Callout tone="danger" pad="p-2 rounded-lg">
                    Na tenhle cíl zatím nedáváte nic, takže se sám nenaspoří.
                  </Callout>
                )}

                {!p.achievable && (
                  <div>
                    <button
                      onClick={() => setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(goal.id)) next.delete(goal.id); else next.add(goal.id);
                        return next;
                      })}
                      className="text-sm text-brand hover:underline"
                    >
                      {expanded.has(goal.id) ? 'Skrýt doporučení' : 'Co s tím?'}
                    </button>
                    {expanded.has(goal.id) && (
                      <Callout tone="brand" className="mt-2 space-y-1.5">
                        {free >= STEP && (
                          <p className="text-brand">
                            <strong>Přidejte z volných peněz:</strong> volných je {czkMonthly(free)}
                            {p.missingMonthly > 0 && p.missingMonthly <= free
                              ? ', na termín by to stačilo.'
                              : '.'}
                          </p>
                        )}
                        {given > 0 && Number.isFinite(p.monthsNeeded) && (
                          <p className="text-brand">
                            <strong>Prodlužte termín:</strong> s dnešní částkou by cíl vyšel
                            za {formatMonths(p.monthsNeeded)}, zadáno máte {formatMonths(goal.targetMonths)}.
                          </p>
                        )}
                        {p.reachableAmount > 0 && (
                          <p className="text-brand">
                            <strong>Snižte cílovou částku:</strong> do termínu naspoříte{' '}
                            {czk(p.reachableAmount)}.
                          </p>
                        )}
                        <p className="text-brand">
                          <strong>Odložte cíl:</strong> v záložce Co kdyby ho jde vypnout
                          z plánu a uvidíte, co to uvolní ostatním.
                        </p>
                      </Callout>
                    )}
                  </div>
                )}

                <div className="text-sm text-ink-body">
                  Doporučený nástroj: <span className="font-medium text-ink">{recommendInstrument(goal.targetMonths)}</span>
                </div>
              </div>

              {chartMonths > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={Array.from({ length: chartMonths + 1 }, (_, m) => ({ month: m, savings: given * m }))} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
                    <defs>
                      <linearGradient id={`goal-grad-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridProps(colors)} />
                    <XAxis dataKey="month" {...axisProps(colors)} label={{ value: 'Měsíce', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }} />
                    <YAxis tickFormatter={(n) => `${(n / 1000).toFixed(0)}k`} {...axisProps(colors)} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toLocaleString('cs-CZ')} Kč`]}
                      labelFormatter={(label) => `Měsíc ${label}`}
                      contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
                    />
                    <Area type="monotone" dataKey="savings" stroke={colors.primary} strokeWidth={2} fill={`url(#goal-grad-${goal.id})`} dot={false} name="Úspory" />
                    <ReferenceLine y={goal.targetAmount} stroke={colors.negative} strokeDasharray="5 5" label={{ value: 'Cíl', position: 'insideTopRight', fill: colors.negative, fontSize: 12 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onChangeGoals([...goals, newGoal()])}
        className="mt-4 px-4 py-2 text-sm text-brand border border-line rounded-lg hover:bg-tint-brand min-h-[44px]"
      >
        + Přidat další cíl
      </button>
    </Card>
  );
}
