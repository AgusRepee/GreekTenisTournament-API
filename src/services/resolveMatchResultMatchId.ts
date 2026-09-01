import type { Prisma } from '@prisma/client';

/**
 * El frontend usa `matchId` localmente como clave dedupe (`t-…|5|B|…`).
 * En Prisma, `MatchResult.matchId` es FK opcional a `Match.id` (p. ej. `ko-t-…-sf-0`).
 */
export function sanitizeMatchResultMatchIdCandidate(
  candidate: string | undefined | null,
  dedupeKey: string,
): string | undefined {
  const mid = candidate?.trim();
  if (!mid) return undefined;
  if (mid === dedupeKey.trim()) return undefined;
  if (mid.includes('|')) return undefined;
  return mid;
}

function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .trim()
    .toLowerCase();
}

function buildNameToId(players: { id: string; name: string; displayName: string | null }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of players) {
    m.set(normName(p.name), p.id);
    if (p.displayName?.trim()) m.set(normName(p.displayName), p.id);
    m.set(p.id.toLowerCase(), p.id);
  }
  return m;
}

/** Resuelve `Match.id` desde clave dedupe `tournamentId|round|group|playerA|playerB`. */
export async function resolveMatchIdFromDedupeKey(
  tx: Prisma.TransactionClient,
  dedupeKey: string,
): Promise<string | null> {
  const key = dedupeKey.trim();
  const parts = key.split('|');
  if (parts.length < 5) return null;
  const tournamentId = parts[0]!.trim();
  const round = Number(parts[1]);
  const groupKey = parts[2]!.trim();
  const nameA = parts[3]!.trim();
  const nameB = parts[4]!.trim();
  if (!tournamentId || !groupKey || !nameA || !nameB || !Number.isFinite(round)) return null;

  // Las claves KO conservan el id real del Match (`KO-ko-t-...-qf-0`).
  // Resolverlo antes de comparar nombres evita errores con homónimos.
  if (/^KO-/i.test(groupKey)) {
    const koId = groupKey.replace(/^KO-/i, '');
    const ko = await tx.match.findUnique({ where: { id: koId }, select: { id: true } });
    if (ko) return ko.id;
  }

  const players = await tx.player.findMany({
    select: { id: true, name: true, displayName: true },
  });
  const nameToId = buildNameToId(players);
  const idA = nameToId.get(normName(nameA));
  const idB = nameToId.get(normName(nameB));
  if (!idA || !idB) return null;

  const group = await tx.group.findFirst({
    where: { tournamentId, key: groupKey },
    select: { id: true },
  });

  const match = await tx.match.findFirst({
    where: group
      ? {
          tournamentId,
          groupId: group.id,
          OR: [
            { player1Id: idA, player2Id: idB },
            { player1Id: idB, player2Id: idA },
          ],
        }
      : {
          tournamentId,
          OR: [
            { player1Id: idA, player2Id: idB },
            { player1Id: idB, player2Id: idA },
          ],
        },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  return match?.id ?? null;
}

export async function resolveMatchResultMatchId(
  tx: Prisma.TransactionClient,
  candidate: string | undefined | null,
  dedupeKey: string,
): Promise<string | null> {
  const mid = sanitizeMatchResultMatchIdCandidate(candidate, dedupeKey);
  if (mid) {
    const row = await tx.match.findUnique({ where: { id: mid }, select: { id: true } });
    if (row) return row.id;
  }
  return resolveMatchIdFromDedupeKey(tx, dedupeKey);
}
