import { describe, expect, it } from 'vitest';
import { resolvePlayerCurrentLeague } from './playerCurrentLeague.js';

describe('resolvePlayerCurrentLeague', () => {
  it('prioriza la liga más alta cuando hay plantel en torneo superior', () => {
    const league = resolvePlayerCurrentLeague({ category: 'Tercera' }, { rosterLeagues: [2, 3] });
    expect(league).toBe(2);
  });

  it('usa categoría si no hay plantel ni ascenso', () => {
    expect(resolvePlayerCurrentLeague({ category: 'Tercera' }, {})).toBe(3);
  });

  it('considera ascenso confirmado por admin', () => {
    expect(resolvePlayerCurrentLeague({ category: 'Tercera' }, { promotionToLeague: 2 })).toBe(2);
  });

  it('considera filas de ranking en ligas superiores', () => {
    expect(
      resolvePlayerCurrentLeague(
        { category: 'Tercera' },
        { rosterLeagues: [3], rankingLeagues: [2], matchLeagues: [3] },
      ),
    ).toBe(2);
  });
});
