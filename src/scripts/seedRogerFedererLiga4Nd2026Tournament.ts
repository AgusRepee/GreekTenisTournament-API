import '../envBootstrap.js';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-federer-l4';
const LEAGUE_NUM = 4;

const groups = {
  A: ['Rios J.', 'Garcia J.', 'Oviedo M.', 'Gonzalez Días F.', 'Cardozo M.'],
  B: ['Anetta D.', 'Repecka J.', 'Vidigt F.', 'Miletta J.', 'Gonzalez Días C.'],
  C: ['Maza S.', 'Blanco J.', 'Bauerkamper G.', 'Chantada M.', 'Murchio M.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Cardozo M.', playerB: 'Rios J.', ballPlayer: 'Cardozo M.' },
  { group: 'A', round: 1, playerA: 'Oviedo M.', playerB: 'Garcia J.', ballPlayer: 'Oviedo M.' },
  { group: 'B', round: 1, playerA: 'Repecka J.', playerB: 'Anetta D.', ballPlayer: 'Repecka J.' },
  { group: 'B', round: 1, playerA: 'Vidigt F.', playerB: 'Miletta J.', ballPlayer: 'Vidigt F.' },
  { group: 'C', round: 1, playerA: 'Blanco J.', playerB: 'Maza S.', ballPlayer: 'Blanco J.' },
  { group: 'C', round: 1, playerA: 'Chantada M.', playerB: 'Bauerkamper G.', ballPlayer: 'Chantada M.' },
  { group: 'A', round: 2, playerA: 'Garcia J.', playerB: 'Cardozo M.', ballPlayer: 'Garcia J.' },
  { group: 'A', round: 2, playerA: 'Oviedo M.', playerB: 'Gonzalez Días F.', ballPlayer: 'Oviedo M.' },
  { group: 'B', round: 2, playerA: 'Miletta J.', playerB: 'Repecka J.', ballPlayer: 'Miletta J.' },
  { group: 'B', round: 2, playerA: 'Vidigt F.', playerB: 'Gonzalez Días C.', ballPlayer: 'Vidigt F.' },
  { group: 'C', round: 2, playerA: 'Bauerkamper G.', playerB: 'Blanco J.', ballPlayer: 'Bauerkamper G.' },
  { group: 'C', round: 2, playerA: 'Chantada M.', playerB: 'Murchio M.', ballPlayer: 'Chantada M.' },
  { group: 'A', round: 3, playerA: 'Cardozo M.', playerB: 'Oviedo M.', ballPlayer: 'Cardozo M.' },
  { group: 'A', round: 3, playerA: 'Gonzalez Días F.', playerB: 'Rios J.', ballPlayer: 'Gonzalez Días F.' },
  { group: 'B', round: 3, playerA: 'Repecka J.', playerB: 'Vidigt F.', ballPlayer: 'Repecka J.' },
  { group: 'B', round: 3, playerA: 'Gonzalez Días C.', playerB: 'Anetta D.', ballPlayer: 'Gonzalez Días C.' },
  { group: 'C', round: 3, playerA: 'Blanco J.', playerB: 'Chantada M.', ballPlayer: 'Blanco J.' },
  { group: 'C', round: 3, playerA: 'Murchio M.', playerB: 'Maza S.', ballPlayer: 'Murchio M.' },
  { group: 'A', round: 4, playerA: 'Gonzalez Días F.', playerB: 'Cardozo M.', ballPlayer: 'Gonzalez Días F.' },
  { group: 'A', round: 4, playerA: 'Rios J.', playerB: 'Garcia J.', ballPlayer: 'Rios J.' },
  { group: 'B', round: 4, playerA: 'Gonzalez Días C.', playerB: 'Repecka J.', ballPlayer: 'Gonzalez Días C.' },
  { group: 'B', round: 4, playerA: 'Anetta D.', playerB: 'Miletta J.', ballPlayer: 'Anetta D.' },
  { group: 'C', round: 4, playerA: 'Murchio M.', playerB: 'Blanco J.', ballPlayer: 'Murchio M.' },
  { group: 'C', round: 4, playerA: 'Maza S.', playerB: 'Bauerkamper G.', ballPlayer: 'Maza S.' },
  { group: 'A', round: 5, playerA: 'Rios J.', playerB: 'Oviedo M.', ballPlayer: 'Rios J.' },
  { group: 'A', round: 5, playerA: 'Garcia J.', playerB: 'Gonzalez Días F.', ballPlayer: 'Garcia J.' },
  { group: 'B', round: 5, playerA: 'Anetta D.', playerB: 'Vidigt F.', ballPlayer: 'Anetta D.' },
  { group: 'B', round: 5, playerA: 'Miletta J.', playerB: 'Gonzalez Días C.', ballPlayer: 'Miletta J.' },
  { group: 'C', round: 5, playerA: 'Maza S.', playerB: 'Chantada M.', ballPlayer: 'Maza S.' },
  { group: 'C', round: 5, playerA: 'Bauerkamper G.', playerB: 'Murchio M.', ballPlayer: 'Bauerkamper G.' },
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
  return `p-federer-l4-${normalized}`;
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
        category: 'Cuarta',
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
  return `federer-l4-${String(index + 1).padStart(2, '0')}`;
}

