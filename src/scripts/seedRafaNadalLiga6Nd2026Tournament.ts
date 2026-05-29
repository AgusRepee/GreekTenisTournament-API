import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TOURNAMENT_ID = 't-rafa-nadal-l6';
const LEAGUE_NUM = 6;
const INTERZONAL_GROUP = 'Interzonal';

const groups = {
  A: ['Ballesta F.', 'De Ruyck G.', 'Cerene B.', 'Oshiro E.'],
  B: ['Ferrarotti E.', 'Fedrjanic N.', 'Fratini M.', 'Jaureguiberry C.'],
  C: ['Oswald J.', 'Avalos G.', 'Romay J.', 'Cellilli F.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Ballesta F.', playerB: 'De Ruyck G.', ballPlayer: 'Ballesta F.' },
  { group: 'A', round: 1, playerA: 'Cerene B.', playerB: 'Oshiro E.', ballPlayer: 'Cerene B.' },
  { group: 'A', round: 2, playerA: 'Ballesta F.', playerB: 'Cerene B.', ballPlayer: 'Ballesta F.' },
  { group: 'A', round: 2, playerA: 'Oshiro E.', playerB: 'De Ruyck G.', ballPlayer: 'Oshiro E.' },
  { group: 'A', round: 3, playerA: 'Oshiro E.', playerB: 'Ballesta F.', ballPlayer: 'Oshiro E.' },
  { group: 'A', round: 3, playerA: 'De Ruyck G.', playerB: 'Cerene B.', ballPlayer: 'De Ruyck G.' },
  { group: 'B', round: 1, playerA: 'Ferrarotti E.', playerB: 'Fedrjanic N.', ballPlayer: 'Ferrarotti E.' },
  { group: 'B', round: 1, playerA: 'Fratini M.', playerB: 'Jaureguiberry C.', ballPlayer: 'Fratini M.' },
  { group: 'B', round: 2, playerA: 'Fratini M.', playerB: 'Ferrarotti E.', ballPlayer: 'Fratini M.' },
  { group: 'B', round: 2, playerA: 'Fedrjanic N.', playerB: 'Jaureguiberry C.', ballPlayer: 'Fedrjanic N.' },
  { group: 'B', round: 3, playerA: 'Jaureguiberry C.', playerB: 'Ferrarotti E.', ballPlayer: 'Jaureguiberry C.' },
  { group: 'B', round: 3, playerA: 'Fedrjanic N.', playerB: 'Fratini M.', ballPlayer: 'Fedrjanic N.' },
  { group: 'C', round: 1, playerA: 'Oswald J.', playerB: 'Avalos G.', ballPlayer: 'Oswald J.' },
  { group: 'C', round: 1, playerA: 'Romay J.', playerB: 'Cellilli F.', ballPlayer: 'Romay J.' },
  { group: 'C', round: 2, playerA: 'Oswald J.', playerB: 'Romay J.', ballPlayer: 'Oswald J.' },
  { group: 'C', round: 2, playerA: 'Avalos G.', playerB: 'Cellilli F.', ballPlayer: 'Avalos G.' },
  { group: 'C', round: 3, playerA: 'Cellilli F.', playerB: 'Oswald J.', ballPlayer: 'Cellilli F.' },
  { group: 'C', round: 3, playerA: 'Avalos G.', playerB: 'Romay J.', ballPlayer: 'Avalos G.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Cellilli F.', playerB: 'Ballesta F.', ballPlayer: 'Cellilli F.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'De Ruyck G.', playerB: 'Oswald J.', ballPlayer: 'De Ruyck G.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Cerene B.', playerB: 'Fratini M.', ballPlayer: 'Cerene B.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Jaureguiberry C.', playerB: 'Oshiro E.', ballPlayer: 'Jaureguiberry C.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Ferrarotti E.', playerB: 'Avalos G.', ballPlayer: 'Ferrarotti E.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Romay J.', playerB: 'Fedrjanic N.', ballPlayer: 'Romay J.' },
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
  return `p-rafa-l6-${normalized}`;
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
        category: 'Quinta B',
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
  return `rafa-l6-${String(index + 1).padStart(2, '0')}`;
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
          A: ['Ballesta F. (P) vs De Ruyck G.', 'Cerene B. (P) vs Oshiro E.'],
          B: ['Ferrarotti E. (P) vs Fedrjanic N.', 'Fratini M. (P) vs Jaureguiberry C.'],
          C: ['Oswald J. (P) vs Avalos G.', 'Romay J. (P) vs Cellilli F.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Ballesta F. (P) vs Cerene B.', 'Oshiro E. (P) vs De Ruyck G.'],
          B: ['Fratini M. (P) vs Ferrarotti E.', 'Fedrjanic N. (P) vs Jaureguiberry C.'],
          C: ['Oswald J. (P) vs Romay J.', 'Avalos G. (P) vs Cellilli F.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Oshiro E. (P) vs Ballesta F.', 'De Ruyck G. (P) vs Cerene B.'],
          B: ['Jaureguiberry C. (P) vs Ferrarotti E.', 'Fedrjanic N. (P) vs Fratini M.'],
          C: ['Cellilli F. (P) vs Oswald J.', 'Avalos G. (P) vs Romay J.'],
        },
      },
      {
        numero: 4,
        tipo: 'interzonal',
        partidos: [
          'Cellilli F. (P) vs Ballesta F.',
          'De Ruyck G. (P) vs Oswald J.',
          'Cerene B. (P) vs Fratini M.',
          'Jaureguiberry C. (P) vs Oshiro E.',
          'Ferrarotti E. (P) vs Avalos G.',
          'Romay J. (P) vs Fedrjanic N.',
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
        slug: 'rafael-nadal-liga-6',
        name: 'Rafael Nadal - Liga 6',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-05-26T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'rafa-blanco.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'rafael-nadal-liga-6',
        name: 'Rafael Nadal - Liga 6',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'rafa-blanco.webp',
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

  console.log(`Rafael Nadal - Liga 6: ${fixtures.length} partidos programados sin resultados.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
