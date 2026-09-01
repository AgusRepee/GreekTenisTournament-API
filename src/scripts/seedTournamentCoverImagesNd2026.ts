/**
 * Actualiza solo coverImage en MySQL (no toca partidos ni resultados).
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { TOURNAMENT_COVER_IMAGES_ND2026 } from './lib/tournamentCoverImagesNd2026.js';

async function main() {
  for (const [id, coverImage] of Object.entries(TOURNAMENT_COVER_IMAGES_ND2026)) {
    const updated = await prisma.tournament.updateMany({
      where: { id },
      data: { coverImage },
    });
    if (updated.count > 0) {
      console.log(`${id} → ${coverImage}`);
    } else {
      console.warn(`No encontrado: ${id}`);
    }
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
