import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TOURNAMENT_ID = 't-rafa-nadal-l3';
const LEAGUE_NUM = 3;

const groups = {
  A: ['Santi Mat.', 'Casadio M.', 'Vito C.', 'Aguirre W.', 'Del Valle G.'],
  B: ['Fernandez B.', 'Santi Mar.', 'Ferreres G.', 'Bocchicchio F.', 'Bernardini G.'],
  C: ['Figueroa M.', 'Rusel S.', 'Marin G.', 'Pusterla P.', 'Bianco D.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Santi Mat.', playerB: 'Casadio M.', ballPlayer: 'Santi Mat.' },
  { group: 'A', round: 1, playerA: 'Vito C.', playerB: 'Aguirre W.', ballPlayer: 'Vito C.' },
  { group: 'A', round: 2, playerA: 'Aguirre W.', playerB: 'Santi Mat.', ballPlayer: 'Aguirre W.' },
  { group: 'A', round: 2, playerA: 'Vito C.', playerB: 'Del Valle G.', ballPlayer: 'Vito C.' },
  { group: 'A', round: 3, playerA: 'Santi Mat.', playerB: 'Vito C.', ballPlayer: 'Santi Mat.' },
  { group: 'A', round: 3, playerA: 'Del Valle G.', playerB: 'Casadio M.', ballPlayer: 'Del Valle G.' },
  { group: 'A', round: 4, playerA: 'Del Valle G.', playerB: 'Santi Mat.', ballPlayer: 'Del Valle G.' },
  { group: 'A', round: 4, playerA: 'Casadio M.', playerB: 'Aguirre W.', ballPlayer: 'Casadio M.' },
  { group: 'A', round: 5, playerA: 'Casadio M.', playerB: 'Vito C.', ballPlayer: 'Casadio M.' },
  { group: 'A', round: 5, playerA: 'Aguirre W.', playerB: 'Del Valle G.', ballPlayer: 'Aguirre W.' },
  { group: 'B', round: 1, playerA: 'Fernandez B.', playerB: 'Santi Mar.', ballPlayer: 'Fernandez B.' },
  { group: 'B', round: 1, playerA: 'Ferreres G.', playerB: 'Bocchicchio F.', ballPlayer: 'Ferreres G.' },
  { group: 'B', round: 2, playerA: 'Bocchicchio F.', playerB: 'Fernandez B.', ballPlayer: 'Bocchicchio F.' },
  { group: 'B', round: 2, playerA: 'Ferreres G.', playerB: 'Bernardini G.', ballPlayer: 'Ferreres G.' },
  { group: 'B', round: 3, playerA: 'Fernandez B.', playerB: 'Ferreres G.', ballPlayer: 'Fernandez B.' },
  { group: 'B', round: 3, playerA: 'Bernardini G.', playerB: 'Santi Mar.', ballPlayer: 'Bernardini G.' },
  { group: 'B', round: 4, playerA: 'Bernardini G.', playerB: 'Fernandez B.', ballPlayer: 'Bernardini G.' },
  { group: 'B', round: 4, playerA: 'Santi Mar.', playerB: 'Bocchicchio F.', ballPlayer: 'Santi Mar.' },
  { group: 'B', round: 5, playerA: 'Santi Mar.', playerB: 'Ferreres G.', ballPlayer: 'Santi Mar.' },
  { group: 'B', round: 5, playerA: 'Bocchicchio F.', playerB: 'Bernardini G.', ballPlayer: 'Bocchicchio F.' },
  { group: 'C', round: 1, playerA: 'Figueroa M.', playerB: 'Rusel S.', ballPlayer: 'Figueroa M.' },
  { group: 'C', round: 1, playerA: 'Marin G.', playerB: 'Pusterla P.', ballPlayer: 'Marin G.' },
  { group: 'C', round: 2, playerA: 'Pusterla P.', playerB: 'Figueroa M.', ballPlayer: 'Pusterla P.' },
  { group: 'C', round: 2, playerA: 'Marin G.', playerB: 'Bianco D.', ballPlayer: 'Marin G.' },
  { group: 'C', round: 3, playerA: 'Figueroa M.', playerB: 'Marin G.', ballPlayer: 'Figueroa M.' },
  { group: 'C', round: 3, playerA: 'Bianco D.', playerB: 'Rusel S.', ballPlayer: 'Bianco D.' },
  { group: 'C', round: 4, playerA: 'Bianco D.', playerB: 'Figueroa M.', ballPlayer: 'Bianco D.' },
  { group: 'C', round: 4, playerA: 'Rusel S.', playerB: 'Pusterla P.', ballPlayer: 'Rusel S.' },
  { group: 'C', round: 5, playerA: 'Rusel S.', playerB: 'Marin G.', ballPlayer: 'Rusel S.' },
  { group: 'C', round: 5, playerA: 'Pusterla P.', playerB: 'Bianco D.', ballPlayer: 'Pusterla P.' },
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
  return `p-rafa-l3-${normalized}`;
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
        category: 'Tercera',
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
  return `rafa-l3-${String(index + 1).padStart(2, '0')}`;
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
          A: ['Santi Mat. (P) vs Casadio M.', 'Vito C. (P) vs Aguirre W.', 'Libre: Del Valle G.'],
          B: ['Fernandez B. (P) vs Santi Mar.', 'Ferreres G. (P) vs Bocchicchio F.', 'Libre: Bernardini G.'],
          C: ['Figueroa M. (P) vs Rusel S.', 'Marin G. (P) vs Pusterla P.', 'Libre: Bianco D.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Aguirre W. (P) vs Santi Mat.', 'Vito C. (P) vs Del Valle G.', 'Libre: Casadio M.'],
          B: ['Bocchicchio F. (P) vs Fernandez B.', 'Ferreres G. (P) vs Bernardini G.', 'Libre: Santi Mar.'],
          C: ['Pusterla P. (P) vs Figueroa M.', 'Marin G. (P) vs Bianco D.', 'Libre: Rusel S.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Santi Mat. (P) vs Vito C.', 'Del Valle G. (P) vs Casadio M.', 'Libre: Aguirre W.'],
          B: ['Fernandez B. (P) vs Ferreres G.', 'Bernardini G. (P) vs Santi Mar.', 'Libre: Bocchicchio F.'],
          C: ['Figueroa M. (P) vs Marin G.', 'Bianco D. (P) vs Rusel S.', 'Libre: Pusterla P.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Del Valle G. (P) vs Santi Mat.', 'Casadio M. (P) vs Aguirre W.', 'Libre: Vito C.'],
          B: ['Bernardini G. (P) vs Fernandez B.', 'Santi Mar. (P) vs Bocchicchio F.', 'Libre: Ferreres G.'],
          C: ['Bianco D. (P) vs Figueroa M.', 'Rusel S. (P) vs Pusterla P.', 'Libre: Marin G.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Casadio M. (P) vs Vito C.', 'Aguirre W. (P) vs Del Valle G.', 'Libre: Santi Mat.'],
          B: ['Santi Mar. (P) vs Ferreres G.', 'Bocchicchio F. (P) vs Bernardini G.', 'Libre: Fernandez B.'],
          C: ['Rusel S. (P) vs Marin G.', 'Pusterla P. (P) vs Bianco D.', 'Libre: Figueroa M.'],
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
        slug: 'rafael-nadal-liga-3',
        name: 'Rafael Nadal - Liga 3',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-05-31T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'rafa-hero.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'rafael-nadal-liga-3',
        name: 'Rafael Nadal - Liga 3',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'rafa-hero.webp',
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

  console.log(`Rafael Nadal - Liga 3: ${fixtures.length} partidos programados sin resultados.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
