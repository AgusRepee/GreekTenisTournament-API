import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TOURNAMENT_ID = 't-rafa-nadal';
const LEAGUE_NUM = 2;

const groups = {
  A: ['Colomer S.', 'Masciotra J.', 'Santi G.', 'Sarquis P.', 'Molina L.'],
  B: ['Ferdkin B.', 'Mayer D.', 'Komesu M.', 'Cancio M.', 'Repecka A.'],
  C: ['Guareschi A.', 'Urbini A.', 'Fusto B.', 'Monzón M.', 'Ruiz J.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Masciotra J.', playerB: 'Santi G.', ballPlayer: 'Masciotra J.' },
  { group: 'A', round: 1, playerA: 'Colomer S.', playerB: 'Sarquis P.', ballPlayer: 'Colomer S.' },
  { group: 'A', round: 2, playerA: 'Sarquis P.', playerB: 'Masciotra J.', ballPlayer: 'Sarquis P.' },
  { group: 'A', round: 2, playerA: 'Colomer S.', playerB: 'Molina L.', ballPlayer: 'Colomer S.' },
  { group: 'A', round: 3, playerA: 'Masciotra J.', playerB: 'Colomer S.', ballPlayer: 'Masciotra J.' },
  { group: 'A', round: 3, playerA: 'Molina L.', playerB: 'Santi G.', ballPlayer: 'Molina L.' },
  { group: 'A', round: 4, playerA: 'Molina L.', playerB: 'Masciotra J.', ballPlayer: 'Molina L.' },
  { group: 'A', round: 4, playerA: 'Santi G.', playerB: 'Sarquis P.', ballPlayer: 'Santi G.' },
  { group: 'A', round: 5, playerA: 'Santi G.', playerB: 'Colomer S.', ballPlayer: 'Santi G.' },
  { group: 'A', round: 5, playerA: 'Sarquis P.', playerB: 'Molina L.', ballPlayer: 'Sarquis P.' },
  { group: 'B', round: 1, playerA: 'Ferdkin B.', playerB: 'Cancio M.', ballPlayer: 'Ferdkin B.' },
  { group: 'B', round: 1, playerA: 'Komesu M.', playerB: 'Repecka A.', ballPlayer: 'Komesu M.' },
  { group: 'B', round: 2, playerA: 'Repecka A.', playerB: 'Ferdkin B.', ballPlayer: 'Repecka A.' },
  { group: 'B', round: 2, playerA: 'Komesu M.', playerB: 'Mayer D.', ballPlayer: 'Komesu M.' },
  { group: 'B', round: 3, playerA: 'Ferdkin B.', playerB: 'Komesu M.', ballPlayer: 'Ferdkin B.' },
  { group: 'B', round: 3, playerA: 'Mayer D.', playerB: 'Cancio M.', ballPlayer: 'Mayer D.' },
  { group: 'B', round: 4, playerA: 'Mayer D.', playerB: 'Ferdkin B.', ballPlayer: 'Mayer D.' },
  { group: 'B', round: 4, playerA: 'Cancio M.', playerB: 'Repecka A.', ballPlayer: 'Cancio M.' },
  { group: 'B', round: 5, playerA: 'Cancio M.', playerB: 'Komesu M.', ballPlayer: 'Cancio M.' },
  { group: 'B', round: 5, playerA: 'Repecka A.', playerB: 'Mayer D.', ballPlayer: 'Repecka A.' },
  { group: 'C', round: 1, playerA: 'Guareschi A.', playerB: 'Urbini A.', ballPlayer: 'Guareschi A.' },
  { group: 'C', round: 1, playerA: 'Fusto B.', playerB: 'Monzón M.', ballPlayer: 'Fusto B.' },
  { group: 'C', round: 2, playerA: 'Monzón M.', playerB: 'Guareschi A.', ballPlayer: 'Monzón M.' },
  { group: 'C', round: 2, playerA: 'Fusto B.', playerB: 'Ruiz J.', ballPlayer: 'Fusto B.' },
  { group: 'C', round: 3, playerA: 'Guareschi A.', playerB: 'Fusto B.', ballPlayer: 'Guareschi A.' },
  { group: 'C', round: 3, playerA: 'Ruiz J.', playerB: 'Urbini A.', ballPlayer: 'Ruiz J.' },
  { group: 'C', round: 4, playerA: 'Ruiz J.', playerB: 'Guareschi A.', ballPlayer: 'Ruiz J.' },
  { group: 'C', round: 4, playerA: 'Urbini A.', playerB: 'Monzón M.', ballPlayer: 'Urbini A.' },
  { group: 'C', round: 5, playerA: 'Urbini A.', playerB: 'Fusto B.', ballPlayer: 'Urbini A.' },
  { group: 'C', round: 5, playerA: 'Monzón M.', playerB: 'Ruiz J.', ballPlayer: 'Monzón M.' },
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
  return `p-rafa-l2-${normalized}`;
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
  }
  playerIdCache.set(key, id);
  return id;
}

