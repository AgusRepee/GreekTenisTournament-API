import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

type RosterLeague = {
  leagueNum: number;
  category: string;
  players: string[];
};

const ROSTER_LEAGUES: RosterLeague[] = [
  {
    leagueNum: 1,
    category: 'Primera',
    players: [
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
  },
  {
    leagueNum: 2,
    category: 'Segunda',
    players: [
      'Lacave L.',
      'Monzón M.',
      'Colomer S.',
      'Cancio M.',
      'Del Pino A.',
      'Ferreyra O.',
      'Ruiz J.',
      'Komesu M.',
      'Guareschi A.',
      'Mayer D.',
      'Rossi F.',
      'Fredkin B.',
      'Molina L.',
      'Scilipoti N.',
      'Gadea M.',
    ],
  },
  {
    leagueNum: 3,
    category: 'Tercera',
    players: [
    'Santi M.',
    'Rusel S.',
    'Repecka A.',
    'Pusterla P.',
    'Bocchicchio F.',
    'Fernandez B.',
    'Marin G.',
    'Casadio M.',
    'Bianco D.',
    'Aguirre W.',
    'Santi G.',
    'Figueroa M.',
    'Del Valle G.',
    'Ferreres G.',
    'Vito C.',
    'Komesu F.',
    ],
  },
  {
    leagueNum: 4,
    category: 'Cuarta',
    players: [
    'Beitia J.',
    'Chantada M.',
    'Malcangi R.',
    'Cardozo M.',
    'Repecka J.',
    'Vera F.',
    'Blanco J.',
    'Anetta D.',
    'Bernardini G.',
    'Garcia J.',
    'Murchio M.',
    'Cellilli M.',
    ],
  },
  {
    leagueNum: 5,
    category: 'Quinta A',
    players: [
      'Ríos J.',
      'Peralta G.',
      'Oviedo M.',
      'Ali M.',
      'Manrique E.',
      'González Días F.',
      'Chantada S.',
      'Sola M.',
      'Cirigliano D.',
      'Córdoba A.',
      'Córdoba G.',
      'González Días C.',
      'Tellechea L.',
      'Vila E.',
      'Giménez F.',
    ],
  },
  {
    leagueNum: 6,
    category: 'Quinta B',
    players: [
      'Cellilli F.',
      'Amezague J.',
      'De Ruyck G.',
      'Fedrjanic N.',
      'Bataglia F.',
      'Ballesta F.',
      'Antuña A.',
      'Ferrarotti E.',
      'Fratini M.',
    ],
  },
];

const REMOVED_ROSTER_PLAYERS = [
  { category: 'Tercera', name: 'Volpe S.' },
  { category: 'Cuarta', name: 'Fernandez B.' },
  { category: 'Quinta B', name: 'Oshiro E.' },
] as const;

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

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
  const existingPlayers = await prisma.player.findMany({
    select: { id: true, name: true, category: true },
  });
  const existingByCategoryAndName = new Map(
    existingPlayers.map((player) => [`${player.category}::${normalizeName(player.name)}`, player.id] as const),
  );

  let upserted = 0;
  let deactivated = 0;
  const removedKeys = new Set(
    REMOVED_ROSTER_PLAYERS.map((player) => `${player.category}::${normalizeName(player.name)}`),
  );
  const removedIds = existingPlayers
    .filter((player) => removedKeys.has(`${player.category}::${normalizeName(player.name)}`))
    .map((player) => player.id);
  if (removedIds.length > 0) {
    const result = await prisma.player.updateMany({
      where: { id: { in: removedIds } },
      data: {
        rosterActive: false,
        profileVisibility: 'hidden',
      },
    });
    deactivated = result.count;
  }

  for (const league of ROSTER_LEAGUES) {
    const seenNames = new Set<string>();
    for (const name of league.players) {
      const normalized = normalizeName(name);
      if (seenNames.has(normalized)) continue;
      seenNames.add(normalized);
      const existingId = existingByCategoryAndName.get(`${league.category}::${normalized}`);
      const id = existingId ?? playerId(league.leagueNum, name);
      await prisma.player.upsert({
        where: { id },
        create: {
          id,
          name,
          displayName: name,
          category: league.category,
          nationality: 'Argentina',
          rosterActive: true,
          profileVisibility: 'active',
        },
        update: {
          name,
          displayName: name,
          category: league.category,
          rosterActive: true,
          profileVisibility: 'active',
        },
      });
      upserted += 1;
    }
  }

  const rk = await recalculateRankings(prisma);
  console.log(
    `[seedRosterPlayers] jugadores activos actualizados: ${upserted}. Inactivos: ${deactivated}. Ranking rows: ${rk.rowsWritten}`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
