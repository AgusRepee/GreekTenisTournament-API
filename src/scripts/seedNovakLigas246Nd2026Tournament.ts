/**
 * Novak Djokovic L2, L4, L5, L6 — fixture completo en MySQL, sin resultados (admin carga todo).
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { runNd2026TournamentSeed, type Nd2026TournamentSeedConfig } from './lib/nd2026SeedLib.js';

const CONFIGS: Nd2026TournamentSeedConfig[] = [
  {
    tournamentId: 't-novak-l2',
    leagueNum: 2,
    slug: 'liga-2',
    name: 'Novak Djokovic - Liga 2',
    coverImage: 'novaknaranja.webp',
    jsonFile: 'novak-liga2.json',
    matchIdPrefix: 'novak-l2',
    playerIdPrefix: 'p-novak-l2',
  },
  {
    tournamentId: 't-novak-l4',
    leagueNum: 4,
    slug: 'novak-djokovic-liga-4',
    name: 'Novak Djokovic - Liga 4',
    coverImage: 'novajverde.webp',
    jsonFile: 'novak-liga4.json',
    matchIdPrefix: 'novak-l4',
    playerIdPrefix: 'p-novak-l4',
  },
  {
    tournamentId: 't-novak-l5',
    leagueNum: 5,
    slug: 'novak-djokovic-liga-5',
    name: 'Novak Djokovic - Liga 5',
    coverImage: 'novaknegro.webp',
    jsonFile: 'novak-liga5.json',
    matchIdPrefix: 'novak-l5',
    playerIdPrefix: 'p-novak-l5',
  },
  {
    tournamentId: 't-novak-l6',
    leagueNum: 6,
    slug: 'novak-djokovic-liga-6',
    name: 'Novak Djokovic - Liga 6',
    coverImage: 'novakblanco.webp',
    jsonFile: 'novak-liga6.json',
    matchIdPrefix: 'novak-l6',
    playerIdPrefix: 'p-novak-l6',
  },
];

async function main() {
  for (const cfg of CONFIGS) {
    const n = await runNd2026TournamentSeed(cfg);
    console.log(`${cfg.name}: ${n} partidos programados sin resultados.`);
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