function stageFor(): MatchStage {
  return 'group';
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
          A: ['Cardozo M. (P) vs Rios J.', 'Oviedo M. (P) vs Garcia J.', 'Libre: Gonzalez Días F.'],
          B: ['Repecka J. (P) vs Anetta D.', 'Vidigt F. (P) vs Miletta J.', 'Libre: Gonzalez Días C.'],
          C: ['Blanco J. (P) vs Maza S.', 'Chantada M. (P) vs Bauerkamper G.', 'Libre: Murchio M.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Garcia J. (P) vs Cardozo M.', 'Oviedo M. (P) vs Gonzalez Días F.', 'Libre: Rios J.'],
          B: ['Miletta J. (P) vs Repecka J.', 'Vidigt F. (P) vs Gonzalez Días C.', 'Libre: Anetta D.'],
          C: ['Bauerkamper G. (P) vs Blanco J.', 'Chantada M. (P) vs Murchio M.', 'Libre: Maza S.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Cardozo M. (P) vs Oviedo M.', 'Gonzalez Días F. (P) vs Rios J.', 'Libre: Garcia J.'],
          B: ['Repecka J. (P) vs Vidigt F.', 'Gonzalez Días C. (P) vs Anetta D.', 'Libre: Miletta J.'],
          C: ['Blanco J. (P) vs Chantada M.', 'Murchio M. (P) vs Maza S.', 'Libre: Bauerkamper G.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Gonzalez Días F. (P) vs Cardozo M.', 'Rios J. (P) vs Garcia J.', 'Libre: Oviedo M.'],
          B: ['Gonzalez Días C. (P) vs Repecka J.', 'Anetta D. (P) vs Miletta J.', 'Libre: Vidigt F.'],
          C: ['Murchio M. (P) vs Blanco J.', 'Maza S. (P) vs Bauerkamper G.', 'Libre: Chantada M.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Rios J. (P) vs Oviedo M.', 'Garcia J. (P) vs Gonzalez Días F.', 'Libre: Cardozo M.'],
          B: ['Anetta D. (P) vs Vidigt F.', 'Miletta J. (P) vs Gonzalez Días C.', 'Libre: Repecka J.'],
          C: ['Maza S. (P) vs Chantada M.', 'Bauerkamper G. (P) vs Murchio M.', 'Libre: Blanco J.'],
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
        slug: 'roger-federer-liga-4',
        name: 'Roger Federer - Liga 4',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'roger-liga4.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'roger-federer-liga-4',
        name: 'Roger Federer - Liga 4',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'roger-liga4.webp',
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
      for (const [index, name] of names.entries()) {
        const pid = playerId(name);
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

  const ranking = await recalculateRankings(prisma);

  console.log(`Roger Federer - Liga 4: ${fixtures.length} partidos programados sin resultados.`);
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
