import '../envBootstrap.js';
import type { MatchResultStatus, MatchStage, Prisma, ScheduleStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-novak';
const LEAGUE_NUM = 1;
const CATEGORY = 'Primera';

const groups = {
  A: ['Pfening G.', 'Alvarez I.', 'Tacain R.', 'Arico S.', 'Guidobono A.'],
  B: ['Garassi A.', 'Rothkel M.', 'Pitera F.', 'Duarte D.', 'Naddeo M.'],
  C: ['Gaudina A.', 'Cordoba D.', 'Filosa M.', 'Mena C.', 'Novizki P.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer?: string;
  winner?: string;
  winnerScore?: string;
  status?: MatchResultStatus;
  note?: string;
};

/** Fixture canónico + resultados informados (sin horarios). */
const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, playerA: 'Pfening G.', playerB: 'Alvarez I.', ballPlayer: 'Pfening G.', winner: 'Alvarez I.', winnerScore: '2-6 / 6-3 / 10-5' },
  { group: 'A', round: 1, playerA: 'Tacain R.', playerB: 'Arico S.', ballPlayer: 'Tacain R.', winner: 'Tacain R.', winnerScore: '6-4 / 6-3' },
  { group: 'A', round: 2, playerA: 'Arico S.', playerB: 'Pfening G.', ballPlayer: 'Arico S.', winner: 'Pfening G.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'A', round: 2, playerA: 'Tacain R.', playerB: 'Guidobono A.', ballPlayer: 'Tacain R.', winner: 'Tacain R.', winnerScore: '6-2 / 3-6 / 10-7' },
  { group: 'A', round: 3, playerA: 'Pfening G.', playerB: 'Tacain R.', ballPlayer: 'Pfening G.', winner: 'Tacain R.', winnerScore: '6-4 / 5-7 / 10-6' },
  { group: 'A', round: 3, playerA: 'Guidobono A.', playerB: 'Alvarez I.', ballPlayer: 'Guidobono A.', winner: 'Guidobono A.', winnerScore: '7-6 / 6-3' },
  { group: 'A', round: 4, playerA: 'Guidobono A.', playerB: 'Pfening G.', ballPlayer: 'Guidobono A.', winner: 'Pfening G.', winnerScore: '3-6 / 6-1 / 10-4' },
  { group: 'A', round: 4, playerA: 'Alvarez I.', playerB: 'Arico S.', ballPlayer: 'Alvarez I.', winner: 'Alvarez I.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'A', round: 5, playerA: 'Alvarez I.', playerB: 'Tacain R.', ballPlayer: 'Alvarez I.', winner: 'Alvarez I.', winnerScore: '6-1 / 6-4' },
  { group: 'A', round: 5, playerA: 'Arico S.', playerB: 'Guidobono A.', ballPlayer: 'Arico S.', winner: 'Guidobono A.', winnerScore: '6-2 / 6-2' },
  { group: 'B', round: 1, playerA: 'Garassi A.', playerB: 'Rothkel M.', ballPlayer: 'Garassi A.', winner: 'Garassi A.', winnerScore: '6-4 / 6-1' },
  { group: 'B', round: 1, playerA: 'Naddeo M.', playerB: 'Pitera F.', ballPlayer: 'Naddeo M.', winner: 'Pitera F.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'B', round: 2, playerA: 'Pitera F.', playerB: 'Garassi A.', ballPlayer: 'Pitera F.', winner: 'Garassi A.', winnerScore: '7-5 / 6-4' },
  { group: 'B', round: 2, playerA: 'Naddeo M.', playerB: 'Duarte D.', ballPlayer: 'Naddeo M.', winner: 'Duarte D.', winnerScore: '6-4 / 7-5' },
  { group: 'B', round: 3, playerA: 'Garassi A.', playerB: 'Naddeo M.', ballPlayer: 'Garassi A.', winner: 'Garassi A.', winnerScore: '6-1 / 6-4' },
  { group: 'B', round: 3, playerA: 'Duarte D.', playerB: 'Rothkel M.', ballPlayer: 'Duarte D.', winner: 'Rothkel M.', winnerScore: '6-3 / 6-3' },
  { group: 'B', round: 4, playerA: 'Duarte D.', playerB: 'Garassi A.', ballPlayer: 'Duarte D.', winner: 'Garassi A.', winnerScore: '6-3 / 6-3' },
  { group: 'B', round: 4, playerA: 'Rothkel M.', playerB: 'Pitera F.', ballPlayer: 'Rothkel M.', winner: 'Pitera F.', winnerScore: '6-1 / 7-6' },
  { group: 'B', round: 5, playerA: 'Rothkel M.', playerB: 'Naddeo M.', ballPlayer: 'Rothkel M.', winner: 'Rothkel M.', winnerScore: '6-1 / 6-2', note: 'Informado como Rothkel vs Araujo J.; mapeado a Naddeo M.' },
  { group: 'B', round: 5, playerA: 'Pitera F.', playerB: 'Duarte D.', ballPlayer: 'Pitera F.', winner: 'Pitera F.', winnerScore: '7-5 / 6-1' },
  { group: 'C', round: 1, playerA: 'Gaudina A.', playerB: 'Cordoba D.', ballPlayer: 'Gaudina A.', winner: 'Gaudina A.', winnerScore: '7-5 / 6-4' },
  { group: 'C', round: 1, playerA: 'Filosa M.', playerB: 'Mena C.', ballPlayer: 'Filosa M.', winner: 'Filosa M.', winnerScore: '6-4 / 7-6' },
  { group: 'C', round: 2, playerA: 'Mena C.', playerB: 'Gaudina A.', ballPlayer: 'Mena C.', winner: 'Gaudina A.', winnerScore: '6-1 / 6-1' },
  { group: 'C', round: 2, playerA: 'Filosa M.', playerB: 'Novizki P.', ballPlayer: 'Filosa M.', winner: 'Novizki P.', winnerScore: '6-2 / 6-3' },
  { group: 'C', round: 3, playerA: 'Gaudina A.', playerB: 'Filosa M.', ballPlayer: 'Gaudina A.', winner: 'Gaudina A.', winnerScore: '6-4 / 6-2' },
  { group: 'C', round: 3, playerA: 'Novizki P.', playerB: 'Cordoba D.', ballPlayer: 'Novizki P.', winner: 'Novizki P.', winnerScore: '6-2 / 6-4' },
  { group: 'C', round: 4, playerA: 'Novizki P.', playerB: 'Gaudina A.', ballPlayer: 'Novizki P.', winner: 'Novizki P.', winnerScore: '6-3 / 6-0' },
  { group: 'C', round: 4, playerA: 'Cordoba D.', playerB: 'Mena C.', ballPlayer: 'Cordoba D.', winner: 'Cordoba D.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'C', round: 5, playerA: 'Cordoba D.', playerB: 'Filosa M.', ballPlayer: 'Cordoba D.', winner: 'Cordoba D.', winnerScore: '4-6 / 6-2 / 10-8' },
  { group: 'C', round: 5, playerA: 'Mena C.', playerB: 'Novizki P.', ballPlayer: 'Mena C.', winner: 'Novizki P.', winnerScore: 'W.O.', status: 'walkover' },
];

const knockoutFixtures: SeedMatch[] = [
  { group: 'Repechaje', round: 0, playerA: 'Cordoba D.', playerB: 'Rothkel M.', winner: 'Cordoba D.', winnerScore: '6-2 / 6-4' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Tacain R.', playerB: 'Alvarez I.', winner: 'Tacain R.', winnerScore: '6-4 / 6-4' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Garassi A.', playerB: 'Guidobono A.', winner: 'Garassi A.', winnerScore: '6-2 / 4-6 / 10-2' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Pitera F.', playerB: 'Gaudina A.', winner: 'Pitera F.', winnerScore: '6-2 / 6-3' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Novizki P.', playerB: 'Cordoba D.', winner: 'Novizki P.', winnerScore: '6-4 / 6-3' },
  { group: 'Semifinales', round: 0, playerA: 'Garassi A.', playerB: 'Tacain R.', winner: 'Garassi A.', winnerScore: '7-6 / 6-2' },
  { group: 'Semifinales', round: 0, playerA: 'Novizki P.', playerB: 'Pitera F.', winner: 'Novizki P.', winnerScore: '6-3 / 6-2' },
  { group: 'Final', round: 0, playerA: 'Garassi A.', playerB: 'Novizki P.', note: 'Pendiente / sin resultado cargado.' },
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
  playerIdCache.set(key, id);
  return id;
}

function dedupeKey(m: Pick<SeedMatch, 'group' | 'round' | 'playerA' | 'playerB'>): string {
  return `${TOURNAMENT_ID}|${m.round}|${m.group}|${normName(m.playerA)}|${normName(m.playerB)}`;
}

function groupMatchId(index: number): string {
  return `novak-l1-${String(index + 1).padStart(2, '0')}`;
}

function koMatchId(index: number): string {
  const labels = ['rp-0', 'qf-0', 'qf-1', 'qf-2', 'qf-3', 'sf-0', 'sf-1', 'fn-0'];
  return `ko-${TOURNAMENT_ID}-${labels[index]}`;
}

function stageFor(group: string): MatchStage {
  if (group === 'Repechaje') return 'repechage';
  if (group === 'Cuartos de Final') return 'quarterfinal';
  if (group === 'Semifinales') return 'semifinal';
  if (group === 'Final') return 'final';
  return 'group';
}

function invertScore(score: string): string {
  return score.replace(/(\d+)-(\d+)/g, (_match, a: string, b: string) => `${b}-${a}`);
}

function scoreForPlayerA(row: SeedMatch): string {
  if (!row.winner || !row.winnerScore) return '';
  if ((row.status ?? 'played') === 'walkover') return row.winner === row.playerA ? 'A' : 'B';
  return row.winner === row.playerA ? row.winnerScore : invertScore(row.winnerScore);
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
          B: ['Garassi A. (P) vs Rothkel M.', 'Naddeo M. (P) vs Pitera F.', 'Libre: Duarte D.'],
          C: ['Gaudina A. (P) vs Cordoba D.', 'Filosa M. (P) vs Mena C.', 'Libre: Novizki P.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Arico S. (P) vs Pfening G.', 'Tacain R. (P) vs Guidobono A.', 'Libre: Alvarez I.'],
          B: ['Pitera F. (P) vs Garassi A.', 'Naddeo M. (P) vs Duarte D.', 'Libre: Rothkel M.'],
          C: ['Mena C. (P) vs Gaudina A.', 'Filosa M. (P) vs Novizki P.', 'Libre: Cordoba D.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Pfening G. (P) vs Tacain R.', 'Guidobono A. (P) vs Alvarez I.', 'Libre: Arico S.'],
          B: ['Garassi A. (P) vs Naddeo M.', 'Duarte D. (P) vs Rothkel M.', 'Libre: Pitera F.'],
          C: ['Gaudina A. (P) vs Filosa M.', 'Novizki P. (P) vs Cordoba D.', 'Libre: Mena C.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Guidobono A. (P) vs Pfening G.', 'Alvarez I. (P) vs Arico S.', 'Libre: Tacain R.'],
          B: ['Duarte D. (P) vs Garassi A.', 'Rothkel M. (P) vs Pitera F.', 'Libre: Naddeo M.'],
          C: ['Novizki P. (P) vs Gaudina A.', 'Cordoba D. (P) vs Mena C.', 'Libre: Filosa M.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Alvarez I. (P) vs Tacain R.', 'Arico S. (P) vs Guidobono A.', 'Libre: Pfening G.'],
          B: ['Rothkel M. (P) vs Naddeo M.', 'Pitera F. (P) vs Duarte D.', 'Libre: Garassi A.'],
          C: ['Cordoba D. (P) vs Filosa M.', 'Mena C. (P) vs Novizki P.', 'Libre: Gaudina A.'],
        },
      },
    ],
  };
}

