import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TOURNAMENT_ID = 't-rafael-nadal-l1';
const LEAGUE_NUM = 1;
const INTERZONAL_GROUP = 'Interzonal';

const groups = {
  A: ['Gaudina A.', 'Filosa M.', 'Guidobono A.', 'Duarte D.'],
  B: ['Garassi A.', 'Tacain R.', 'Rothkel M.', 'Lacave L.'],
  C: ['Pfening G.', 'Zanella H.', 'Alvarez I.', 'Naddeo M.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Gaudina A.', playerB: 'Guidobono A.', ballPlayer: 'Gaudina A.' },
  { group: 'A', round: 1, playerA: 'Filosa M.', playerB: 'Duarte D.', ballPlayer: 'Filosa M.' },
  { group: 'A', round: 2, playerA: 'Gaudina A.', playerB: 'Filosa M.', ballPlayer: 'Gaudina A.' },
  { group: 'A', round: 2, playerA: 'Duarte D.', playerB: 'Guidobono A.', ballPlayer: 'Duarte D.' },
  { group: 'A', round: 3, playerA: 'Duarte D.', playerB: 'Gaudina A.', ballPlayer: 'Duarte D.' },
  { group: 'A', round: 3, playerA: 'Guidobono A.', playerB: 'Filosa M.', ballPlayer: 'Guidobono A.' },
  { group: 'B', round: 1, playerA: 'Lacave L.', playerB: 'Tacain R.', ballPlayer: 'Lacave L.' },
  { group: 'B', round: 1, playerA: 'Rothkel M.', playerB: 'Garassi A.', ballPlayer: 'Rothkel M.' },
  { group: 'B', round: 2, playerA: 'Rothkel M.', playerB: 'Lacave L.', ballPlayer: 'Rothkel M.' },
  { group: 'B', round: 2, playerA: 'Tacain R.', playerB: 'Garassi A.', ballPlayer: 'Tacain R.' },
  { group: 'B', round: 3, playerA: 'Garassi A.', playerB: 'Lacave L.', ballPlayer: 'Garassi A.' },
  { group: 'B', round: 3, playerA: 'Rothkel M.', playerB: 'Tacain R.', ballPlayer: 'Rothkel M.' },
  { group: 'C', round: 1, playerA: 'Pfening G.', playerB: 'Alvarez I.', ballPlayer: 'Pfening G.' },
  { group: 'C', round: 1, playerA: 'Naddeo M.', playerB: 'Zanella H.', ballPlayer: 'Naddeo M.' },
  { group: 'C', round: 2, playerA: 'Pfening G.', playerB: 'Naddeo M.', ballPlayer: 'Pfening G.' },
  { group: 'C', round: 2, playerA: 'Alvarez I.', playerB: 'Zanella H.', ballPlayer: 'Alvarez I.' },
  { group: 'C', round: 3, playerA: 'Zanella H.', playerB: 'Pfening G.', ballPlayer: 'Zanella H.' },
  { group: 'C', round: 3, playerA: 'Alvarez I.', playerB: 'Naddeo M.', ballPlayer: 'Alvarez I.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Zanella H.', playerB: 'Gaudina A.', ballPlayer: 'Zanella H.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Guidobono A.', playerB: 'Pfening G.', ballPlayer: 'Guidobono A.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Filosa M.', playerB: 'Rothkel M.', ballPlayer: 'Filosa M.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Garassi A.', playerB: 'Duarte D.', ballPlayer: 'Garassi A.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Lacave L.', playerB: 'Alvarez I.', ballPlayer: 'Lacave L.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Naddeo M.', playerB: 'Tacain R.', ballPlayer: 'Naddeo M.' },
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
  return `p-rafael-l1-${normalized}`;
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
  return `rafael-l1-${String(index + 1).padStart(2, '0')}`;
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
          A: ['Gaudina A. (P) vs Guidobono A.', 'Filosa M. (P) vs Duarte D.'],
          B: ['Lacave L. (P) vs Tacain R.', 'Rothkel M. (P) vs Garassi A.'],
          C: ['Pfening G. (P) vs Alvarez I.', 'Naddeo M. (P) vs Zanella H.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Gaudina A. (P) vs Filosa M.', 'Duarte D. (P) vs Guidobono A.'],
          B: ['Rothkel M. (P) vs Lacave L.', 'Tacain R. (P) vs Garassi A.'],
          C: ['Pfening G. (P) vs Naddeo M.', 'Alvarez I. (P) vs Zanella H.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Duarte D. (P) vs Gaudina A.', 'Guidobono A. (P) vs Filosa M.'],
          B: ['Garassi A. (P) vs Lacave L.', 'Rothkel M. (P) vs Tacain R.'],
          C: ['Zanella H. (P) vs Pfening G.', 'Alvarez I. (P) vs Naddeo M.'],
        },
      },
      {
        numero: 4,
        tipo: 'interzonal',
        partidos: [
          'Zanella H. (P) vs Gaudina A.',
          'Guidobono A. (P) vs Pfening G.',
          'Filosa M. (P) vs Rothkel M.',
          'Garassi A. (P) vs Duarte D.',
          'Lacave L. (P) vs Alvarez I.',
          'Naddeo M. (P) vs Tacain R.',
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
        slug: 'rafael-nadal-liga-1',
        name: 'Rafael Nadal - Liga 1',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-05-27T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis — Pistas centrales',
        coverImage: 'rafa-violeta.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'rafael-nadal-liga-1',
        name: 'Rafael Nadal - Liga 1',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis — Pistas centrales',
        coverImage: 'rafa-violeta.webp',
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

  console.log(`Rafael Nadal - Liga 1: ${fixtures.length} partidos programados sin resultados.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
