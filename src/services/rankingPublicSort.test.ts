import { describe, expect, it } from 'vitest';
import type { LeagueRankingRow, Player } from '@prisma/client';
import { comparePublicRankingRows, statsJsonSetDiff, type RankingRowWithPlayer } from './rankingPublicSort.js';

function row(
  partial: Partial<LeagueRankingRow> & { player: Pick<Player, 'id' | 'name' | 'category' | 'profileImage'> },
): RankingRowWithPlayer {
  return {
    id: 'x',
    playerId: partial.playerId ?? partial.player.id,
    league: partial.league ?? 1,
    points: partial.points ?? 0,
    played: partial.played ?? 0,
    wins: partial.wins ?? 0,
    losses: partial.losses ?? 0,
    titles: partial.titles ?? 0,
    finals: partial.finals ?? 0,
    statsJson: partial.statsJson ?? null,
    updatedAt: new Date(),
    player: partial.player,
  };
}

describe('statsJsonSetDiff', () => {
  it('usa setDiff si existe', () => {
    expect(statsJsonSetDiff({ setDiff: 3 })).toBe(3);
  });
  it('calcula desde setsWon/Lost', () => {
    expect(statsJsonSetDiff({ setsWon: 4, setsLost: 1 })).toBe(3);
  });
});

describe('comparePublicRankingRows', () => {
  const pa = { id: 'a', name: 'Ana', category: 'Primera', profileImage: null };
  const pb = { id: 'b', name: 'Bea', category: 'Primera', profileImage: null };

  it('ordena por puntos', () => {
    const a = row({ points: 10, player: pa });
    const b = row({ points: 20, player: pb });
    expect(comparePublicRankingRows(a, b)).toBeGreaterThan(0);
  });

  it('desempata por títulos', () => {
    const a = row({ points: 100, titles: 2, player: pa });
    const b = row({ points: 100, titles: 3, player: pb });
    expect(comparePublicRankingRows(a, b)).toBeGreaterThan(0);
  });

  it('desempata por diferencia de sets', () => {
    const a = row({
      points: 50,
      titles: 0,
      finals: 0,
      wins: 5,
      player: pa,
      statsJson: { setsWon: 10, setsLost: 8 },
    });
    const b = row({
      points: 50,
      titles: 0,
      finals: 0,
      wins: 5,
      player: pb,
      statsJson: { setsWon: 12, setsLost: 8 },
    });
    expect(comparePublicRankingRows(a, b)).toBeGreaterThan(0);
  });
});
