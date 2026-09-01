/**
 * Actualiza fechas Novak L1–L6: inicio 14/03/2026, fin = fecha de la final jugada.
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { syncNovakTournamentDates, NOVAK_ND2026_START_ISO } from '../services/novakTournamentDates.js';

async function main() {
  const rows = await syncNovakTournamentDates(prisma);
  for (const { id, end } of rows) {
    console.log(`Novak ${id}: ${NOVAK_ND2026_START_ISO} → ${end}`);
  }
  console.log('Fechas Novak actualizadas.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
