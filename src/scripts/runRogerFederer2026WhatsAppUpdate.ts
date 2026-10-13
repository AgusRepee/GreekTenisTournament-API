/**
 * Orquestación: resultados L1/L2/L4/L6 + L3 pre-reemplazo → reemplazos L3/L5 → resultados L5 → ranking.
 */
import '../envBootstrap.js';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';
import { applyRogerFederer2026WhatsAppResults } from './applyRogerFederer2026WhatsAppResults.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runScript(scriptBase: string): void {
  const apiRoot = path.join(__dirname, '../..');
  const jsPath = path.join(apiRoot, 'dist', 'scripts', `${scriptBase}.js`);
  execFileSync(process.execPath, [jsPath], {
    stdio: 'inherit',
    env: process.env,
    cwd: apiRoot,
  });
}

async function verifyGroupStageOpen(): Promise<string[]> {
  const issues: string[] = [];
  const leagues = await prisma.tournamentLeague.findMany({
    where: { tournamentId: { startsWith: 't-federer-l' } },
    select: { tournamentId: true, leagueNum: true, groupStageStatus: true },
  });
  for (const l of leagues) {
    if (l.groupStageStatus === 'confirmed' || l.groupStageStatus === 'finished') {
      issues.push(`${l.tournamentId} groupStageStatus=${l.groupStageStatus}`);
    }
  }
  return issues;
}

async function main() {
  const summary: Record<string, unknown> = {};

  summary.phase1 = await applyRogerFederer2026WhatsAppResults({
    excludeTournamentIds: ['t-federer-l5'],
  });

  runScript('fixRogerFedererLiga3RojasToAraujo');
  summary.l3Replace = 'executed';

  runScript('fixRogerFedererLiga5HernandezToDavino');
  summary.l5Replace = 'executed';

  summary.phase2 = await applyRogerFederer2026WhatsAppResults({
    tournamentIds: ['t-federer-l5'],
  });

  await recalculateRankings(prisma);
  summary.groupStageCheck = await verifyGroupStageOpen();
  summary.rankingRecalculated = true;

  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
