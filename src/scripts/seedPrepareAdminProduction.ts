/**
 * Prepara producción para carga manual de resultados vía admin:
 * - Plantel en Player (seedRosterPlayers)
 * - Fechas de torneos
 * - 12 torneos con grupos + partidos sin resultados
 * - Rankings recalculados (vacíos hasta cargar resultados)
 */
import '../envBootstrap.js';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(scriptsDir, '..', '..');

function runScript(name: string): void {
  const path = join(scriptsDir, name);
  console.log(`\n[prepare] ${name}`);
  execSync(`npx tsx "${path}"`, { cwd: apiRoot, stdio: 'inherit', env: process.env });
}

async function main() {
  runScript('seedClearResultsNd2026.ts');
  runScript('seedRosterPlayers.ts');
  runScript('seedTournamentDatesNd2026.ts');

  const tournamentSeeds = [
    'seedNovakLiga1Nd2026Tournament.ts',
    'seedNovakLigas246Nd2026Tournament.ts',
    'seedNovakLiga3Nd2026Tournament.ts',
    'seedRafaelNadalLiga1Nd2026Tournament.ts',
    'seedRafaNadalLiga2Nd2026Tournament.ts',
    'seedRafaNadalLiga3Nd2026Tournament.ts',
    'seedRafaNadalLiga4Nd2026Tournament.ts',
    'seedRafaNadalLiga5Nd2026Tournament.ts',
    'seedRafaNadalLiga6Nd2026Tournament.ts',
  ];

  for (const seed of tournamentSeeds) {
    runScript(seed);
  }

  const rk = await recalculateRankings(prisma);
  console.log(`\n[prepare] Rankings recalculados: ${rk.rowsWritten} filas.`);

  const tournaments = await prisma.tournament.count({
    where: {
      id: {
        in: [
          't-novak',
          't-novak-l2',
          't-novak-l3',
          't-novak-l4',
          't-novak-l5',
          't-novak-l6',
          't-rafael-nadal-l1',
          't-rafa-nadal',
          't-rafa-nadal-l3',
          't-rafa-nadal-l4',
          't-rafa-nadal-l5',
          't-rafa-nadal-l6',
        ],
      },
    },
  });
  const results = await prisma.matchResult.count({
    where: {
      tournamentId: {
        in: [
          't-novak',
          't-novak-l2',
          't-novak-l3',
          't-novak-l4',
          't-novak-l5',
          't-novak-l6',
          't-rafael-nadal-l1',
          't-rafa-nadal',
          't-rafa-nadal-l3',
          't-rafa-nadal-l4',
          't-rafa-nadal-l5',
          't-rafa-nadal-l6',
        ],
      },
    },
  });
  const matches = await prisma.match.count({
    where: {
      tournamentId: {
        in: [
          't-novak',
          't-novak-l2',
          't-novak-l3',
          't-novak-l4',
          't-novak-l5',
          't-novak-l6',
          't-rafael-nadal-l1',
          't-rafa-nadal',
          't-rafa-nadal-l3',
          't-rafa-nadal-l4',
          't-rafa-nadal-l5',
          't-rafa-nadal-l6',
        ],
      },
    },
  });

  console.log(`\n[prepare] OK — torneos: ${tournaments}/12, partidos: ${matches}, resultados en BD: ${results}`);
  if (results > 0) {
    console.warn('[prepare] AVISO: hay resultados en BD; si querés empezar de cero, revisá seeds o borrá match_results.');
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
