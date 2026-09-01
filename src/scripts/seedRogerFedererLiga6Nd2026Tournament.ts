import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-federer-l6';
const LEAGUE_NUM = 6;
const INTERZONAL_GROUP = 'Interzonal';

const groups = {
  A: ['Cellilli F.', 'Bustos C.', 'Jaureguiberry C.', 'Lasca M.'],
  B: ['De Ruyck G.', 'Saenz D.', 'Bonacalza M.', 'Marceca F.'],
  C: ['Marceca M.', 'Guzman M.', 'Fedrjanic N.', 'Fratini M.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Cellilli F.', playerB: 'Bustos C.', ballPlayer: 'Cellilli F.' },
  { group: 'A', round: 1, playerA: 'Jaureguiberry C.', playerB: 'Lasca M.', ballPlayer: 'Jaureguiberry C.' },
  { group: 'B', round: 1, playerA: 'De Ruyck G.', playerB: 'Saenz D.', ballPlayer: 'De Ruyck G.' },
  { group: 'B', round: 1, playerA: 'Bonacalza M.', playerB: 'Marceca F.', ballPlayer: 'Bonacalza M.' },
  { group: 'C', round: 1, playerA: 'Marceca M.', playerB: 'Guzman M.', ballPlayer: 'Marceca M.' },
  { group: 'C', round: 1, playerA: 'Fedrjanic N.', playerB: 'Fratini M.', ballPlayer: 'Fedrjanic N.' },
  { group: 'A', round: 2, playerA: 'Cellilli F.', playerB: 'Jaureguiberry C.', ballPlayer: 'Cellilli F.' },
  { group: 'A', round: 2, playerA: 'Lasca M.', playerB: 'Bustos C.', ballPlayer: 'Lasca M.' },
  { group: 'B', round: 2, playerA: 'Bonacalza M.', playerB: 'De Ruyck G.', ballPlayer: 'Bonacalza M.' },
  { group: 'B', round: 2, playerA: 'Saenz D.', playerB: 'Marceca F.', ballPlayer: 'Saenz D.' },
  { group: 'C', round: 2, playerA: 'Marceca M.', playerB: 'Fedrjanic N.', ballPlayer: 'Marceca M.' },
  { group: 'C', round: 2, playerA: 'Guzman M.', playerB: 'Fratini M.', ballPlayer: 'Guzman M.' },
  { group: 'A', round: 3, playerA: 'Lasca M.', playerB: 'Cellilli F.', ballPlayer: 'Lasca M.' },
  { group: 'A', round: 3, playerA: 'Bustos C.', playerB: 'Jaureguiberry C.', ballPlayer: 'Bustos C.' },
  { group: 'B', round: 3, playerA: 'Marceca F.', playerB: 'De Ruyck G.', ballPlayer: 'Marceca F.' },
  { group: 'B', round: 3, playerA: 'Saenz D.', playerB: 'Bonacalza M.', ballPlayer: 'Saenz D.' },
  { group: 'C', round: 3, playerA: 'Fratini M.', playerB: 'Marceca M.', ballPlayer: 'Fratini M.' },
  { group: 'C', round: 3, playerA: 'Guzman M.', playerB: 'Fedrjanic N.', ballPlayer: 'Guzman M.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Fratini M.', playerB: 'Cellilli F.', ballPlayer: 'Fratini M.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Bustos C.', playerB: 'Marceca M.', ballPlayer: 'Bustos C.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Jaureguiberry C.', playerB: 'Bonacalza M.', ballPlayer: 'Jaureguiberry C.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Marceca F.', playerB: 'Lasca M.', ballPlayer: 'Marceca F.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'De Ruyck G.', playerB: 'Guzman M.', ballPlayer: 'De Ruyck G.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Fedrjanic N.', playerB: 'Saenz D.', ballPlayer: 'Fedrjanic N.' },
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

function isHomonymInitial(name: string, surname: string, initial: 'm' | 'f'): boolean {
  const n = normName(name);
  return n.startsWith(surname) && n.includes(` ${initial}.`);
}

function isCellilliInitial(name: string, initial: 'm' | 'f'): boolean {
  return isHomonymInitial(name, 'cellilli', initial);
}

function isMarcecaInitial(name: string, initial: 'm' | 'f'): boolean {
  return isHomonymInitial(name, 'marceca', initial);
}

function conflictsHomonym(requested: string, candidateName: string, candidateDisplay: string): boolean {
  const pairs: Array<[typeof isCellilliInitial, 'm' | 'f']> = [
    [isCellilliInitial, 'm'],
    [isCellilliInitial, 'f'],
    [isMarcecaInitial, 'm'],
    [isMarcecaInitial, 'f'],
  ];
  for (const [fn, initial] of pairs) {
    const opposite = initial === 'm' ? 'f' : 'm';
    if (fn(requested, initial) && (fn(candidateName, opposite) || fn(candidateDisplay, opposite))) {
      return true;
    }
  }
  return false;
}

function fallbackPlayerId(name: string): string {
  const normalized = normName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `p-federer-l6-${normalized}`;
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
    return !conflictsHomonym(name, p.name, p.displayName ?? '');
  });
  const id = hit?.id ?? fallbackPlayerId(name);
  if (!hit) {
    await prisma.player.upsert({
      where: { id },
      create: {
        id,
        name,
        displayName: name,
        category: 'Sexta',
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
  return `federer-l6-${String(index + 1).padStart(2, '0')}`;
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
          A: ['Cellilli F. (P) vs Bustos C.', 'Jaureguiberry C. (P) vs Lasca M.'],
          B: ['De Ruyck G. (P) vs Saenz D.', 'Bonacalza M. (P) vs Marceca F.'],
          C: ['Marceca M. (P) vs Guzman M.', 'Fedrjanic N. (P) vs Fratini M.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Cellilli F. (P) vs Jaureguiberry C.', 'Lasca M. (P) vs Bustos C.'],
          B: ['Bonacalza M. (P) vs De Ruyck G.', 'Saenz D. (P) vs Marceca F.'],
          C: ['Marceca M. (P) vs Fedrjanic N.', 'Guzman M. (P) vs Fratini M.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Lasca M. (P) vs Cellilli F.', 'Bustos C. (P) vs Jaureguiberry C.'],
          B: ['Marceca F. (P) vs De Ruyck G.', 'Saenz D. (P) vs Bonacalza M.'],
          C: ['Fratini M. (P) vs Marceca M.', 'Guzman M. (P) vs Fedrjanic N.'],
        },
      },
      {
        numero: 4,
        tipo: 'interzonal',
        partidos: [
          'Fratini M. (P) vs Cellilli F.',
          'Bustos C. (P) vs Marceca M.',
          'Jaureguiberry C. (P) vs Bonacalza M.',
          'Marceca F. (P) vs Lasca M.',
          'De Ruyck G. (P) vs Guzman M.',
          'Fedrjanic N. (P) vs Saenz D.',
        ],
      },
    ],
  };
}

