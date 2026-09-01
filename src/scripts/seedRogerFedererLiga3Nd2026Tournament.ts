import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-federer-l3';
const LEAGUE_NUM = 3;

const groups = {
  A: ['Santi Mat.', 'Vito C.', 'Bernardini G.', 'Figueroa M.', 'Komesu F.'],
  B: ['Gadea M.', 'Santi Mar.', 'Bianco D.', 'Bocchicchio F.', 'Cordoba G.'],
  C: ['Ferreres G.', 'Rusel S.', 'Del Valle G.', 'Rojas L.', 'Aguirre W.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Santi Mat.', playerB: 'Vito C.', ballPlayer: 'Santi Mat.' },
  { group: 'A', round: 1, playerA: 'Bernardini G.', playerB: 'Figueroa M.', ballPlayer: 'Bernardini G.' },
  { group: 'B', round: 1, playerA: 'Gadea M.', playerB: 'Santi Mar.', ballPlayer: 'Gadea M.' },
  { group: 'B', round: 1, playerA: 'Bianco D.', playerB: 'Bocchicchio F.', ballPlayer: 'Bianco D.' },
  { group: 'C', round: 1, playerA: 'Ferreres G.', playerB: 'Rusel S.', ballPlayer: 'Ferreres G.' },
  { group: 'C', round: 1, playerA: 'Del Valle G.', playerB: 'Rojas L.', ballPlayer: 'Del Valle G.' },
  { group: 'A', round: 2, playerA: 'Figueroa M.', playerB: 'Santi Mat.', ballPlayer: 'Figueroa M.' },
  { group: 'A', round: 2, playerA: 'Bernardini G.', playerB: 'Komesu F.', ballPlayer: 'Bernardini G.' },
  { group: 'B', round: 2, playerA: 'Bocchicchio F.', playerB: 'Gadea M.', ballPlayer: 'Bocchicchio F.' },
  { group: 'B', round: 2, playerA: 'Bianco D.', playerB: 'Cordoba G.', ballPlayer: 'Bianco D.' },
  { group: 'C', round: 2, playerA: 'Rojas L.', playerB: 'Ferreres G.', ballPlayer: 'Rojas L.' },
  { group: 'C', round: 2, playerA: 'Del Valle G.', playerB: 'Aguirre W.', ballPlayer: 'Del Valle G.' },
  { group: 'A', round: 3, playerA: 'Santi Mat.', playerB: 'Bernardini G.', ballPlayer: 'Santi Mat.' },
  { group: 'A', round: 3, playerA: 'Komesu F.', playerB: 'Vito C.', ballPlayer: 'Komesu F.' },
  { group: 'B', round: 3, playerA: 'Gadea M.', playerB: 'Bianco D.', ballPlayer: 'Gadea M.' },
  { group: 'B', round: 3, playerA: 'Cordoba G.', playerB: 'Santi Mar.', ballPlayer: 'Cordoba G.' },
  { group: 'C', round: 3, playerA: 'Ferreres G.', playerB: 'Del Valle G.', ballPlayer: 'Ferreres G.' },
  { group: 'C', round: 3, playerA: 'Aguirre W.', playerB: 'Rusel S.', ballPlayer: 'Aguirre W.' },
  { group: 'A', round: 4, playerA: 'Komesu F.', playerB: 'Santi Mat.', ballPlayer: 'Komesu F.' },
  { group: 'A', round: 4, playerA: 'Vito C.', playerB: 'Figueroa M.', ballPlayer: 'Vito C.' },
  { group: 'B', round: 4, playerA: 'Cordoba G.', playerB: 'Gadea M.', ballPlayer: 'Cordoba G.' },
  { group: 'B', round: 4, playerA: 'Santi Mar.', playerB: 'Bocchicchio F.', ballPlayer: 'Santi Mar.' },
  { group: 'C', round: 4, playerA: 'Aguirre W.', playerB: 'Ferreres G.', ballPlayer: 'Aguirre W.' },
  { group: 'C', round: 4, playerA: 'Rusel S.', playerB: 'Rojas L.', ballPlayer: 'Rusel S.' },
  { group: 'A', round: 5, playerA: 'Vito C.', playerB: 'Bernardini G.', ballPlayer: 'Vito C.' },
  { group: 'A', round: 5, playerA: 'Figueroa M.', playerB: 'Komesu F.', ballPlayer: 'Figueroa M.' },
  { group: 'B', round: 5, playerA: 'Santi Mar.', playerB: 'Bianco D.', ballPlayer: 'Santi Mar.' },
  { group: 'B', round: 5, playerA: 'Bocchicchio F.', playerB: 'Cordoba G.', ballPlayer: 'Bocchicchio F.' },
  { group: 'C', round: 5, playerA: 'Rusel S.', playerB: 'Del Valle G.', ballPlayer: 'Rusel S.' },
  { group: 'C', round: 5, playerA: 'Rojas L.', playerB: 'Aguirre W.', ballPlayer: 'Rojas L.' },
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

function isKomesuInitial(name: string, initial: 'f' | 'm'): boolean {
  const n = normName(name);
  return n.startsWith('komesu') && n.includes(` ${initial}.`);
}

function fallbackPlayerId(name: string): string {
  const normalized = normName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `p-federer-l3-${normalized}`;
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
    if (isKomesuInitial(name, 'f') && (isKomesuInitial(p.name, 'm') || isKomesuInitial(p.displayName ?? '', 'm'))) {
      return false;
    }
    if (isKomesuInitial(name, 'm') && (isKomesuInitial(p.name, 'f') || isKomesuInitial(p.displayName ?? '', 'f'))) {
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
        category: 'Tercera',
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
  return `federer-l3-${String(index + 1).padStart(2, '0')}`;
}

function stageFor(): MatchStage {
  return 'group';
}

function roundLabel(row: SeedMatch): string {
  return `Grupo ${row.group} - Fecha ${row.round}`;
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
          A: ['Santi Mat. (P) vs Vito C.', 'Bernardini G. (P) vs Figueroa M.', 'Libre: Komesu F.'],
          B: ['Gadea M. (P) vs Santi Mar.', 'Bianco D. (P) vs Bocchicchio F.', 'Libre: Cordoba G.'],
          C: ['Ferreres G. (P) vs Rusel S.', 'Del Valle G. (P) vs Rojas L.', 'Libre: Aguirre W.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Figueroa M. (P) vs Santi Mat.', 'Bernardini G. (P) vs Komesu F.', 'Libre: Vito C.'],
          B: ['Bocchicchio F. (P) vs Gadea M.', 'Bianco D. (P) vs Cordoba G.', 'Libre: Santi Mar.'],
          C: ['Rojas L. (P) vs Ferreres G.', 'Del Valle G. (P) vs Aguirre W.', 'Libre: Rusel S.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Santi Mat. (P) vs Bernardini G.', 'Komesu F. (P) vs Vito C.', 'Libre: Figueroa M.'],
          B: ['Gadea M. (P) vs Bianco D.', 'Cordoba G. (P) vs Santi Mar.', 'Libre: Bocchicchio F.'],
          C: ['Ferreres G. (P) vs Del Valle G.', 'Aguirre W. (P) vs Rusel S.', 'Libre: Rojas L.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Komesu F. (P) vs Santi Mat.', 'Vito C. (P) vs Figueroa M.', 'Libre: Bernardini G.'],
          B: ['Cordoba G. (P) vs Gadea M.', 'Santi Mar. (P) vs Bocchicchio F.', 'Libre: Bianco D.'],
          C: ['Aguirre W. (P) vs Ferreres G.', 'Rusel S. (P) vs Rojas L.', 'Libre: Del Valle G.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Vito C. (P) vs Bernardini G.', 'Figueroa M. (P) vs Komesu F.', 'Libre: Santi Mat.'],
          B: ['Santi Mar. (P) vs Bianco D.', 'Bocchicchio F. (P) vs Cordoba G.', 'Libre: Gadea M.'],
          C: ['Rusel S. (P) vs Del Valle G.', 'Rojas L. (P) vs Aguirre W.', 'Libre: Ferreres G.'],
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
        slug: 'roger-federer-liga-3',
        name: 'Roger Federer - Liga 3',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'roger-liga3.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'roger-federer-liga-3',
        name: 'Roger Federer - Liga 3',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'roger-liga3.webp',
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
          stage: stageFor(),
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
          stage: stageFor(),
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

  console.log(`Roger Federer - Liga 3: ${fixtures.length} partidos programados sin resultados.`);
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
