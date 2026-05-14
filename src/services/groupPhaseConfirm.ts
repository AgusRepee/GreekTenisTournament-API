import type { PrismaClient } from '@prisma/client';

export type ConfirmGroupPayload = {
  directCount?: number;
  repechajeCount?: number;
  eliminatedCount?: number;
  groupCount?: number;
  played?: number;
};

export async function countPendingMatchResultsForTournament(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<number> {
  return prisma.matchResult.count({
    where: { tournamentId, status: 'pending' },
  });
}

export async function validateGroupPhaseConfirm(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pending = await countPendingMatchResultsForTournament(prisma, tournamentId);
  if (pending > 0) {
    return {
      ok: false,
      error: `Hay ${pending} resultado(s) en estado pendiente. Completá o guardá todos los partidos de grupos antes de confirmar.`,
    };
  }
  return { ok: true };
}

export async function loadEliminationWarningForReopen(
  prisma: PrismaClient,
  tournamentLeagueId: string,
): Promise<string | undefined> {
  const league = await prisma.tournamentLeague.findUnique({
    where: { id: tournamentLeagueId },
    include: { elimination: true },
  });
  if (!league) return undefined;
  if (league.eliminationStatus === 'confirmed' || league.eliminationStatus === 'in_progress') {
    return 'La eliminación ya fue confirmada o está en curso. Si reabrís grupos, revisá el cuadro y los partidos KO.';
  }
  if (league.eliminationStatus === 'draft' || league.elimination?.status === 'draft') {
    return 'Hay un cuadro de eliminación en borrador. Si cambiás resultados de grupos, volvé a validar cruces antes de confirmar KO.';
  }
  if (league.elimination?.status === 'confirmed') {
    return 'Existe un cuadro de eliminación confirmado en base de datos.';
  }
  return undefined;
}