function bracketJson(pid: (name: string) => string): Prisma.InputJsonValue {
  return {
    preliminary: [
      {
        id: 'rp-1',
        slotA: pid('Cordoba D.'),
        slotB: pid('Rothkel M.'),
        winner: pid('Cordoba D.'),
        status: 'played',
      },
    ],
    quarter: [
      { id: 'qf-1', slotA: pid('Tacain R.'), slotB: pid('Alvarez I.'), winner: pid('Tacain R.'), status: 'played' },
      { id: 'qf-2', slotA: pid('Garassi A.'), slotB: pid('Guidobono A.'), winner: pid('Garassi A.'), status: 'played' },
      { id: 'qf-3', slotA: pid('Pitera F.'), slotB: pid('Gaudina A.'), winner: pid('Pitera F.'), status: 'played' },
      { id: 'qf-4', slotA: pid('Novizki P.'), slotB: pid('Cordoba D.'), winner: pid('Novizki P.'), status: 'played' },
    ],
    semifinals: [
      { id: 'sf-1', slotA: pid('Garassi A.'), slotB: pid('Tacain R.'), winner: pid('Garassi A.'), status: 'played' },
      { id: 'sf-2', slotA: pid('Novizki P.'), slotB: pid('Pitera F.'), winner: pid('Novizki P.'), status: 'played' },
    ],
    final: { id: 'final', slotA: pid('Garassi A.'), slotB: pid('Novizki P.'), status: 'pending' },
    champion: null,
  };
}

