import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-federer-l1';
const LEAGUE_NUM = 1;
const INTERZONAL_GROUP = 'Interzonal';

const groups = {
  A: ['Guareschi A.', 'Pfening G.', 'Rothkel M.', 'Naddeo M.'],
  B: ['Gaudina A.', 'Alvarez I.', 'Duarte D.', 'Repecka A.'],
  C: ['Garassi A.', 'Guidobono A.', 'Filosa M.', 'Rossi F.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Pfening G.', playerB: 'Guareschi A.', ballPlayer: 'Pfening G.' },
  { group: 'A', round: 1, playerA: 'Naddeo M.', playerB: 'Rothkel M.', ballPlayer: 'Naddeo M.' },
  { group: 'B', round: 1, playerA: 'Gaudina A.', playerB: 'Repecka A.', ballPlayer: 'Gaudina A.' },
  { group: 'B', round: 1, playerA: 'Alvarez I.', playerB: 'Duarte D.', ballPlayer: 'Alvarez I.' },
  { group: 'C', round: 1, playerA: 'Guidobono A.', playerB: 'Filosa M.', ballPlayer: 'Guidobono A.' },
  { group: 'C', round: 1, playerA: 'Rossi F.', playerB: 'Garassi A.', ballPlayer: 'Rossi F.' },
  { group: 'A', round: 2, playerA: 'Pfening G.', playerB: 'Naddeo M.', ballPlayer: 'Pfening G.' },
  { group: 'A', round: 2, playerA: 'Guareschi A.', playerB: 'Rothkel M.', ballPlayer: 'Guareschi A.' },
  { group: 'B', round: 2, playerA: 'Gaudina A.', playerB: 'Alvarez I.', ballPlayer: 'Gaudina A.' },
  { group: 'B', round: 2, playerA: 'Duarte D.', playerB: 'Repecka A.', ballPlayer: 'Duarte D.' },
  { group: 'C', round: 2, playerA: 'Rossi F.', playerB: 'Guidobono A.', ballPlayer: 'Rossi F.' },
  { group: 'C', round: 2, playerA: 'Filosa M.', playerB: 'Garassi A.', ballPlayer: 'Filosa M.' },
  { group: 'A', round: 3, playerA: 'Rothkel M.', playerB: 'Pfening G.', ballPlayer: 'Rothkel M.' },
  { group: 'A', round: 3, playerA: 'Guareschi A.', playerB: 'Naddeo M.', ballPlayer: 'Guareschi A.' },
  { group: 'B', round: 3, playerA: 'Duarte D.', playerB: 'Gaudina A.', ballPlayer: 'Duarte D.' },
  { group: 'B', round: 3, playerA: 'Repecka A.', playerB: 'Alvarez I.', ballPlayer: 'Repecka A.' },
  { group: 'C', round: 3, playerA: 'Garassi A.', playerB: 'Guidobono A.', ballPlayer: 'Garassi A.' },
  { group: 'C', round: 3, playerA: 'Rossi F.', playerB: 'Filosa M.', ballPlayer: 'Rossi F.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Guidobono A.', playerB: 'Guareschi A.', ballPlayer: 'Guidobono A.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Naddeo M.', playerB: 'Filosa M.', ballPlayer: 'Naddeo M.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Rothkel M.', playerB: 'Gaudina A.', ballPlayer: 'Rothkel M.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Repecka A.', playerB: 'Pfening G.', ballPlayer: 'Repecka A.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Duarte D.', playerB: 'Rossi F.', ballPlayer: 'Duarte D.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Garassi A.', playerB: 'Alvarez I.', ballPlayer: 'Garassi A.' },
];

const createdPlayers: string[] = [];
const existingPlayers: string[] = [];

function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isRepeckaInitial(name: string, initial: 'a' | 'j'): boolean {
  const n = normName(name);
  return n.startsWith('repecka') && n.includes(` ${initial}.`);
}

function fallbackPlayerId(name: string): string {
  const normalized = normName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `p-federer-l1-${normalized}`;
}

const playerIdCache = new Map<string, string>();

async function resolvePlayerId(name: string): Promise<string> {
  const key = normName(name);
  const cached = playerIdCache.get(key);
  if (cached) return cached;

  const all = await prisma.player.findMany({
    select: { id: true, name: true, displayName: true },
  });
  const hit = all.find((p) => {
    const pn = normName(p.name);
    const pd = normName(p.displayName ?? '');
    const matches = pn === key || pd === key;
    if (!matches) return false;
    if (isRepeckaInitial(name, 'a') && (isRepeckaInitial(p.name, 'j') || isRepeckaInitial(p.displayName ?? '', 'j'))) {
      return false;
    }
    if (isRepeckaInitial(name, 'j') && (isRepeckaInitial(p.name, 'a') || isRepeckaInitial(p.displayName ?? '', 'a'))) {
      return false;
    }
    return true;
  });
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
    createdPlayers.push(name);
  } else {
    existingPlayers.push(name);
  }
  playerIdCache.set(key, id);
  return id;
}

