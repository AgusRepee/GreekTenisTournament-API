import type { LeagueRankingRow, Player } from '@prisma/client';

export type RankingRowWithPlayer = LeagueRankingRow & {
  player: Pick<Player, 'id' | 'name' | 'category' | 'profileImage'>;
};

export function statsJsonSetDiff(statsJson: unknown): number {
  if (!statsJson || typeof statsJson !== 'object' || Array.isArray(statsJson)) return 0;
  const o = statsJson as Record<string, unknown>;
  if (typeof o.setDiff === 'number') return o.setDiff;
  const sw = typeof o.setsWon === 'number' ? o.setsWon : 0;
  const sl = typeof o.setsLost === 'number' ? o.setsLost : 0;
  return sw - sl;
}

/** Orden público: puntos → títulos → finales → PG → diferencia de sets → nombre. */
export function comparePublicRankingRows(a: RankingRowWithPlayer, b: RankingRowWithPlayer): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.titles !== a.titles) return b.titles - a.titles;
  if (b.finals !== a.finals) return b.finals - a.finals;
  if (b.wins !== a.wins) return b.wins - a.wins;
  const sd = statsJsonSetDiff(b.statsJson) - statsJsonSetDiff(a.statsJson);
  if (sd !== 0) return sd;
  return a.player.name.localeCompare(b.player.name, 'es');
}
