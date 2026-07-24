import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Dlouhá pomlčka „—" se v češtině běžně nepoužívá a v textech působí strojově.
// Místo ní patří čárka, dvojtečka, tečka nebo závorka. Tenhle test hlídá, aby
// se do zdrojáků nevrátila.
//
// Pozor na rozdíl: „–" (en dash) je v pořádku a používá se v rozsazích
// jako „3–6 měsíců" nebo „80–90 % LTV".
const EM_DASH = '—';

function collectFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full, exts));
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

describe('texty bez dlouhé pomlčky', () => {
  it('nikde ve zdrojácích ani v index.html není znak —', () => {
    const files = [...collectFiles('src', ['.ts', '.tsx', '.css']), 'index.html'];

    const offenders = files.flatMap((file) => {
      const lines = readFileSync(file, 'utf-8').split('\n');
      return lines
        .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
        .filter((l) => l.text.includes(EM_DASH));
    });

    expect(
      offenders.map((o) => `${o.file}:${o.line} → ${o.text.slice(0, 80)}`)
    ).toEqual([]);
  });
});
