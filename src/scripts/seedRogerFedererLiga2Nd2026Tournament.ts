import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-federer-l2';
const LEAGUE_NUM = 2;
const INTERZONAL_GROUP = 'Interzonal';

const groups = {
  A: ['Casais R.', 'Urbini A.', 'Fernandez B.', 'Cancio M.'],
  B: ['Ferdkin B.', 'Masciotra J.', 'Komesu M.', 'Marin G.'],
  C: ['Santi G.', 'Mayer D.', 'Monzon M.', 'Andrioli M.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Casais R.', playerB: 'Urbini A.', ballPlayer: 'Casais R.' },
  { group: 'A', round: 1, playerA: 'Fernandez B.', playerB: 'Cancio M.', ballPlayer: 'Fernandez B.' },
  { group: 'B', round: 1, playerA: 'Ferdkin B.', playerB: 'Komesu M.', ballPlayer: 'Ferdkin B.' },
  { group: 'B', round: 1, playerA: 'Masciotra J.', playerB: 'Marin G.', ballPlayer: 'Masciotra J.' },
  { group: 'C', round: 1, playerA: 'Santi G.', playerB: 'Mayer D.', ballPlayer: 'Santi G.' },
  { group: 'C', round: 1, playerA: 'Monzon M.', playerB: 'Andrioli M.', ballPlayer: 'Monzon M.' },
  { group: 'A', round: 2, playerA: 'Casais R.', playerB: 'Fernandez B.', ballPlayer: 'Casais R.' },
  { group: 'A', round: 2, playerA: 'Cancio M.', playerB: 'Urbini A.', ballPlayer: 'Cancio M.' },
  { group: 'B', round: 2, playerA: 'Masciotra J.', playerB: 'Ferdkin B.', ballPlayer: 'Masciotra J.' },
  { group: 'B', round: 2, playerA: 'Komesu M.', playerB: 'Marin G.', ballPlayer: 'Komesu M.' },
  { group: 'C', round: 2, playerA: 'Santi G.', playerB: 'Monzon M.', ballPlayer: 'Santi G.' },
  { group: 'C', round: 2, playerA: 'Mayer D.', playerB: 'Andrioli M.', ballPlayer: 'Mayer D.' },
  { group: 'A', round: 3, playerA: 'Cancio M.', playerB: 'Casais R.', ballPlayer: 'Cancio M.' },
  { group: 'A', round: 3, playerA: 'Urbini A.', playerB: 'Fernandez B.', ballPlayer: 'Urbini A.' },
  { group: 'B', round: 3, playerA: 'Marin G.', playerB: 'Ferdkin B.', ballPlayer: 'Marin G.' },
  { group: 'B', round: 3, playerA: 'Masciotra J.', playerB: 'Komesu M.', ballPlayer: 'Masciotra J.' },
  { group: 'C', round: 3, playerA: 'Andrioli M.', playerB: 'Santi G.', ballPlayer: 'Andrioli M.' },
  { group: 'C', round: 3, playerA: 'Mayer D.', playerB: 'Monzon M.', ballPlayer: 'Mayer D.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Andrioli M.', playerB: 'Casais R.', ballPlayer: 'Andrioli M.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Urbini A.', playerB: 'Santi G.', ballPlayer: 'Urbini A.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Cancio M.', playerB: 'Masciotra J.', ballPlayer: 'Cancio M.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Marin G.', playerB: 'Fernandez B.', ballPlayer: 'Marin G.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Ferdkin B.', playerB: 'Mayer D.', ballPlayer: 'Ferdkin B.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Monzon M.', playerB: 'Komesu M.', ballPlayer: 'Monzon M.' },
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

function fallbackPlayerId(name: string): string {
  const normalized = normName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `p-federer-l2-${normalized}`;
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
        category: 'Segunda',
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
  return `federer-l2-${String(index + 1).padStart(2, '0')}`;
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
          A: ['Casais R. (P) vs Urbini A.', 'Fernandez B. (P) vs Cancio M.'],
          B: ['Ferdkin B. (P) vs Komesu M.', 'Masciotra J. (P) vs Marin G.'],
          C: ['Santi G. (P) vs Mayer D.', 'Monzon M. (P) vs Andrioli M.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Casais R. (P) vs Fernandez B.', 'Cancio M. (P) vs Urbini A.'],
          B: ['Masciotra J. (P) vs Ferdkin B.', 'Komesu M. (P) vs Marin G.'],
          C: ['Santi G. (P) vs Monzon M.', 'Mayer D. (P) vs Andrioli M.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Cancio M. (P) vs Casais R.', 'Urbini A. (P) vs Fernandez B.'],
          B: ['Marin G. (P) vs Ferdkin B.', 'Masciotra J. (P) vs Komesu M.'],
          C: ['Andrioli M. (P) vs Santi G.', 'Mayer D. (P) vs Monzon M.'],
        },
      },
      {
        numero: 4,
        tipo: 'interzonal',
        partidos: [
          'Andrioli M. (P) vs Casais R.',
          'Urbini A. (P) vs Santi G.',
          'Cancio M. (P) vs Masciotra J.',
          'Marin G. (P) vs Fernandez B.',
          'Ferdkin B. (P) vs Mayer D.',
          'Monzon M. (P) vs Komesu M.',
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
        slug: 'roger-federer-liga-2',
        name: 'Roger Federer - Liga 2',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'roger-liga2.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'roger-federer-liga-2',
        name: 'Roger Federer - Liga 2',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'roger-liga2.webp',
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

  console.log(`Roger Federer - Liga 2: ${fixtures.length} partidos programados sin resultados.`);
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
