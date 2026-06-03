import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TOURNAMENT_ID = 't-rafa-nadal-l4';
const LEAGUE_NUM = 4;

const groups = {
  A: ['Cardozo M.', 'Blanco J.', 'Castellanos M.', 'Malcangi R.', 'Gonzalez Dias F.'],
  B: ['Repecka J.', 'Chantada M.', 'Murchio M.', 'Rios J.', 'Gonzalez Dias C.'],
  C: ['Beitia J.', 'Vera F.', 'Cellilli M.', 'Cordoba G.', 'Garcia J.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Cardozo M.', playerB: 'Blanco J.', ballPlayer: 'Cardozo M.' },
  { group: 'A', round: 1, playerA: 'Castellanos M.', playerB: 'Malcangi R.', ballPlayer: 'Castellanos M.' },
  { group: 'A', round: 2, playerA: 'Malcangi R.', playerB: 'Cardozo M.', ballPlayer: 'Malcangi R.' },
  { group: 'A', round: 2, playerA: 'Castellanos M.', playerB: 'Gonzalez Dias F.', ballPlayer: 'Castellanos M.' },
  { group: 'A', round: 3, playerA: 'Cardozo M.', playerB: 'Castellanos M.', ballPlayer: 'Cardozo M.' },
  { group: 'A', round: 3, playerA: 'Gonzalez Dias F.', playerB: 'Blanco J.', ballPlayer: 'Gonzalez Dias F.' },
  { group: 'A', round: 4, playerA: 'Gonzalez Dias F.', playerB: 'Cardozo M.', ballPlayer: 'Gonzalez Dias F.' },
  { group: 'A', round: 4, playerA: 'Blanco J.', playerB: 'Malcangi R.', ballPlayer: 'Blanco J.' },
  { group: 'A', round: 5, playerA: 'Blanco J.', playerB: 'Castellanos M.', ballPlayer: 'Blanco J.' },
  { group: 'A', round: 5, playerA: 'Malcangi R.', playerB: 'Gonzalez Dias F.', ballPlayer: 'Malcangi R.' },
  { group: 'B', round: 1, playerA: 'Repecka J.', playerB: 'Chantada M.', ballPlayer: 'Repecka J.' },
  { group: 'B', round: 1, playerA: 'Murchio M.', playerB: 'Rios J.', ballPlayer: 'Murchio M.' },
  { group: 'B', round: 2, playerA: 'Rios J.', playerB: 'Repecka J.', ballPlayer: 'Rios J.' },
  { group: 'B', round: 2, playerA: 'Murchio M.', playerB: 'Gonzalez Dias C.', ballPlayer: 'Murchio M.' },
  { group: 'B', round: 3, playerA: 'Repecka J.', playerB: 'Murchio M.', ballPlayer: 'Repecka J.' },
  { group: 'B', round: 3, playerA: 'Gonzalez Dias C.', playerB: 'Chantada M.', ballPlayer: 'Gonzalez Dias C.' },
  { group: 'B', round: 4, playerA: 'Gonzalez Dias C.', playerB: 'Repecka J.', ballPlayer: 'Gonzalez Dias C.' },
  { group: 'B', round: 4, playerA: 'Chantada M.', playerB: 'Rios J.', ballPlayer: 'Chantada M.' },
  { group: 'B', round: 5, playerA: 'Chantada M.', playerB: 'Murchio M.', ballPlayer: 'Chantada M.' },
  { group: 'B', round: 5, playerA: 'Rios J.', playerB: 'Gonzalez Dias C.', ballPlayer: 'Rios J.' },
  { group: 'C', round: 1, playerA: 'Beitia J.', playerB: 'Vera F.', ballPlayer: 'Beitia J.' },
  { group: 'C', round: 1, playerA: 'Cellilli M.', playerB: 'Cordoba G.', ballPlayer: 'Cellilli M.' },
  { group: 'C', round: 2, playerA: 'Cordoba G.', playerB: 'Beitia J.', ballPlayer: 'Cordoba G.' },
  { group: 'C', round: 2, playerA: 'Cellilli M.', playerB: 'Garcia J.', ballPlayer: 'Cellilli M.' },
  { group: 'C', round: 3, playerA: 'Beitia J.', playerB: 'Cellilli M.', ballPlayer: 'Beitia J.' },
  { group: 'C', round: 3, playerA: 'Garcia J.', playerB: 'Vera F.', ballPlayer: 'Garcia J.' },
  { group: 'C', round: 4, playerA: 'Garcia J.', playerB: 'Beitia J.', ballPlayer: 'Garcia J.' },
  { group: 'C', round: 4, playerA: 'Vera F.', playerB: 'Cordoba G.', ballPlayer: 'Vera F.' },
  { group: 'C', round: 5, playerA: 'Vera F.', playerB: 'Cellilli M.', ballPlayer: 'Vera F.' },
  { group: 'C', round: 5, playerA: 'Cordoba G.', playerB: 'Garcia J.', ballPlayer: 'Cordoba G.' },
];

