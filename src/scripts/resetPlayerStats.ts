/**
 * Resetea estadísticas de un jugador: borra resultados y recalcula rankings.
 * Uso: node dist/scripts/resetPlayerStats.js "Álvarez I."
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Uso: resetPlayerStats.js "Álvarez I."');
    process.exit(1);
  }
  const target = normName(query);
  const players = await prisma.player.findMany({
    select: { id: true, name: true, displayName: true },
  });
  const player = players.find(
    (p) => normName(p.name) === target || normName(p.displayName ?? '') === target,
  );
  if (!player) {
    console.error(`Jugador no encontrado: ${query}`);
    process.exit(1);
  }

  const results = await prisma.matchResult.findMany({
    where: {
      OR: [{ playerA: player.name }, { playerB: player.name }],
    },
    select: { id: true, dedupeKey: true },
  });

  const deletedResults = await prisma.matchResult.deleteMany({
    where: { id: { in: results.map((r) => r.id) } },
  });

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ player1Id: player.id }, { player2Id: player.id }],
      NOT: { score: '' },
    },
    select: { id: true },
  });

  let resetMatches = 0;
  for (const m of matches) {
    await prisma.match.update({
      where: { id: m.id },
      data: { score: '', winnerId: null, loserId: null },
    });
    resetMatches += 1;
  }

  await prisma.leagueRankingRow.deleteMany({ where: { playerId: player.id } });
  await recalculateRankings(prisma);

  console.log(
    `[reset-player] ${player.name} (${player.id}): ${deletedResults.count} resultados borrados, ${resetMatches} partidos reseteados, ranking recalculado`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
