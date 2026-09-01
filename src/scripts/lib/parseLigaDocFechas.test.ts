import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixturesFromLigaDoc, parseVsLine, type LigaDocJson } from './parseLigaDocFechas.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

function load(name: string): LigaDocJson {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf8')) as LigaDocJson;
}

describe('parseLigaDocFechas', () => {
  it('parsea línea con pelotas en jugador A', () => {
    expect(parseVsLine('Lacave L. (P) vs Monzón M.')).toEqual({
      playerA: 'Lacave L.',
      playerB: 'Monzón M.',
      ballPlayer: 'Lacave L.',
    });
  });

  it('genera 30 partidos de grupos para Novak Liga 2', () => {
    const fixtures = fixturesFromLigaDoc(load('novak-liga2.json'));
    expect(fixtures).toHaveLength(30);
    expect(fixtures.every((f) => f.round >= 1 && f.round <= 5)).toBe(true);
  });

  it('incluye interzonal en Novak Liga 4', () => {
    const fixtures = fixturesFromLigaDoc(load('novak-liga4.json'));
    expect(fixtures.filter((f) => f.group.includes('Interzonal'))).toHaveLength(6);
    expect(fixtures).toHaveLength(24);
  });
});
