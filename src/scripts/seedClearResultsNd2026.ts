/**
 * Borra todos los resultados de los 12 torneos ND 2026 y resetea partidos/agenda
 * sin tocar jugadores, grupos ni fixture (Match rows se limpian, no se borran).
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_IDS = [
  't-novak',
  't-novak-l2',
  't-novak-l3',
  't-novak-l4',
  't-novak-l5',
  't-novak-l6',
  't-rafael-nadal-l1',
  't-rafa-nadal',
  't-rafa-nadal-l3',
  't-rafa-nadal-l4',
  't-rafa-nadal-l5',
  't-rafa-nadal-l6',
] as const;

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const deletedResults = await tx.matchResult.deleteMany({
      where: { tournamentId: { in: [...TOURNAMENT_IDS] } },
    });

    const resetMatches = await tx.match.updateMany({
      where: { tournamentId: { in: [...TOURNAMENT_IDS] } },
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
      where: { tournamentId: { in: [...TOURNAMENT_IDS] } },
      data: {
        scheduleStatus: 'unscheduled',
        date: null,
        time: null,
        confirmedAt: null,
      },
    });

    const resetTournaments = await tx.tournament.updateMany({
      where: { id: { in: [...TOURNAMENT_IDS] } },
      data: {
        winnerId: null,
        finalistId: null,
        status: 'upcoming',
      },
    });

    const leagueIds = await tx.tournamentLeague.findMany({
      where: { tournamentId: { in: [...TOURNAMENT_IDS] } },
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
      where: { tournamentId: { in: [...TOURNAMENT_IDS] } },
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

  console.log('[clear-results] MatchResult eliminados:', result.deletedResults);
  console.log('[clear-results] Partidos reseteados:', result.resetMatches);
  console.log('[clear-results] Agenda reseteada:', result.resetSchedules);
  console.log('[clear-results] Cuadros eliminación borrados:', result.deletedBrackets);
  console.log('[clear-results] Rankings recalculados:', rk.rowsWritten, 'filas');

  const remaining = await prisma.matchResult.count({
    where: { tournamentId: { in: [...TOURNAMENT_IDS] } },
  });
  if (remaining > 0) {
    console.warn('[clear-results] AVISO: quedan', remaining, 'resultados en BD');
    process.exitCode = 1;
  } else {
    console.log('[clear-results] OK — 0 resultados en los 12 torneos.');
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
