import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TOURNAMENT_ID = 't-novak-l3';
const LEAGUE_NUM = 3;

const groups = {
  A: ['Pusterla P.', 'Santi M.', 'Rusel S.', 'Bocchicchio F.', 'Repecka A.'],
  B: ['Marin G.', 'Fernandez B.', 'Casadio M.', 'Aguirre W.', 'Bianco D.'],
  C: ['Vito C.', 'Santi G.', 'Del Valle G.', 'Ferreres G.', 'Figueroa M.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Pusterla P.', playerB: 'Santi M.', ballPlayer: 'Pusterla P.' },
  { group: 'A', round: 1, playerA: 'Rusel S.', playerB: 'Bocchicchio F.', ballPlayer: 'Rusel S.' },
  { group: 'A', round: 2, playerA: 'Bocchicchio F.', playerB: 'Pusterla P.', ballPlayer: 'Bocchicchio F.' },
  { group: 'A', round: 2, playerA: 'Rusel S.', playerB: 'Repecka A.', ballPlayer: 'Rusel S.' },
  { group: 'A', round: 3, playerA: 'Pusterla P.', playerB: 'Rusel S.', ballPlayer: 'Pusterla P.' },
  { group: 'A', round: 3, playerA: 'Repecka A.', playerB: 'Santi M.', ballPlayer: 'Repecka A.' },
  { group: 'A', round: 4, playerA: 'Repecka A.', playerB: 'Pusterla P.', ballPlayer: 'Repecka A.' },
  { group: 'A', round: 4, playerA: 'Santi M.', playerB: 'Bocchicchio F.', ballPlayer: 'Santi M.' },
  { group: 'A', round: 5, playerA: 'Santi M.', playerB: 'Rusel S.', ballPlayer: 'Santi M.' },
  { group: 'A', round: 5, playerA: 'Bocchicchio F.', playerB: 'Repecka A.', ballPlayer: 'Bocchicchio F.' },
  { group: 'B', round: 1, playerA: 'Marin G.', playerB: 'Fernandez B.', ballPlayer: 'Marin G.' },
  { group: 'B', round: 1, playerA: 'Casadio M.', playerB: 'Aguirre W.', ballPlayer: 'Casadio M.' },
  { group: 'B', round: 2, playerA: 'Aguirre W.', playerB: 'Marin G.', ballPlayer: 'Aguirre W.' },
  { group: 'B', round: 2, playerA: 'Casadio M.', playerB: 'Bianco D.', ballPlayer: 'Casadio M.' },
  { group: 'B', round: 3, playerA: 'Marin G.', playerB: 'Casadio M.', ballPlayer: 'Marin G.' },
  { group: 'B', round: 3, playerA: 'Bianco D.', playerB: 'Fernandez B.', ballPlayer: 'Bianco D.' },
  { group: 'B', round: 4, playerA: 'Bianco D.', playerB: 'Marin G.', ballPlayer: 'Bianco D.' },
  { group: 'B', round: 4, playerA: 'Fernandez B.', playerB: 'Aguirre W.', ballPlayer: 'Fernandez B.' },
  { group: 'B', round: 5, playerA: 'Fernandez B.', playerB: 'Casadio M.', ballPlayer: 'Fernandez B.' },
  { group: 'B', round: 5, playerA: 'Aguirre W.', playerB: 'Bianco D.', ballPlayer: 'Aguirre W.' },
  { group: 'C', round: 1, playerA: 'Vito C.', playerB: 'Santi G.', ballPlayer: 'Vito C.' },
  { group: 'C', round: 1, playerA: 'Del Valle G.', playerB: 'Ferreres G.', ballPlayer: 'Del Valle G.' },
  { group: 'C', round: 2, playerA: 'Ferreres G.', playerB: 'Vito C.', ballPlayer: 'Ferreres G.' },
  { group: 'C', round: 2, playerA: 'Del Valle G.', playerB: 'Figueroa M.', ballPlayer: 'Del Valle G.' },
  { group: 'C', round: 3, playerA: 'Vito C.', playerB: 'Del Valle G.', ballPlayer: 'Vito C.' },
  { group: 'C', round: 3, playerA: 'Figueroa M.', playerB: 'Santi G.', ballPlayer: 'Figueroa M.' },
  { group: 'C', round: 4, playerA: 'Figueroa M.', playerB: 'Vito C.', ballPlayer: 'Figueroa M.' },
  { group: 'C', round: 4, playerA: 'Santi G.', playerB: 'Ferreres G.', ballPlayer: 'Santi G.' },
  { group: 'C', round: 5, playerA: 'Santi G.', playerB: 'Del Valle G.', ballPlayer: 'Santi G.' },
  { group: 'C', round: 5, playerA: 'Ferreres G.', playerB: 'Figueroa M.', ballPlayer: 'Ferreres G.' },
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
  return `p-novak-l3-${normalized}`;
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
  return `novak-l3-${String(index + 1).padStart(2, '0')}`;
}

