import { describe, expect, it } from 'vitest';
import { parseKoPlayedScoreDetail } from './koScoreParse.js';

describe('parseKoPlayedScoreDetail', () => {
  it('victoria cuenta sets', () => {
    const r = parseKoPlayedScoreDetail('6-4 6-3', false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.winner).toBe('A');
    expect(r.setsWonA).toBe(2);
    expect(r.setsWonB).toBe(0);
  });

  it('W.O. no aplica aquí (usa flujo MatchResult walkover)', () => {
    /* walkover se resuelve fuera con score A/B */
    const r = parseKoPlayedScoreDetail('', false);
    expect(r.ok).toBe(false);
  });
});
