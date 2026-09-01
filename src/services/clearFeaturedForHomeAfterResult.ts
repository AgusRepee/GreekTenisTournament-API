import type { MatchResultStatus, Prisma } from '@prisma/client';

/** Misma regla que la home: W.O. o jugado/retirado con marcador. */
export function resultClearsFeaturedForHome(status: MatchResultStatus, score: string | null): boolean {
  if (status === 'walkover') return true;
  if (status === 'played' || status === 'retired') return Boolean(score?.trim());
  return false;
}

/** Quita el partido de "importantes" al confirmar un resultado terminal. */
export async function clearFeaturedForHomeAfterResultInTx(
  tx: Prisma.TransactionClient,
  dedupeKey: string,
  status: MatchResultStatus,
  score: string | null,
): Promise<void> {
  if (!resultClearsFeaturedForHome(status, score)) return;
  await tx.tournamentScheduleEntry.updateMany({
    where: { dedupeKey, featuredForHome: true },
    data: { featuredForHome: false },
  });
}
