import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TOURNAMENT_ID = 't-novak';
const LEAGUE_NUM = 1;

const groups = {
  A: ['Pfening G.', 'Alvarez I.', 'Tacain R.', 'Arico S.', 'Guidobono A.'],
  B: ['Garassi A.', 'Rothkel M.', 'Zanella H.', 'Duarte D.', 'Naddeo M.'],
  C: ['Gaudina A.', 'Cordoba D.', 'Filosa M.', 'Mena C.', 'Novizki P.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Pfening G.', playerB: 'Alvarez I.', ballPlayer: 'Pfening G.' },
  { group: 'A', round: 1, playerA: 'Tacain R.', playerB: 'Arico S.', ballPlayer: 'Tacain R.' },
  { group: 'A', round: 2, playerA: 'Arico S.', playerB: 'Pfening G.', ballPlayer: 'Arico S.' },
  { group: 'A', round: 2, playerA: 'Tacain R.', playerB: 'Guidobono A.', ballPlayer: 'Tacain R.' },
  { group: 'A', round: 3, playerA: 'Pfening G.', playerB: 'Tacain R.', ballPlayer: 'Pfening G.' },
  { group: 'A', round: 3, playerA: 'Guidobono A.', playerB: 'Alvarez I.', ballPlayer: 'Guidobono A.' },
  { group: 'A', round: 4, playerA: 'Guidobono A.', playerB: 'Pfening G.', ballPlayer: 'Guidobono A.' },
  { group: 'A', round: 4, playerA: 'Alvarez I.', playerB: 'Arico S.', ballPlayer: 'Alvarez I.' },
  { group: 'A', round: 5, playerA: 'Alvarez I.', playerB: 'Tacain R.', ballPlayer: 'Alvarez I.' },
  { group: 'A', round: 5, playerA: 'Arico S.', playerB: 'Guidobono A.', ballPlayer: 'Arico S.' },
  { group: 'B', round: 1, playerA: 'Garassi A.', playerB: 'Rothkel M.', ballPlayer: 'Garassi A.' },
  { group: 'B', round: 1, playerA: 'Naddeo M.', playerB: 'Zanella H.', ballPlayer: 'Naddeo M.' },
  { group: 'B', round: 2, playerA: 'Zanella H.', playerB: 'Garassi A.', ballPlayer: 'Zanella H.' },
  { group: 'B', round: 2, playerA: 'Naddeo M.', playerB: 'Duarte D.', ballPlayer: 'Naddeo M.' },
  { group: 'B', round: 3, playerA: 'Garassi A.', playerB: 'Naddeo M.', ballPlayer: 'Garassi A.' },
  { group: 'B', round: 3, playerA: 'Duarte D.', playerB: 'Rothkel M.', ballPlayer: 'Duarte D.' },
  { group: 'B', round: 4, playerA: 'Duarte D.', playerB: 'Garassi A.', ballPlayer: 'Duarte D.' },
  { group: 'B', round: 4, playerA: 'Rothkel M.', playerB: 'Zanella H.', ballPlayer: 'Rothkel M.' },
  { group: 'B', round: 5, playerA: 'Rothkel M.', playerB: 'Naddeo M.', ballPlayer: 'Rothkel M.' },
  { group: 'B', round: 5, playerA: 'Zanella H.', playerB: 'Duarte D.', ballPlayer: 'Zanella H.' },
  { group: 'C', round: 1, playerA: 'Gaudina A.', playerB: 'Cordoba D.', ballPlayer: 'Gaudina A.' },
  { group: 'C', round: 1, playerA: 'Filosa M.', playerB: 'Mena C.', ballPlayer: 'Filosa M.' },
  { group: 'C', round: 2, playerA: 'Mena C.', playerB: 'Gaudina A.', ballPlayer: 'Mena C.' },
  { group: 'C', round: 2, playerA: 'Filosa M.', playerB: 'Novizki P.', ballPlayer: 'Filosa M.' },
  { group: 'C', round: 3, playerA: 'Gaudina A.', playerB: 'Filosa M.', ballPlayer: 'Gaudina A.' },
  { group: 'C', round: 3, playerA: 'Novizki P.', playerB: 'Cordoba D.', ballPlayer: 'Novizki P.' },
  { group: 'C', round: 4, playerA: 'Novizki P.', playerB: 'Gaudina A.', ballPlayer: 'Novizki P.' },
  { group: 'C', round: 4, playerA: 'Cordoba D.', playerB: 'Mena C.', ballPlayer: 'Cordoba D.' },
  { group: 'C', round: 5, playerA: 'Cordoba D.', playerB: 'Filosa M.', ballPlayer: 'Cordoba D.' },
  { group: 'C', round: 5, playerA: 'Mena C.', playerB: 'Novizki P.', ballPlayer: 'Mena C.' },
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
  return `p-novak-l1-${normalized}`;
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
        category: 'Primera',
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
  return `novak-l1-${String(index + 1).padStart(2, '0')}`;
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
          A: ['Pfening G. (P) vs Alvarez I.', 'Tacain R. (P) vs Arico S.', 'Libre: Guidobono A.'],
          B: ['Garassi A. (P) vs Rothkel M.', 'Naddeo M. (P) vs Zanella H.', 'Libre: Duarte D.'],
          C: ['Gaudina A. (P) vs Cordoba D.', 'Filosa M. (P) vs Mena C.', 'Libre: Novizki P.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Arico S. (P) vs Pfening G.', 'Tacain R. (P) vs Guidobono A.', 'Libre: Alvarez I.'],
          B: ['Zanella H. (P) vs Garassi A.', 'Naddeo M. (P) vs Duarte D.', 'Libre: Rothkel M.'],
          C: ['Mena C. (P) vs Gaudina A.', 'Filosa M. (P) vs Novizki P.', 'Libre: Cordoba D.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Pfening G. (P) vs Tacain R.', 'Guidobono A. (P) vs Alvarez I.', 'Libre: Arico S.'],
          B: ['Garassi A. (P) vs Naddeo M.', 'Duarte D. (P) vs Rothkel M.', 'Libre: Zanella H.'],
          C: ['Gaudina A. (P) vs Filosa M.', 'Novizki P. (P) vs Cordoba D.', 'Libre: Mena C.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Guidobono A. (P) vs Pfening G.', 'Alvarez I. (P) vs Arico S.', 'Libre: Tacain R.'],
          B: ['Duarte D. (P) vs Garassi A.', 'Rothkel M. (P) vs Zanella H.', 'Libre: Naddeo M.'],
          C: ['Novizki P. (P) vs Gaudina A.', 'Cordoba D. (P) vs Mena C.', 'Libre: Filosa M.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Alvarez I. (P) vs Tacain R.', 'Arico S. (P) vs Guidobono A.', 'Libre: Pfening G.'],
          B: ['Rothkel M. (P) vs Naddeo M.', 'Zanella H. (P) vs Duarte D.', 'Libre: Garassi A.'],
          C: ['Cordoba D. (P) vs Filosa M.', 'Mena C. (P) vs Novizki P.', 'Libre: Gaudina A.'],
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
        slug: 'novak-djokovic-liga-1',
        name: 'Novak Djokovic - Liga 1',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'novaknegro.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'novak-djokovic-liga-1',
        name: 'Novak Djokovic - Liga 1',
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

  console.log(`Novak Djokovic - Liga 1: ${fixtures.length} partidos programados sin resultados.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
