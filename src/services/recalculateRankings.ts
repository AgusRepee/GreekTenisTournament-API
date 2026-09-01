import type { Prisma, PrismaClient } from '@prisma/client';
import { loadPhaseMatchContext } from './phaseMatchIndex.js';
import { buildLeagueParticipationSets } from './leagueRankingMembership.js';
import { buildLeagueRankingRows } from './leagueRankingRowsBuilder.js';

const CAT_TO_LEAGUE: Record<string, number> = {
  Primera: 1,
  Segunda: 2,
  Tercera: 3,
  Cuarta: 4,
  'Quinta A': 5,
  Sexta: 6,
  'Quinta B': 6,
};

export function categoryToLeague(cat: string | null | undefined): number {
  if (!cat) return 3;
  return CAT_TO_LEAGUE[cat] ?? 3;
}

const LEAGUE_TO_CAT: Record<number, string> = {
  1: 'Primera',
  2: 'Segunda',
  3: 'Tercera',
  4: 'Cuarta',
  5: 'Quinta A',
  6: 'Sexta',
};

export function leagueToCategory(league: number): string {
  return LEAGUE_TO_CAT[league] ?? 'Tercera';
}

/** Recalcula filas `LeagueRankingRow` y un `RankingSnapshot` agregado. Idempotente. */
export async function recalculateRankings(prisma: PrismaClient): Promise<{ rowsWritten: number }> {
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

  const allowedTournamentIds = new Set(ctx.tournaments.map((t) => t.id));
  const rowsOut = buildLeagueRankingRows(ctx, participationByLeague, allowedTournamentIds);

  await prisma.$transaction(async (tx) => {
    await tx.leagueRankingRow.deleteMany({});
    if (rowsOut.length) {
      await tx.leagueRankingRow.createMany({
        data: rowsOut.map((r) => ({
          playerId: r.playerId,
          league: r.league,
          points: r.points,
          played: r.played,
          wins: r.wins,
          losses: r.losses,
          titles: r.titles,
          finals: r.finals,
          statsJson: r.statsJson as Prisma.InputJsonValue,
        })),
      });
    }
    await tx.rankingSnapshot.create({
      data: {
        leagueNum: 0,
        payload: {
          version: 1,
          computedAt: new Date().toISOString(),
          rowCount: rowsOut.length,
        },
      },
    });
  });

  return { rowsWritten: rowsOut.length };
}