async function upsertSeedMatch(
  tx: Prisma.TransactionClient,
  row: SeedMatch,
  id: string,
  leagueId: string,
  groupId: string | null,
  playerId: (name: string) => string,
): Promise<void> {
  const stage = stageFor(row.group);
  const score = scoreForPlayerA(row);
  const hasWinner = Boolean(row.winner);
  const winnerId = row.winner ? playerId(row.winner) : null;
  const loser = row.winner === row.playerA ? row.playerB : row.winner === row.playerB ? row.playerA : null;
  const note = [row.ballPlayer ? `Jugador con pelotas: ${row.ballPlayer}.` : '', row.note ?? ''].filter(Boolean).join(' ');
  const scheduleStatus: ScheduleStatus = 'unscheduled';
  const roundLabel =
    stage === 'group' ? `Grupo ${row.group} - Fecha ${row.round}` : row.group === 'Cuartos de Final' ? 'Cuartos de final' : row.group;

  await tx.match.upsert({
    where: { id },
    create: {
      id,
      tournamentId: TOURNAMENT_ID,
      tournamentLeagueId: leagueId,
      groupId,
      stage,
      roundLabel,
      player1Id: playerId(row.playerA),
      player2Id: playerId(row.playerB),
      winnerId,
      loserId: loser ? playerId(loser) : null,
      score,
      scheduleStatus,
      scheduledDate: null,
      scheduledTime: null,
      completed: hasWinner,
    },
    update: {
      tournamentLeagueId: leagueId,
      groupId,
      stage,
      roundLabel,
      player1Id: playerId(row.playerA),
      player2Id: playerId(row.playerB),
      winnerId,
      loserId: loser ? playerId(loser) : null,
      score,
      scheduleStatus,
      scheduledDate: null,
      scheduledTime: null,
      completed: hasWinner,
    },
  });

  await tx.tournamentScheduleEntry.upsert({
    where: { dedupeKey: dedupeKey(row) },
    create: {
      dedupeKey: dedupeKey(row),
      tournamentId: TOURNAMENT_ID,
      leagueNum: LEAGUE_NUM,
      scheduleStatus,
      date: null,
      time: null,
      note: note || null,
    },
    update: {
      scheduleStatus,
      date: null,
      time: null,
      note: note || null,
    },
  });

  if (!hasWinner) return;

  await tx.matchResult.upsert({
    where: { dedupeKey: dedupeKey(row) },
    create: {
      dedupeKey: dedupeKey(row),
      tournamentId: TOURNAMENT_ID,
      matchId: id,
      groupKey: row.group,
      roundNum: row.round,
      playerA: row.playerA,
      playerB: row.playerB,
      score,
      status: row.status ?? 'played',
      playedAt: null,
    },
    update: {
      matchId: id,
      groupKey: row.group,
      roundNum: row.round,
      playerA: row.playerA,
      playerB: row.playerB,
      score,
      status: row.status ?? 'played',
      playedAt: null,
    },
  });
}

