import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-federer-l5';
const LEAGUE_NUM = 5;
const INTERZONAL_GROUP = 'Interzonal';

const groups = {
  A: ['Gimenez F.', 'Merlo S.', 'Chantada S.', 'Vila E.'],
  B: ['Tellechea L.', 'Cirigliano D.', 'Sola M.', 'Oswald J.'],
  C: ['Antuña A.', 'Peralta G.', 'Avalos G.', 'Cellilli M.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Gimenez F.', playerB: 'Merlo S.', ballPlayer: 'Gimenez F.' },
  { group: 'A', round: 1, playerA: 'Chantada S.', playerB: 'Vila E.', ballPlayer: 'Chantada S.' },
  { group: 'B', round: 1, playerA: 'Tellechea L.', playerB: 'Cirigliano D.', ballPlayer: 'Tellechea L.' },
  { group: 'B', round: 1, playerA: 'Sola M.', playerB: 'Oswald J.', ballPlayer: 'Sola M.' },
  { group: 'C', round: 1, playerA: 'Antuña A.', playerB: 'Peralta G.', ballPlayer: 'Antuña A.' },
  { group: 'C', round: 1, playerA: 'Avalos G.', playerB: 'Cellilli M.', ballPlayer: 'Avalos G.' },
  { group: 'A', round: 2, playerA: 'Gimenez F.', playerB: 'Chantada S.', ballPlayer: 'Gimenez F.' },
  { group: 'A', round: 2, playerA: 'Vila E.', playerB: 'Merlo S.', ballPlayer: 'Vila E.' },
  { group: 'B', round: 2, playerA: 'Sola M.', playerB: 'Tellechea L.', ballPlayer: 'Sola M.' },
  { group: 'B', round: 2, playerA: 'Cirigliano D.', playerB: 'Oswald J.', ballPlayer: 'Cirigliano D.' },
  { group: 'C', round: 2, playerA: 'Antuña A.', playerB: 'Avalos G.', ballPlayer: 'Antuña A.' },
  { group: 'C', round: 2, playerA: 'Peralta G.', playerB: 'Cellilli M.', ballPlayer: 'Peralta G.' },
  { group: 'A', round: 3, playerA: 'Vila E.', playerB: 'Gimenez F.', ballPlayer: 'Vila E.' },
  { group: 'A', round: 3, playerA: 'Merlo S.', playerB: 'Chantada S.', ballPlayer: 'Merlo S.' },
  { group: 'B', round: 3, playerA: 'Oswald J.', playerB: 'Tellechea L.', ballPlayer: 'Oswald J.' },
  { group: 'B', round: 3, playerA: 'Sola M.', playerB: 'Cirigliano D.', ballPlayer: 'Sola M.' },
  { group: 'C', round: 3, playerA: 'Cellilli M.', playerB: 'Antuña A.', ballPlayer: 'Cellilli M.' },
  { group: 'C', round: 3, playerA: 'Peralta G.', playerB: 'Avalos G.', ballPlayer: 'Peralta G.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Cellilli M.', playerB: 'Gimenez F.', ballPlayer: 'Cellilli M.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Merlo S.', playerB: 'Antuña A.', ballPlayer: 'Merlo S.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Chantada S.', playerB: 'Sola M.', ballPlayer: 'Chantada S.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Oswald J.', playerB: 'Vila E.', ballPlayer: 'Oswald J.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Tellechea L.', playerB: 'Peralta G.', ballPlayer: 'Tellechea L.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Avalos G.', playerB: 'Cirigliano D.', ballPlayer: 'Avalos G.' },
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

function isCellilliInitial(name: string, initial: 'm' | 'f'): boolean {
  const n = normName(name);
  return n.startsWith('cellilli') && n.includes(` ${initial}.`);
}

function fallbackPlayerId(name: string): string {
  const normalized = normName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `p-federer-l5-${normalized}`;
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
    if (isCellilliInitial(name, 'm') && (isCellilliInitial(p.name, 'f') || isCellilliInitial(p.displayName ?? '', 'f'))) {
      return false;
    }
    if (isCellilliInitial(name, 'f') && (isCellilliInitial(p.name, 'm') || isCellilliInitial(p.displayName ?? '', 'm'))) {
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
        category: 'Quinta A',
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
  return `federer-l5-${String(index + 1).padStart(2, '0')}`;
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
          A: ['Gimenez F. (P) vs Merlo S.', 'Chantada S. (P) vs Vila E.'],
          B: ['Tellechea L. (P) vs Cirigliano D.', 'Sola M. (P) vs Oswald J.'],
          C: ['Antuña A. (P) vs Peralta G.', 'Avalos G. (P) vs Cellilli M.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Gimenez F. (P) vs Chantada S.', 'Vila E. (P) vs Merlo S.'],
          B: ['Sola M. (P) vs Tellechea L.', 'Cirigliano D. (P) vs Oswald J.'],
          C: ['Antuña A. (P) vs Avalos G.', 'Peralta G. (P) vs Cellilli M.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Vila E. (P) vs Gimenez F.', 'Merlo S. (P) vs Chantada S.'],
          B: ['Oswald J. (P) vs Tellechea L.', 'Sola M. (P) vs Cirigliano D.'],
          C: ['Cellilli M. (P) vs Antuña A.', 'Peralta G. (P) vs Avalos G.'],
        },
      },
      {
        numero: 4,
        tipo: 'interzonal',
        partidos: [
          'Cellilli M. (P) vs Gimenez F.',
          'Merlo S. (P) vs Antuña A.',
          'Chantada S. (P) vs Sola M.',
          'Oswald J. (P) vs Vila E.',
          'Tellechea L. (P) vs Peralta G.',
          'Avalos G. (P) vs Cirigliano D.',
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
  const cellilliId = playerIdCache.get(normName('Cellilli M.'));
  const cellilliRow = cellilliId
    ? await prisma.player.findUnique({ where: { id: cellilliId }, select: { name: true, displayName: true } })
    : null;
  if (cellilliRow && isCellilliInitial(cellilliRow.name, 'f')) {
    throw new Error('Cellilli M. resolvió a Cellilli F.; abortando seed Liga 5.');
  }

  const playerId = (name: string) => playerIdCache.get(normName(name))!;

  await prisma.$transaction(async (tx) => {
    await tx.tournament.upsert({
      where: { id: TOURNAMENT_ID },
      create: {
        id: TOURNAMENT_ID,
        slug: 'roger-federer-liga-5',
        name: 'Roger Federer - Liga 5',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'roger-liga5.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'roger-federer-liga-5',
        name: 'Roger Federer - Liga 5',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'roger-liga5.webp',
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

  const ranking = await recalculateRankings(prisma);

  console.log(`Roger Federer - Liga 5: ${fixtures.length} partidos programados sin resultados.`);
  console.log(`Cellilli M. → id=${cellilliId}, nombre=${cellilliRow?.name ?? '?'}`);
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