function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function fallbackPlayerId(name: string): string {
  const normalized = normName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `p-rafa-l4-${normalized}`;
}

const playerIdCache = new Map<string, string>();

async function resolvePlayerId(name: string): Promise<string> {
  const key = normName(name);
  const cached = playerIdCache.get(key);
  if (cached) return cached;

  const all = await prisma.player.findMany({
    select: { id: true, name: true, displayName: true },
  });
  const hit = all.find((p) => normName(p.name) === key || normName(p.displayName ?? '') === key);
  const id = hit?.id ?? fallbackPlayerId(name);
  if (!hit) {
    await prisma.player.upsert({
      where: { id },
      create: {
        id,
        name,
        displayName: name,
        category: 'Cuarta',
        nationality: 'Argentina',
      },
      update: { name, displayName: name },
    });
  }
  playerIdCache.set(key, id);
  return id;
}

function dedupeKey(m: Pick<SeedMatch, 'group' | 'round' | 'playerA' | 'playerB'>): string {
  return `${TOURNAMENT_ID}|${m.round}|${m.group}|${normName(m.playerA)}|${normName(m.playerB)}`;
}

function matchId(index: number): string {
  return `rafa-l4-${String(index + 1).padStart(2, '0')}`;
}

function stageFor(): MatchStage {
  return 'group';
}

function ligaDoc(): Prisma.InputJsonValue {
  return {
    torneo: 'Rafael Nadal',
    liga: LEAGUE_NUM,
    grupos: groups,
    fechas: [
      {
        numero: 1,
        grupos: {
          A: ['Cardozo M. (P) vs Blanco J.', 'Castellanos M. (P) vs Malcangi R.', 'Libre: Gonzalez Dias F.'],
          B: ['Repecka J. (P) vs Chantada M.', 'Murchio M. (P) vs Rios J.', 'Libre: Gonzalez Dias C.'],
          C: ['Beitia J. (P) vs Vera F.', 'Cellilli M. (P) vs Cordoba G.', 'Libre: Garcia J.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Malcangi R. (P) vs Cardozo M.', 'Castellanos M. (P) vs Gonzalez Dias F.', 'Libre: Blanco J.'],
          B: ['Rios J. (P) vs Repecka J.', 'Murchio M. (P) vs Gonzalez Dias C.', 'Libre: Chantada M.'],
          C: ['Cordoba G. (P) vs Beitia J.', 'Cellilli M. (P) vs Garcia J.', 'Libre: Vera F.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Cardozo M. (P) vs Castellanos M.', 'Gonzalez Dias F. (P) vs Blanco J.', 'Libre: Malcangi R.'],
          B: ['Repecka J. (P) vs Murchio M.', 'Gonzalez Dias C. (P) vs Chantada M.', 'Libre: Rios J.'],
          C: ['Beitia J. (P) vs Cellilli M.', 'Garcia J. (P) vs Vera F.', 'Libre: Cordoba G.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Gonzalez Dias F. (P) vs Cardozo M.', 'Blanco J. (P) vs Malcangi R.', 'Libre: Castellanos M.'],
          B: ['Gonzalez Dias C. (P) vs Repecka J.', 'Chantada M. (P) vs Rios J.', 'Libre: Murchio M.'],
          C: ['Garcia J. (P) vs Beitia J.', 'Vera F. (P) vs Cordoba G.', 'Libre: Cellilli M.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Blanco J. (P) vs Castellanos M.', 'Malcangi R. (P) vs Gonzalez Dias F.', 'Libre: Cardozo M.'],
          B: ['Chantada M. (P) vs Murchio M.', 'Rios J. (P) vs Gonzalez Dias C.', 'Libre: Repecka J.'],
          C: ['Vera F. (P) vs Cellilli M.', 'Cordoba G. (P) vs Garcia J.', 'Libre: Beitia J.'],
        },
      },
    ],
  };
}

