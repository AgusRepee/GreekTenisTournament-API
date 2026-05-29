import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TOURNAMENT_ID = 't-rafa-nadal-l5';
const LEAGUE_NUM = 5;
const INTERZONAL_GROUP = 'Interzonal';

const groups = {
  A: ['Cirigliano D.', 'Antuña A.', 'Chantada S.', 'Vidigt F.'],
  B: ['Oviedo M.', 'Peralta G.', 'Sola M.', 'Vila E.'],
  C: ['Tellechea L.', 'Gimenez F.', 'Vito A.', 'Amezague J.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Cirigliano D.', playerB: 'Antuña A.', ballPlayer: 'Cirigliano D.' },
  { group: 'A', round: 1, playerA: 'Chantada S.', playerB: 'Vidigt F.', ballPlayer: 'Chantada S.' },
  { group: 'A', round: 2, playerA: 'Cirigliano D.', playerB: 'Chantada S.', ballPlayer: 'Cirigliano D.' },
  { group: 'A', round: 2, playerA: 'Vidigt F.', playerB: 'Antuña A.', ballPlayer: 'Vidigt F.' },
  { group: 'A', round: 3, playerA: 'Vidigt F.', playerB: 'Cirigliano D.', ballPlayer: 'Vidigt F.' },
  { group: 'A', round: 3, playerA: 'Antuña A.', playerB: 'Chantada S.', ballPlayer: 'Antuña A.' },
  { group: 'B', round: 1, playerA: 'Oviedo M.', playerB: 'Peralta G.', ballPlayer: 'Oviedo M.' },
  { group: 'B', round: 1, playerA: 'Sola M.', playerB: 'Vila E.', ballPlayer: 'Sola M.' },
  { group: 'B', round: 2, playerA: 'Sola M.', playerB: 'Oviedo M.', ballPlayer: 'Sola M.' },
  { group: 'B', round: 2, playerA: 'Peralta G.', playerB: 'Vila E.', ballPlayer: 'Peralta G.' },
  { group: 'B', round: 3, playerA: 'Vila E.', playerB: 'Oviedo M.', ballPlayer: 'Vila E.' },
  { group: 'B', round: 3, playerA: 'Sola M.', playerB: 'Peralta G.', ballPlayer: 'Sola M.' },
  { group: 'C', round: 1, playerA: 'Tellechea L.', playerB: 'Gimenez F.', ballPlayer: 'Tellechea L.' },
  { group: 'C', round: 1, playerA: 'Vito A.', playerB: 'Amezague J.', ballPlayer: 'Vito A.' },
  { group: 'C', round: 2, playerA: 'Tellechea L.', playerB: 'Vito A.', ballPlayer: 'Tellechea L.' },
  { group: 'C', round: 2, playerA: 'Gimenez F.', playerB: 'Amezague J.', ballPlayer: 'Gimenez F.' },
  { group: 'C', round: 3, playerA: 'Amezague J.', playerB: 'Tellechea L.', ballPlayer: 'Amezague J.' },
  { group: 'C', round: 3, playerA: 'Gimenez F.', playerB: 'Vito A.', ballPlayer: 'Gimenez F.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Amezague J.', playerB: 'Cirigliano D.', ballPlayer: 'Amezague J.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Antuña A.', playerB: 'Tellechea L.', ballPlayer: 'Antuña A.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Chantada S.', playerB: 'Sola M.', ballPlayer: 'Chantada S.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Vila E.', playerB: 'Vidigt F.', ballPlayer: 'Vila E.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Oviedo M.', playerB: 'Gimenez F.', ballPlayer: 'Oviedo M.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Vito A.', playerB: 'Peralta G.', ballPlayer: 'Vito A.' },
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
  return `p-rafa-l5-${normalized}`;
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
        category: 'Quinta A',
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
  return `rafa-l5-${String(index + 1).padStart(2, '0')}`;
}

function stageFor(group: string): MatchStage {
  if (group === INTERZONAL_GROUP) return 'interzonal';
  return 'group';
}

function roundLabel(row: SeedMatch): string {
  if (row.group === 'A' || row.group === 'B' || row.group === 'C') {
    return `Grupo ${row.group} - Fecha ${row.round}`;
  }
  if (row.group === INTERZONAL_GROUP) return 'Interzonal';
  return row.group;
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
          A: ['Cirigliano D. (P) vs Antuña A.', 'Chantada S. (P) vs Vidigt F.'],
          B: ['Oviedo M. (P) vs Peralta G.', 'Sola M. (P) vs Vila E.'],
          C: ['Tellechea L. (P) vs Gimenez F.', 'Vito A. (P) vs Amezague J.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Cirigliano D. (P) vs Chantada S.', 'Vidigt F. (P) vs Antuña A.'],
          B: ['Sola M. (P) vs Oviedo M.', 'Peralta G. (P) vs Vila E.'],
          C: ['Tellechea L. (P) vs Vito A.', 'Gimenez F. (P) vs Amezague J.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Vidigt F. (P) vs Cirigliano D.', 'Antuña A. (P) vs Chantada S.'],
          B: ['Vila E. (P) vs Oviedo M.', 'Sola M. (P) vs Peralta G.'],
          C: ['Amezague J. (P) vs Tellechea L.', 'Gimenez F. (P) vs Vito A.'],
        },
      },
      {
        numero: 4,
        tipo: 'interzonal',
        partidos: [
          'Amezague J. (P) vs Cirigliano D.',
          'Antuña A. (P) vs Tellechea L.',
          'Chantada S. (P) vs Sola M.',
          'Vila E. (P) vs Vidigt F.',
          'Oviedo M. (P) vs Gimenez F.',
          'Vito A. (P) vs Peralta G.',
        ],
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
        slug: 'rafael-nadal-liga-5',
        name: 'Rafael Nadal - Liga 5',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-05-27T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'rafa-negro.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'rafael-nadal-liga-5',
        name: 'Rafael Nadal - Liga 5',
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
          stage: stageFor(row.group),
          roundLabel: roundLabel(row),
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
          stage: stageFor(row.group),
          roundLabel: roundLabel(row),
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

  console.log(`Rafael Nadal - Liga 5: ${fixtures.length} partidos programados sin resultados.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
