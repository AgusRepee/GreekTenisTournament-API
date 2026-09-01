/**
 * Ascensos de ejemplo: jugadores que figuran en más de un ranking de liga
 * (torneo en liga inferior + inscriptos en torneo de liga superior).
 * No borra partidos ni resultados.
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

type CrossLeagueEntry = {
  displayName: string;
  tournamentId: string;
  groupKey: string;
};

/** Jugadores ascendentes (nombre como en plantel / JSON de liga). */
const CROSS_LEAGUE_ROSTER: CrossLeagueEntry[] = [
  // Rafael: jugaron L6, también en L5
  { displayName: 'Cellilli F.', tournamentId: 't-rafa-nadal-l5', groupKey: 'C' },
  { displayName: 'Ballesta F.', tournamentId: 't-rafa-nadal-l5', groupKey: 'A' },
];

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
    where: { rosterActive: true },
    select: { id: true, name: true, displayName: true },
  });
  for (const p of players) {
    if (normName(p.name) === target || normName(p.displayName ?? '') === target) return p.id;
  }
  return null;
}

async function main() {
  let added = 0;
  for (const entry of CROSS_LEAGUE_ROSTER) {
    const playerId = await resolvePlayerId(entry.displayName);
    if (!playerId) {
      console.warn(`Jugador no encontrado: ${entry.displayName}`);
      continue;
    }
    const group = await prisma.group.findFirst({
      where: { tournamentId: entry.tournamentId, key: entry.groupKey },
      select: { id: true },
    });
    if (!group) {
      console.warn(`Grupo no encontrado: ${entry.tournamentId} / ${entry.groupKey}`);
      continue;
    }
    const existing = await prisma.groupPlayer.findUnique({
      where: { groupId_playerId: { groupId: group.id, playerId } },
    });
    if (existing) {
      console.log(`Ya inscripto: ${entry.displayName} en ${entry.tournamentId} (${entry.groupKey})`);
      continue;
    }
    const maxSeed = await prisma.groupPlayer.aggregate({
      where: { groupId: group.id },
      _max: { seed: true },
    });
    await prisma.groupPlayer.create({
      data: {
        groupId: group.id,
        playerId,
        seed: (maxSeed._max.seed ?? 0) + 1,
      },
    });
    console.log(`+ ${entry.displayName} → ${entry.tournamentId} grupo ${entry.groupKey}`);
    added += 1;
  }

  const rk = await recalculateRankings(prisma);
  console.log(`Ascensos aplicados: ${added}. Ranking recalculado: ${rk.rowsWritten} filas.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
