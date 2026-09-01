/**
 * Aplica columna featuredForHome si falta (alternativa cuando migrate deploy no corre en el host).
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';

async function main() {
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'TournamentScheduleEntry'
      AND COLUMN_NAME = 'featuredForHome'
  `;
  const exists = Number(rows[0]?.c ?? 0) > 0;
  if (exists) {
    console.log('[apply-featured-column] featuredForHome ya existe');
    return;
  }
  await prisma.$executeRawUnsafe(
    'ALTER TABLE `TournamentScheduleEntry` ADD COLUMN `featuredForHome` BOOLEAN NOT NULL DEFAULT false',
  );
  console.log('[apply-featured-column] OK — columna featuredForHome agregada');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
