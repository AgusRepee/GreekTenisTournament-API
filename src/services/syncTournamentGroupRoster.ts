import { Prisma } from '@prisma/client';
import { assertGroupRosterOverrideForWrite } from './tournamentGroupRosterJson.js';

function isPersistablePlayerId(id: string): boolean {
  const t = id.trim();
  if (!t) return false;
  if (t.startsWith('name:')) return false;
  return true;
}

/**
 * Persiste plantel admin: JSON en torneo + filas `GroupPlayer` (solo ids reales en Player).
 */
export async function syncTournamentGroupRosterInTx(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  rawRoster: unknown,
): Promise<Record<string, string[]>> {
  const roster = assertGroupRosterOverrideForWrite(rawRoster);
  const tid = tournamentId.trim();

  await tx.tournament.update({
    where: { id: tid },
    data: {
      groupRosterOverrideJson:
        Object.keys(roster).length > 0 ? (roster as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });

  const groups = await tx.group.findMany({ where: { tournamentId: tid } });
  if (groups.length === 0) return roster;

  const byKey = new Map(groups.map((g) => [g.key, g]));

  for (const [key, playerIds] of Object.entries(roster)) {
    const group = byKey.get(key);
    if (!group) continue;
    const persistable = playerIds.filter(isPersistablePlayerId);

    if (persistable.length === 0) {
      await tx.groupPlayer.deleteMany({ where: { groupId: group.id } });
      continue;
    }

    await tx.groupPlayer.deleteMany({
      where: { groupId: group.id, playerId: { notIn: persistable } },
    });

    for (let i = 0; i < persistable.length; i++) {
      const playerId = persistable[i]!;
      const exists = await tx.player.findUnique({ where: { id: playerId }, select: { id: true } });
      if (!exists) continue;
      await tx.groupPlayer.upsert({
        where: { groupId_playerId: { groupId: group.id, playerId } },
        create: { groupId: group.id, playerId, seed: i + 1 },
        update: { seed: i + 1 },
      });
    }
  }

  for (const group of groups) {
    if (!(group.key in roster)) continue;
    const allowed = (roster[group.key] ?? []).filter(isPersistablePlayerId);
    if (allowed.length === 0) {
      await tx.groupPlayer.deleteMany({ where: { groupId: group.id } });
    }
  }

  return roster;
}
