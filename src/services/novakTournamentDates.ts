import type { Prisma, PrismaClient } from '@prisma/client';

export const NOVAK_ND2026_START_ISO = '2026-03-14';
export const NOVAK_ND2026_START = new Date(`${NOVAK_ND2026_START_ISO}T00:00:00.000Z`);

export const NOVAK_TOURNAMENT_IDS = [
  't-novak',
  't-novak-l2',
  't-novak-l3',
  't-novak-l4',
  't-novak-l5',
  't-novak-l6',
] as const;

type Db = PrismaClient | Prisma.TransactionClient;

/** Fecha de la final jugada (programada o `playedAt` del resultado). */
export async function resolveTournamentEndDateFromFinal(
  db: Db,
  tournamentId: string,
): Promise<Date | null> {
  const finalMatch = await db.match.findFirst({
    where: {
      tournamentId,
      OR: [{ stage: 'final' }, { id: { endsWith: '-fn-0' } }],
    },
  });
  if (!finalMatch?.completed) return null;

  if (finalMatch.scheduledDate) return finalMatch.scheduledDate;

  const mr = await db.matchResult.findFirst({
    where: {
      matchId: finalMatch.id,
      status: { in: ['played', 'walkover', 'retired'] },
    },
    orderBy: { playedAt: 'desc' },
  });
  return mr?.playedAt ?? null;
}

/** Novak L1–L6: inicio fijo 14/03/2026; fin = final jugada o inicio si aún no hay final. */
export async function syncNovakTournamentDates(db: Db): Promise<Array<{ id: string; end: string }>> {
  const out: Array<{ id: string; end: string }> = [];
  for (const id of NOVAK_TOURNAMENT_IDS) {
    const endFromFinal = await resolveTournamentEndDateFromFinal(db, id);
    const endDate = endFromFinal ?? NOVAK_ND2026_START;
    await db.tournament.update({
      where: { id },
      data: { startDate: NOVAK_ND2026_START, endDate },
    });
    out.push({ id, end: endDate.toISOString().slice(0, 10) });
  }
  return out;
}