function stageFor(): MatchStage {
  return 'group';
}

function ligaDoc(): Prisma.InputJsonValue {
  return {
    torneo: 'Novak Djokovic',
    liga: LEAGUE_NUM,
    grupos: groups,
    fechas: [
      {
        numero: 1,
        grupos: {
          A: ['Pusterla P. (P) vs Santi M.', 'Rusel S. (P) vs Bocchicchio F.', 'Libre: Repecka A.'],
          B: ['Marin G. (P) vs Fernandez B.', 'Casadio M. (P) vs Aguirre W.', 'Libre: Bianco D.'],
          C: ['Vito C. (P) vs Santi G.', 'Del Valle G. (P) vs Ferreres G.', 'Libre: Figueroa M.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Bocchicchio F. (P) vs Pusterla P.', 'Rusel S. (P) vs Repecka A.', 'Libre: Santi M.'],
          B: ['Aguirre W. (P) vs Marin G.', 'Casadio M. (P) vs Bianco D.', 'Libre: Fernandez B.'],
          C: ['Ferreres G. (P) vs Vito C.', 'Del Valle G. (P) vs Figueroa M.', 'Libre: Santi G.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Pusterla P. (P) vs Rusel S.', 'Repecka A. (P) vs Santi M.', 'Libre: Bocchicchio F.'],
          B: ['Marin G. (P) vs Casadio M.', 'Bianco D. (P) vs Fernandez B.', 'Libre: Aguirre W.'],
          C: ['Vito C. (P) vs Del Valle G.', 'Figueroa M. (P) vs Santi G.', 'Libre: Ferreres G.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Repecka A. (P) vs Pusterla P.', 'Santi M. (P) vs Bocchicchio F.', 'Libre: Rusel S.'],
          B: ['Bianco D. (P) vs Marin G.', 'Fernandez B. (P) vs Aguirre W.', 'Libre: Casadio M.'],
          C: ['Figueroa M. (P) vs Vito C.', 'Santi G. (P) vs Ferreres G.', 'Libre: Del Valle G.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Santi M. (P) vs Rusel S.', 'Bocchicchio F. (P) vs Repecka A.', 'Libre: Pusterla P.'],
          B: ['Fernandez B. (P) vs Casadio M.', 'Aguirre W. (P) vs Bianco D.', 'Libre: Marin G.'],
          C: ['Santi G. (P) vs Del Valle G.', 'Ferreres G. (P) vs Figueroa M.', 'Libre: Vito C.'],
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
        slug: 'novak-djokovic-liga-3',
        name: 'Novak Djokovic - Liga 3',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-06-30T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'novaknegro.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'novak-djokovic-liga-3',
        name: 'Novak Djokovic - Liga 3',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'novaknegro.webp',
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

  console.log(`Novak Djokovic - Liga 3: ${fixtures.length} partidos programados sin resultados.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
