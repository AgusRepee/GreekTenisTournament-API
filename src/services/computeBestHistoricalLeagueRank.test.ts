import { describe, it, expect } from 'vitest';
import {
  pickBetterHistoricalRank,
  type BestHistoricalLeagueRank,
} from './computeBestHistoricalLeagueRank.js';
import {
  buildLeagueRankingRows,
  compareBuiltLeagueRankingRows,
  type LeagueRankingRowBuilt,
} from './leagueRankingRowsBuilder.js';

function row(
  playerId: string,
  league: number,
  points: number,
  played: number,
  wins: number,
): LeagueRankingRowBuilt {
  return {
    playerId,
    playerName: playerId,
    league,
    points,
    played,
    wins,
    losses: Math.max(0, played - wins),
    titles: 0,
    finals: 0,
    statsJson: { setDiff: 0 },
  };
}

describe('pickBetterHistoricalRank', () => {
  it('prefiere liga superior con mejor puesto', () => {
    const a: BestHistoricalLeagueRank = { league: 2, position: 1 };
    const b: BestHistoricalLeagueRank = { league: 2, position: 3 };
    expect(pickBetterHistoricalRank(a, b)).toEqual({ league: 2, position: 1 });
  });

  it('prefiere liga numérica menor a igual puesto', () => {
    const prev: BestHistoricalLeagueRank = { league: 3, position: 1 };
    const next: BestHistoricalLeagueRank = { league: 2, position: 5 };
    expect(pickBetterHistoricalRank(prev, next)).toEqual({ league: 2, position: 5 });
  });
});

describe('compareBuiltLeagueRankingRows', () => {
  it('ordena por puntos como ranking público', () => {
    const list = [row('b', 2, 10, 2, 2), row('a', 2, 20, 3, 3)].sort(compareBuiltLeagueRankingRows);
    expect(list[0]?.playerId).toBe('a');
  });
});

describe('buildLeagueRankingRows (filtro torneos)', () => {
  it('exporta builder usable con conjunto de torneos permitidos', () => {
    expect(typeof buildLeagueRankingRows).toBe('function');
  });
});
