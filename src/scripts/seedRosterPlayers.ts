import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const ROSTER_BY_LEAGUE = {
  1: [
    'Pfening G.',
    'Álvarez I.',
    'Tacain R.',
    'Arico S.',
    'Guidobono A.',
    'Garassi A.',
    'Rothkel M.',
    'Araujo J.',
    'Zanella H.',
    'Duarte D.',
    'Gaudina A.',
    'Córdoba D.',
    'Filosa M.',
    'Mena C.',
    'Novizki P.',
  ],
  3: [
    'Pusterla P.',
    'Santi M.',
    'Rusel S.',
    'Bocchicchio F.',
    'Repecka A.',
    'Marin G.',
    'Fernandez B.',
    'Casadio M.',
    'Volpe S.',
    'Bianco D.',
    'Vito C.',
    'Santi G.',
    'Del Valle G.',
    'Ferreres G.',
    'Komesu F.',
  ],
  4: [
    'Chantada M.',
    'Beitia J.',
    'Malcangi R.',
    'Cardozo M.',
    'Anetta D.',
    'Vera F.',
    'Blanco J.',
    'Repecka J.',
    'Bernardini G.',
    'Murchio M.',
    'Cellilli M.',
    'Garcia J.',
    'Fernandez B.',
  ],
} as const;

const CATEGORY_BY_LEAGUE: Record<keyof typeof ROSTER_BY_LEAGUE, string> = {
  1: 'Primera',
  3: 'Tercera',
  4: 'Cuarta',
};

function playerSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function playerId(league: number, name: string): string {
  return `p-l${league}-${playerSlug(name)}`;
}

async function main() {
  let upserted = 0;
  for (const leagueKey of Object.keys(ROSTER_BY_LEAGUE) as unknown as Array<keyof typeof ROSTER_BY_LEAGUE>) {
    const category = CATEGORY_BY_LEAGUE[leagueKey];
    for (const name of ROSTER_BY_LEAGUE[leagueKey]) {
      await prisma.player.upsert({
        where: { id: playerId(Number(leagueKey), name) },
        create: {
          id: playerId(Number(leagueKey), name),
          name,
          displayName: name,
          category,
          nationality: 'Argentina',
          rosterActive: true,
          profileVisibility: 'active',
        },
        update: {
          name,
          displayName: name,
          category,
          rosterActive: true,
          profileVisibility: 'active',
        },
      });
      upserted += 1;
    }
  }

  const rk = await recalculateRankings(prisma);
  console.log(`[seedRosterPlayers] jugadores activos actualizados: ${upserted}. Ranking rows: ${rk.rowsWritten}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
