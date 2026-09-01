import type { PrismaClient } from '@prisma/client';
import { loadPhaseMatchContext } from './phaseMatchIndex.js';
import { buildLeagueParticipationSets } from './leagueRankingMembership.js';
import {
  buildLeagueRankingRows,
  compareBuiltLeagueRankingRows,
  type LeagueRankingRowBuilt,
} from './leagueRankingRowsBuilder.js';

export type BestHistoricalLeagueRank = { position: number; league: number };

function pickSnapshotCandidate(playerId: string, rows: LeagueRankingRowBuilt[]): BestHistoricalLeagueRank | null {
  const candidates: BestHistoricalLeagueRank[] = [];
  for (let L = 1; L <= 6; L++) {
    const list = rows.filter((r) => r.league === L).sort(compareBuiltLeagueRankingRows);
    const idx = list.findIndex((r) => r.playerId === playerId);
    if (idx < 0) continue;
    const row = list[idx]!;
    if (row.played <= 0 && row.wins <= 0 && row.points <= 0) continue;
    candidates.push({ position: idx + 1, league: L });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.league !== b.league ? a.league - b.league : a.position - b.position));
  return candidates[0]!;
}

/** Mejor posición lograda (liga preferida + puesto) entre snapshots al cierre de cada torneo. */
export function pickBetterHistoricalRank(
  prev: BestHistoricalLeagueRank | null,
  next: BestHistoricalLeagueRank,
): BestHistoricalLeagueRank {
  if (!prev) return next;
  if (next.league < prev.league) return next;
  if (next.league > prev.league) return prev;
  return next.position < prev.position ? next : prev;
}

/**
 * Mejor ranking histórico del jugador: se evalúa al cierre de cada torneo (`status = finished`),
 * no con la tabla viva de liga (evita #1 provisional por jugar antes que otros en un torneo en curso).
 */
export async function computeBestHistoricalLeagueRank(
  prisma: PrismaClient,
  playerId: string,
): Promise<BestHistoricalLeagueRank | null> {
  const [ctx, groupPlayers] = await Promise.all([
    loadPhaseMatchContext(prisma),
    prisma.groupPlayer.findMany({
      include: { group: { select: { tournamentId: true } } },
    }),
  ]);

  const participationByLeague = buildLeagueParticipationSets(
    ctx.players,
    ctx.tournamentLeagues,
    ctx.phaseMap,
    groupPlayers,
    ctx.leaguesByTournament,
  );

  const finished = ctx.tournaments
    .filter((t) => t.status === 'finished')
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime() || a.id.localeCompare(b.id, 'es'));

  if (finished.length === 0) return null;

  let best: BestHistoricalLeagueRank | null = null;
  const closedIds = new Set<string>();

  for (const t of finished) {
    closedIds.add(t.id);
    const rows = buildLeagueRankingRows(ctx, participationByLeague, closedIds);
    const snap = pickSnapshotCandidate(playerId, rows);
    if (snap) best = pickBetterHistoricalRank(best, snap);
  }

  return best;
}
