/**
 * Borra resultados, agenda y cuadros KO de los 6 torneos Novak Djokovic.
 * No toca torneos Rafael Nadal.
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const NOVAK_TOURNAMENT_IDS = [
  't-novak',
  't-novak-l2',
  't-novak-l3',
  't-novak-l4',
  't-novak-l5',
  't-novak-l6',
] as const;

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const deletedResults = await tx.matchResult.deleteMany({
      where: { tournamentId: { in: [...NOVAK_TOURNAMENT_IDS] } },
    });

    const resetMatches = await tx.match.updateMany({
      where: { tournamentId: { in: [...NOVAK_TOURNAMENT_IDS] } },
      data: {
        winnerId: null,
        loserId: null,
        score: '',
        completed: false,
        scheduleStatus: 'unscheduled',
        scheduledDate: null,
        scheduledTime: null,
      },
    });

    const resetSchedules = await tx.tournamentScheduleEntry.updateMany({
      where: { tournamentId: { in: [...NOVAK_TOURNAMENT_IDS] } },
      data: {
        scheduleStatus: 'unscheduled',
        date: null,
        time: null,
        confirmedAt: null,
      },
    });

    const resetTournaments = await tx.tournament.updateMany({
      where: { id: { in: [...NOVAK_TOURNAMENT_IDS] } },
      data: {
        winnerId: null,
        finalistId: null,
        status: 'upcoming',
      },
    });

    const leagueIds = await tx.tournamentLeague.findMany({
      where: { tournamentId: { in: [...NOVAK_TOURNAMENT_IDS] } },
      select: { id: true },
    });
    const leagueIdList = leagueIds.map((r) => r.id);
    const deletedBrackets =
      leagueIdList.length > 0
        ? await tx.eliminationBracket.deleteMany({
            where: { tournamentLeagueId: { in: leagueIdList } },
          })
        : { count: 0 };

    await tx.tournamentLeague.updateMany({
      where: { tournamentId: { in: [...NOVAK_TOURNAMENT_IDS] } },
      data: {
        groupStageStatus: 'open',
        eliminationStatus: null,
      },
    });

    return {
      deletedResults: deletedResults.count,
      resetMatches: resetMatches.count,
      resetSchedules: resetSchedules.count,
      resetTournaments: resetTournaments.count,
      deletedBrackets: deletedBrackets.count,
    };
  });

  const rk = await recalculateRankings(prisma);

  console.log('[clear-novak] MatchResult eliminados:', result.deletedResults);
  console.log('[clear-novak] Partidos reseteados:', result.resetMatches);
  console.log('[clear-novak] Agenda reseteada:', result.resetSchedules);
  console.log('[clear-novak] Cuadros eliminación borrados:', result.deletedBrackets);
  console.log('[clear-novak] Rankings recalculados:', rk.rowsWritten, 'filas');

  const remaining = await prisma.matchResult.count({
    where: { tournamentId: { in: [...NOVAK_TOURNAMENT_IDS] } },
  });
  if (remaining > 0) {
    console.warn('[clear-novak] AVISO: quedan', remaining, 'resultados Novak en BD');
    process.exitCode = 1;
  } else {
    console.log('[clear-novak] OK — 0 resultados en torneos Novak.');
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
