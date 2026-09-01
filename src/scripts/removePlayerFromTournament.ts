/**
 * Quita un jugador de un torneo (grupo + partidos sin resultado + fila de ranking de esa liga).
 * Uso: tsx src/scripts/removePlayerFromTournament.ts <tournamentId> "<displayName>"
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .trim()
    .toLowerCase();
}

async function resolvePlayerId(displayName: string): Promise<string | null> {
  const target = normName(displayName);
  const players = await prisma.player.findMany({
    select: { id: true, name: true, displayName: true },
  });
  for (const p of players) {
    if (normName(p.name) === target || normName(p.displayName ?? '') === target) return p.id;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  let tournamentId = '';
  let displayName = '';
  let playerIdArg = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--player-id' && args[i + 1]) {
      playerIdArg = args[++i]!.trim();
      continue;
    }
    if (!tournamentId) {
      tournamentId = arg.trim();
      continue;
    }
    displayName = displayName ? `${displayName} ${arg}` : arg;
  }

  if (!tournamentId || (!displayName && !playerIdArg)) {
    console.error(
      'Uso: removePlayerFromTournament.ts <tournamentId> "<displayName>" | --player-id <playerId>',
    );
    process.exitCode = 1;
    return;
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, leagues: { select: { leagueNum: true } } },
  });
  if (!tournament) {
    console.error(`Torneo no encontrado: ${tournamentId}`);
    process.exitCode = 1;
    return;
  }

  const playerId = playerIdArg || (await resolvePlayerId(displayName));
  if (!playerId) {
    console.error(`Jugador no encontrado: ${displayName || playerIdArg}`);
    process.exitCode = 1;
    return;
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { name: true, displayName: true },
  });
  const label = player?.displayName ?? player?.name ?? playerId;

  const groups = await prisma.group.findMany({
    where: { tournamentId },
    select: { id: true, key: true },
  });
  const groupIds = groups.map((g) => g.id);

  const gpDeleted = await prisma.groupPlayer.deleteMany({
    where: { playerId, groupId: { in: groupIds } },
  });

  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      OR: [{ player1Id: playerId }, { player2Id: playerId }],
    },
    select: { id: true, completed: true, matchResults: { select: { id: true }, take: 1 } },
  });

  let matchesDeleted = 0;
  let matchesSkipped = 0;
  for (const m of matches) {
    if (m.completed || m.matchResults.length > 0) {
      matchesSkipped += 1;
      console.warn(`Partido ${m.id} tiene resultado — no se elimina.`);
      continue;
    }
    await prisma.match.delete({ where: { id: m.id } });
    matchesDeleted += 1;
  }

  const leagueNums = tournament.leagues.map((l) => l.leagueNum);
  const rankingDeleted = await prisma.leagueRankingRow.deleteMany({
    where: { playerId, league: { in: leagueNums } },
  });

  const rk = await recalculateRankings(prisma);

  console.log(
    `[removePlayerFromTournament] ${label} → ${tournament.name} (${tournamentId}): ` +
      `groupPlayer=${gpDeleted.count}, matchesDeleted=${matchesDeleted}, matchesSkipped=${matchesSkipped}, ` +
      `rankingRows=${rankingDeleted.count}, recalc=${rk.rowsWritten}`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
