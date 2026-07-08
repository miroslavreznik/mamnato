// Podrobný rozpis zbytných (discretionary) výdajů do skupin a položek.
// Předdefinované položky mají uživateli hlavně pomoct vzpomenout si, za co platí.
// Inspirováno strukturou poradenské tabulky „Přehled výdajů".

export interface DiscretionaryItemDef {
  key: string; // krátký klíč v rámci skupiny
  label: string;
}

export interface DiscretionaryGroupDef {
  key: string;
  label: string;
  icon: string;
  items: DiscretionaryItemDef[];
}

export const DISCRETIONARY_GROUPS: DiscretionaryGroupDef[] = [
  {
    key: 'leisure',
    label: 'Zábava a volný čas',
    icon: '🎭',
    items: [
      { key: 'dining', label: 'Restaurace a kavárny' },
      { key: 'culture', label: 'Kultura (kino, divadlo, knihy)' },
      { key: 'sport', label: 'Sport a fitness' },
      { key: 'hobbies', label: 'Koníčky' },
    ],
  },
  {
    key: 'subscriptions',
    label: 'Předplatné a služby',
    icon: '📱',
    items: [
      { key: 'streaming', label: 'Streamování (Netflix, Spotify…)' },
      { key: 'apps', label: 'Aplikace a software' },
      { key: 'press', label: 'Noviny a časopisy' },
    ],
  },
  {
    key: 'travel',
    label: 'Dovolená a cestování',
    icon: '✈️',
    items: [
      { key: 'domestic', label: 'Tuzemská rekreace' },
      { key: 'abroad', label: 'Zahraniční rekreace' },
    ],
  },
  {
    key: 'shopping',
    label: 'Nákupy a dárky',
    icon: '🛍️',
    items: [
      { key: 'clothing', label: 'Oblečení a obuv (nad rámec nutnosti)' },
      { key: 'electronics', label: 'Elektronika' },
      { key: 'gifts', label: 'Dárky (svátky, Vánoce, narozeniny)' },
      { key: 'misc', label: 'Ostatní' },
    ],
  },
];

// Plný klíč položky, jak je uložen ve stavu: „skupina.položka".
export function itemKey(groupKey: string, item: string): string {
  return `${groupKey}.${item}`;
}

export interface DiscretionaryGroupTotal {
  key: string;
  label: string;
  icon: string;
  amount: number;
  items: Array<{ key: string; label: string; amount: number }>;
}

// Rozpad podle skupin (vč. nulových) i s položkami a jejich částkami.
export function discretionaryGroupTotals(
  breakdown: Record<string, number> | undefined
): DiscretionaryGroupTotal[] {
  const b = breakdown ?? {};
  return DISCRETIONARY_GROUPS.map((g) => {
    const items = g.items.map((it) => {
      const key = itemKey(g.key, it.key);
      return { key, label: it.label, amount: b[key] ?? 0 };
    });
    return {
      key: g.key,
      label: g.label,
      icon: g.icon,
      amount: items.reduce((s, i) => s + i.amount, 0),
      items,
    };
  });
}

export function discretionaryBreakdownTotal(
  breakdown: Record<string, number> | undefined
): number {
  return Object.values(breakdown ?? {}).reduce((s, v) => s + v, 0);
}

// Je rozpis smysluplně vyplněn (aspoň jedna nenulová položka)?
export function hasDiscretionaryBreakdown(
  breakdown: Record<string, number> | undefined
): boolean {
  return !!breakdown && Object.values(breakdown).some((v) => v > 0);
}
