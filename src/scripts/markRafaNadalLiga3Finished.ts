import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-rafa-nadal-l3';
const CHAMPION_ID = 'p-l3-marin-g';
const FINALIST_ID = 'p-l3-fernandez-b';

async function main() {
  const existing = await prisma.tournament.findUnique({ where: { id: TOURNAMENT_ID } });
  if (!existing) {
    throw new Error(`Torneo no encontrado: ${TOURNAMENT_ID}`);
  }

  const row = await prisma.tournament.update({
    where: { id: TOURNAMENT_ID },
    data: {
      status: 'finished',
      winnerId: CHAMPION_ID,
      finalistId: FINALIST_ID,
    },
  });

  const ranking = await recalculateRankings(prisma);

  console.log(`${row.name}: status=${row.status}, campeón=${row.winnerId}, finalista=${row.finalistId}`);
  console.log(`Ranking recalculado: ${ranking.rowsWritten} filas.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