function dedupeKey(m: Pick<SeedMatch, 'group' | 'round' | 'playerA' | 'playerB'>): string {
  return `${TOURNAMENT_ID}|${m.round}|${m.group}|${normName(m.playerA)}|${normName(m.playerB)}`;
}

function matchId(index: number): string {
  return `federer-l1-${String(index + 1).padStart(2, '0')}`;
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
    torneo: 'Roger Federer',
    liga: LEAGUE_NUM,
    grupos: groups,
    fechas: [
      {
        numero: 1,
        grupos: {
          A: ['Pfening G. (P) vs Guareschi A.', 'Naddeo M. (P) vs Rothkel M.'],
          B: ['Gaudina A. (P) vs Repecka A.', 'Alvarez I. (P) vs Duarte D.'],
          C: ['Guidobono A. (P) vs Filosa M.', 'Rossi F. (P) vs Garassi A.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Pfening G. (P) vs Naddeo M.', 'Guareschi A. (P) vs Rothkel M.'],
          B: ['Gaudina A. (P) vs Alvarez I.', 'Duarte D. (P) vs Repecka A.'],
          C: ['Rossi F. (P) vs Guidobono A.', 'Filosa M. (P) vs Garassi A.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Rothkel M. (P) vs Pfening G.', 'Guareschi A. (P) vs Naddeo M.'],
          B: ['Duarte D. (P) vs Gaudina A.', 'Repecka A. (P) vs Alvarez I.'],
          C: ['Garassi A. (P) vs Guidobono A.', 'Rossi F. (P) vs Filosa M.'],
        },
      },
      {
        numero: 4,
        tipo: 'interzonal',
        partidos: [
          'Guidobono A. (P) vs Guareschi A.',
          'Naddeo M. (P) vs Filosa M.',
          'Rothkel M. (P) vs Gaudina A.',
          'Repecka A. (P) vs Pfening G.',
          'Duarte D. (P) vs Rossi F.',
          'Garassi A. (P) vs Alvarez I.',
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
        slug: 'roger-federer-liga-1',
        name: 'Roger Federer - Liga 1',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'roger-liga1.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'roger-federer-liga-1',
        name: 'Roger Federer - Liga 1',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'roger-liga1.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
    });

    const league = await tx.tournamentLeague.upsert({
      where: { tournamentId_leagueNum: { tournamentId: TOURNAMENT_ID, leagueNum: LEAGUE_NUM } },
      create: { tournamentId: TOURNAMENT_ID, leagueNum: LEAGUE_NUM, groupStageStatus: 'open' },
      update: { groupStageStatus: 'open' },
    });

    const groupIds = new Map<string, string>();
    for (const [key, names] of Object.entries(groups)) {
      const group = await tx.group.upsert({
        where: { tournamentId_key: { tournamentId: TOURNAMENT_ID, key } },
        create: { tournamentId: TOURNAMENT_ID, key, displayName: `Grupo ${key}` },
        update: { displayName: `Grupo ${key}` },
      });
      groupIds.set(key, group.id);
      for (const [index, pname] of names.entries()) {
        const pid = playerId(pname);
        await tx.groupPlayer.upsert({
          where: { groupId_playerId: { groupId: group.id, playerId: pid } },
          create: { groupId: group.id, playerId: pid, seed: index + 1 },
          update: { seed: index + 1 },
        });
      }
    }

    await tx.tournamentScheduleEntry.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });

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

      await tx.tournamentScheduleEntry.create({
        data: {
          dedupeKey: dedupeKey(row),
          tournamentId: TOURNAMENT_ID,
          leagueNum: LEAGUE_NUM,
          scheduleStatus: 'unscheduled',
          date: null,
          time: null,
          note,
        },
      });
    }

    await tx.matchResult.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  });

  const ranking = await recalculateRankings(prisma);

  console.log(`Roger Federer - Liga 1: ${fixtures.length} partidos programados sin resultados.`);
  console.log(`Jugadores creados (${createdPlayers.length}): ${createdPlayers.sort().join(', ') || '—'}`);
  console.log(`Jugadores existentes (${existingPlayers.length}): ${existingPlayers.sort().join(', ') || '—'}`);
  console.log(`Ranking recalculado: ${ranking.rowsWritten} filas.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
