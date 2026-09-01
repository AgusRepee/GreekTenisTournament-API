import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

/** Rafael Nadal 2026 — torneos ya jugados con campeón cargado en admin. */
const RAFA_FINISHED_IDS = [
  't-rafael-nadal-l1',
  't-rafa-nadal',
  't-rafa-nadal-l3',
  't-rafa-nadal-l4',
  't-rafa-nadal-l5',
  't-rafa-nadal-l6',
] as const;

async function main() {
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const id of RAFA_FINISHED_IDS) {
    const row = await prisma.tournament.findUnique({ where: { id } });
    if (!row) {
      skipped.push(`${id} (no existe)`);
      continue;
    }
    if (!row.winnerId) {
      skipped.push(`${id} (sin campeón — no se marca finished)`);
      continue;
    }
    if (row.status === 'finished') {
      skipped.push(`${id} (ya finished)`);
      continue;
    }
    await prisma.tournament.update({
      where: { id },
      data: { status: 'finished' },
    });
    updated.push(`${row.name} (${id}) → campeón=${row.winnerId}, finalista=${row.finalistId ?? '—'}`);
  }

  const ranking = await recalculateRankings(prisma);

  console.log(`Marcados finished (${updated.length}):`);
  for (const line of updated) console.log(`  • ${line}`);
  if (skipped.length) {
    console.log(`Omitidos (${skipped.length}):`);
    for (const line of skipped) console.log(`  • ${line}`);
  }
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