async function assertHomonymIds() {
  const checks: Array<{ label: string; id: string; forbidden: (n: string) => boolean }> = [
    {
      label: 'Cellilli F.',
      id: playerIdCache.get(normName('Cellilli F.'))!,
      forbidden: (n) => isCellilliInitial(n, 'm'),
    },
    {
      label: 'Marceca F.',
      id: playerIdCache.get(normName('Marceca F.'))!,
      forbidden: (n) => isMarcecaInitial(n, 'm'),
    },
    {
      label: 'Marceca M.',
      id: playerIdCache.get(normName('Marceca M.'))!,
      forbidden: (n) => isMarcecaInitial(n, 'f'),
    },
  ];
  for (const { label, id, forbidden } of checks) {
    const row = await prisma.player.findUnique({ where: { id }, select: { name: true, displayName: true } });
    if (!row) throw new Error(`${label}: jugador no encontrado (${id})`);
    if (forbidden(row.name) || forbidden(row.displayName ?? '')) {
      throw new Error(`${label} resolvió al homónimo incorrecto (${row.name}); abortando seed Liga 6.`);
    }
  }
  const cellilliF = playerIdCache.get(normName('Cellilli F.'))!;
  const marcecaF = playerIdCache.get(normName('Marceca F.'))!;
  const marcecaM = playerIdCache.get(normName('Marceca M.'))!;
  if (marcecaF === marcecaM) {
    throw new Error('Marceca F. y Marceca M. comparten el mismo id; abortando seed Liga 6.');
  }
  if (cellilliF === playerIdCache.get(normName('Cellilli M.'))) {
    throw new Error('Cellilli F. colisionó con Cellilli M.; abortando seed Liga 6.');
  }
}

async function main() {
  const allPlayers = Array.from(new Set(Object.values(groups).flat()));
  for (const name of allPlayers) {
    await resolvePlayerId(name);
  }
  await assertHomonymIds();

  const playerId = (name: string) => playerIdCache.get(normName(name))!;

  await prisma.$transaction(async (tx) => {
    await tx.tournament.upsert({
      where: { id: TOURNAMENT_ID },
      create: {
        id: TOURNAMENT_ID,
        slug: 'roger-federer-liga-6',
        name: 'Roger Federer - Liga 6',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'roger-liga6.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'roger-federer-liga-6',
        name: 'Roger Federer - Liga 6',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'roger-liga6.webp',
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

  console.log(`Roger Federer - Liga 6: ${fixtures.length} partidos programados sin resultados.`);
  console.log(`Marceca F. → id=${playerIdCache.get(normName('Marceca F.'))}`);
  console.log(`Marceca M. → id=${playerIdCache.get(normName('Marceca M.'))}`);
  console.log(`Cellilli F. → id=${playerIdCache.get(normName('Cellilli F.'))}`);
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