async function main() {
  const allPlayers = Array.from(
    new Set([
      ...Object.values(groups).flat(),
      ...fixtures.flatMap((m) => [m.playerA, m.playerB, m.winner].filter(Boolean) as string[]),
      ...knockoutFixtures.flatMap((m) => [m.playerA, m.playerB, m.winner].filter(Boolean) as string[]),
    ]),
  );

  for (const name of allPlayers) {
    const id = await resolvePlayerId(name);
    await prisma.player.upsert({
      where: { id },
      create: { id, name, displayName: name, category: CATEGORY, nationality: 'Argentina' },
      update: { name, displayName: name, category: CATEGORY, rosterActive: true, profileVisibility: 'active' },
    });
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
        startDate: new Date('2026-05-22T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'novakvioleta.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: Object.values(groups).flat().length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'novak-djokovic-liga-1',
        name: 'Novak Djokovic - Liga 1',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'novakvioleta.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: Object.values(groups).flat().length,
        ligaDoc: ligaDoc(),
      },
    });

    const league = await tx.tournamentLeague.upsert({
      where: { tournamentId_leagueNum: { tournamentId: TOURNAMENT_ID, leagueNum: LEAGUE_NUM } },
      create: { tournamentId: TOURNAMENT_ID, leagueNum: LEAGUE_NUM, groupStageStatus: 'confirmed', eliminationStatus: 'in_progress' },
      update: { groupStageStatus: 'confirmed', eliminationStatus: 'in_progress' },
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
        await tx.groupPlayer.upsert({
          where: { groupId_playerId: { groupId: group.id, playerId: playerId(name) } },
          create: { groupId: group.id, playerId: playerId(name), seed: index + 1 },
          update: { seed: index + 1 },
        });
      }
    }

    await tx.matchResult.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
    await tx.tournamentScheduleEntry.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
    await tx.match.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });

    for (const [index, row] of fixtures.entries()) {
      await upsertSeedMatch(tx, row, groupMatchId(index), league.id, groupIds.get(row.group) ?? null, playerId);
    }

    for (const [index, row] of knockoutFixtures.entries()) {
      await upsertSeedMatch(tx, row, koMatchId(index), league.id, null, playerId);
    }

    await tx.eliminationBracket.upsert({
      where: { tournamentLeagueId: league.id },
      create: { tournamentLeagueId: league.id, status: 'in_progress', bracketJson: bracketJson(playerId) },
      update: { status: 'in_progress', bracketJson: bracketJson(playerId) },
    });
  });

  const ranking = await recalculateRankings(prisma);
  console.log(
    [
      'Novak Djokovic - Liga 1 seed listo.',
      `Grupos: ${fixtures.length} partidos con resultado.`,
      `Play Off: ${knockoutFixtures.filter((m) => m.winner).length} con resultado, final pendiente (Garassi A. vs Novizki P.).`,
      `Ranking recalculado: ${ranking.rowsWritten} filas.`,
    ].join('\n'),
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
