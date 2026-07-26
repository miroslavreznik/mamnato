// Přepnutí klíče v množině vypnutých položek. Vlastní soubor proto, že
// mezi komponentami se smí sdílet jen komponenty (jinak přestane fungovat
// Fast Refresh).
export function toggle(prev: Set<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}