function dedupeKey(m: Pick<SeedMatch, 'group' | 'round' | 'playerA' | 'playerB'>): string {
  return `${TOURNAMENT_ID}|${m.round}|${m.group}|${normName(m.playerA)}|${normName(m.playerB)}`;
}

function matchId(index: number): string {
  return `rafa-l2-${String(index + 1).padStart(2, '0')}`;
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
          A: ['Masciotra J. (P) vs Santi G.', 'Colomer S. (P) vs Sarquis P.', 'Libre: Molina L.'],
          B: ['Ferdkin B. (P) vs Cancio M.', 'Komesu M. (P) vs Repecka A.', 'Libre: Mayer D.'],
          C: ['Guareschi A. (P) vs Urbini A.', 'Fusto B. (P) vs Monzón M.', 'Libre: Ruiz J.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Sarquis P. (P) vs Masciotra J.', 'Colomer S. (P) vs Molina L.', 'Libre: Santi G.'],
          B: ['Repecka A. (P) vs Ferdkin B.', 'Komesu M. (P) vs Mayer D.', 'Libre: Cancio M.'],
          C: ['Monzón M. (P) vs Guareschi A.', 'Fusto B. (P) vs Ruiz J.', 'Libre: Urbini A.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Masciotra J. (P) vs Colomer S.', 'Molina L. (P) vs Santi G.', 'Libre: Sarquis P.'],
          B: ['Ferdkin B. (P) vs Komesu M.', 'Mayer D. (P) vs Cancio M.', 'Libre: Repecka A.'],
          C: ['Guareschi A. (P) vs Fusto B.', 'Ruiz J. (P) vs Urbini A.', 'Libre: Monzón M.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Molina L. (P) vs Masciotra J.', 'Santi G. (P) vs Sarquis P.', 'Libre: Colomer S.'],
          B: ['Mayer D. (P) vs Ferdkin B.', 'Cancio M. (P) vs Repecka A.', 'Libre: Komesu M.'],
          C: ['Ruiz J. (P) vs Guareschi A.', 'Urbini A. (P) vs Monzón M.', 'Libre: Fusto B.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Santi G. (P) vs Colomer S.', 'Sarquis P. (P) vs Molina L.', 'Libre: Masciotra J.'],
          B: ['Cancio M. (P) vs Komesu M.', 'Repecka A. (P) vs Mayer D.', 'Libre: Ferdkin B.'],
          C: ['Urbini A. (P) vs Fusto B.', 'Monzón M. (P) vs Ruiz J.', 'Libre: Guareschi A.'],
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
        slug: 'rafael-nadal-liga-2',
        name: 'Rafael Nadal - Liga 2',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-05-26T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'rafa-naranja.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'rafael-nadal-liga-2',
        name: 'Rafael Nadal - Liga 2',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'rafa-naranja.webp',
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

  console.log(`Rafael Nadal - Liga 2: ${fixtures.length} partidos programados sin resultados.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