async function main() {
  const allPlayers = Array.from(new Set(Object.values(groups).flat()));
  for (const name of allPlayers) {
    await resolvePlayerId(name);
  }
  const playerId = (name: string) => playerIdCache.get(normName(name))!;

  await prisma.$transaction(async (tx) => {
    await tx.tournament.upsert({
      where: { id: TOURNAMENT_ID },
      create: {
        id: TOURNAMENT_ID,
        slug: 'rafael-nadal-liga-4',
        name: 'Rafael Nadal - Liga 4',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'rafa-negro.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'rafael-nadal-liga-4',
        name: 'Rafael Nadal - Liga 4',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'rafa-negro.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
    });

    const league = await tx.tournamentLeague.upsert({
      where: { tournamentId_leagueNum: { tournamentId: TOURNAMENT_ID, leagueNum: LEAGUE_NUM } },
      create: { tournamentId: TOURNAMENT_ID, leagueNum: LEAGUE_NUM, groupStageStatus: 'confirmed' },
      update: { groupStageStatus: 'confirmed' },
    });

    const groupIds = new Map<string, string>();
    for (const [key, names] of Object.entries(groups)) {
      const group = await tx.group.upsert({
        where: { tournamentId_key: { tournamentId: TOURNAMENT_ID, key } },
        create: { tournamentId: TOURNAMENT_ID, key, displayName: `Grupo ${key}` },
        update: { displayName: `Grupo ${key}` },
      });
      groupIds.set(key, group.id);
      for (const [index, name] of names.entries()) {
        const pid = playerId(name);
        await tx.groupPlayer.upsert({
          where: { groupId_playerId: { groupId: group.id, playerId: pid } },
          create: { groupId: group.id, playerId: pid, seed: index + 1 },
          update: { seed: index + 1 },
        });
      }
    }

    for (const [index, row] of fixtures.entries()) {
      const id = matchId(index);
      const p1 = playerId(row.playerA);
      const p2 = playerId(row.playerB);
      const note = `Jugador con pelotas: ${row.ballPlayer}.`;

      await tx.match.upsert({
        where: { id },
        create: {
          id,
          tournamentId: TOURNAMENT_ID,
          tournamentLeagueId: league.id,
          groupId: groupIds.get(row.group) ?? null,
          stage: stageFor(),
          roundLabel: `Grupo ${row.group} - Fecha ${row.round}`,
          player1Id: p1,
          player2Id: p2,
          winnerId: null,
          loserId: null,
          score: '',
          scheduleStatus: 'unscheduled',
          scheduledDate: null,
          scheduledTime: null,
          completed: false,
        },
        update: {
          tournamentLeagueId: league.id,
          groupId: groupIds.get(row.group) ?? null,
          stage: stageFor(),
          roundLabel: `Grupo ${row.group} - Fecha ${row.round}`,
          player1Id: p1,
          player2Id: p2,
          winnerId: null,
          loserId: null,
          score: '',
          scheduleStatus: 'unscheduled',
          scheduledDate: null,
          scheduledTime: null,
          completed: false,
        },
      });

      await tx.tournamentScheduleEntry.upsert({
        where: { dedupeKey: dedupeKey(row) },
        create: {
          dedupeKey: dedupeKey(row),
          tournamentId: TOURNAMENT_ID,
          leagueNum: LEAGUE_NUM,
          scheduleStatus: 'unscheduled',
          date: null,
          time: null,
          note,
        },
        update: {
          scheduleStatus: 'unscheduled',
          date: null,
          time: null,
          note,
        },
      });
    }

    await tx.matchResult.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  });

  console.log(`Rafael Nadal - Liga 4: ${fixtures.length} partidos programados sin resultados.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
