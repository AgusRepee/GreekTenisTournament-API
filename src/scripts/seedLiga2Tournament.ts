import '../envBootstrap.js';
import type { MatchResultStatus, MatchStage, Prisma, ScheduleStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-novak-l2';
const LEAGUE_NUM = 2;
const CATEGORY = 'Segunda';

const groups = {
  A: ['Lacave L.', 'Monzón M.', 'Colomer S.', 'Cancio M.', 'Del Pino A.'],
  B: ['Ferreyra O.', 'Ruiz J.', 'Komesu M.', 'Guareschi A.', 'Mayer D.'],
  C: ['Rossi F.', 'Fredkin B.', 'Molina L.', 'Scilipoti N.', 'Gadea M.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  winner?: string;
  winnerScore?: string;
  status?: MatchResultStatus;
  note?: string;
};

/** Resultados informados (sin horarios). Partidos de grupos no listados quedan pendientes. */
const fixtures: SeedMatch[] = [
  { group: 'A', round: 5, playerA: 'Monzón M.', playerB: 'Colomer S.', winner: 'Colomer S.', winnerScore: '6-3 / 4-1 y abandono', status: 'retired' },
  { group: 'A', round: 5, playerA: 'Cancio M.', playerB: 'Del Pino A.', winner: 'Cancio M.', winnerScore: '6-4 / 1-6 / 10-8' },
  { group: 'A', round: 2, playerA: 'Cancio M.', playerB: 'Lacave L.', winner: 'Lacave L.', winnerScore: '6-7 / 6-4 / 10-4' },
  { group: 'A', round: 2, playerA: 'Colomer S.', playerB: 'Del Pino A.', winner: 'Colomer S.', winnerScore: '6-3 / 6-4' },
  { group: 'A', round: 1, playerA: 'Lacave L.', playerB: 'Monzón M.', winner: 'Lacave L.', winnerScore: '6-1 / 6-1' },
  { group: 'A', round: 1, playerA: 'Colomer S.', playerB: 'Cancio M.', winner: 'Colomer S.', winnerScore: '3-6 / 6-3 / 10-6' },
  { group: 'A', round: 3, playerA: 'Del Pino A.', playerB: 'Monzón M.', winner: 'Monzón M.', winnerScore: '4-6 / 6-0 / 10-4' },
  { group: 'A', round: 3, playerA: 'Lacave L.', playerB: 'Colomer S.', winner: 'Lacave L.', winnerScore: '7-5 / 6-4' },
  { group: 'B', round: 3, playerA: 'Mayer D.', playerB: 'Ruiz J.', winner: 'Mayer D.', winnerScore: '6-1 / 7-5' },
  { group: 'B', round: 1, playerA: 'Komesu M.', playerB: 'Guareschi A.', winner: 'Guareschi A.', winnerScore: '6-2 / 6-4' },
  { group: 'B', round: 1, playerA: 'Ferreyra O.', playerB: 'Ruiz J.', winner: 'Ferreyra O.', winnerScore: '6-4 / 3-6 / 10-3' },
  { group: 'B', round: 5, playerA: 'Guareschi A.', playerB: 'Mayer D.', winner: 'Mayer D.', winnerScore: '5-7 / 7-6 / 10-7' },
  { group: 'B', round: 2, playerA: 'Guareschi A.', playerB: 'Ferreyra O.', winner: 'Guareschi A.', winnerScore: '6-2 / 6-3' },
  { group: 'B', round: 4, playerA: 'Mayer D.', playerB: 'Ferreyra O.', winner: 'Mayer D.', winnerScore: '6-3 / 3-6 / 10-3' },
  { group: 'B', round: 2, playerA: 'Komesu M.', playerB: 'Mayer D.', winner: 'Komesu M.', winnerScore: '7-5 / 7-6' },
  { group: 'B', round: 4, playerA: 'Ruiz J.', playerB: 'Guareschi A.', winner: 'Guareschi A.', winnerScore: '6-1 / 7-6' },
  { group: 'B', round: 3, playerA: 'Ferreyra O.', playerB: 'Komesu M.', winner: 'Komesu M.', winnerScore: '5-7 / 6-2 / 11-9' },
  { group: 'B', round: 5, playerA: 'Ruiz J.', playerB: 'Komesu M.', winner: 'Komesu M.', winnerScore: '6-3 / 6-2' },
  { group: 'C', round: 3, playerA: 'Rossi F.', playerB: 'Molina L.', winner: 'Rossi F.', winnerScore: '6-0 / 6-2' },
  { group: 'C', round: 5, playerA: 'Scilipoti N.', playerB: 'Gadea M.', winner: 'Scilipoti N.', winnerScore: '6-0 / 6-1' },
  { group: 'C', round: 1, playerA: 'Rossi F.', playerB: 'Fredkin B.', winner: 'Rossi F.', winnerScore: '6-0 / 6-2' },
  { group: 'C', round: 3, playerA: 'Gadea M.', playerB: 'Fredkin B.', winner: 'Fredkin B.', winnerScore: '6-4 / 6-3' },
  { group: 'C', round: 2, playerA: 'Molina L.', playerB: 'Scilipoti N.', winner: 'Scilipoti N.', winnerScore: '6-1 / 6-2' },
  { group: 'C', round: 4, playerA: 'Gadea M.', playerB: 'Rossi F.', winner: 'Rossi F.', winnerScore: '6-2 / 6-2' },
  { group: 'C', round: 4, playerA: 'Fredkin B.', playerB: 'Scilipoti N.', winner: 'Fredkin B.', winnerScore: '6-4 / 2-6 / 10-2' },
  { group: 'C', round: 5, playerA: 'Fredkin B.', playerB: 'Molina L.', winner: 'Fredkin B.', winnerScore: '6-1 / 7-5' },
];

const knockoutFixtures: SeedMatch[] = [
  { group: 'Repechaje', round: 0, playerA: 'Cancio M.', playerB: 'Scilipoti N.', winner: 'Cancio M.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Lacave L.', playerB: 'Mayer D.', winner: 'Lacave L.', winnerScore: '6-3 / 6-4' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Colomer S.', playerB: 'Komesu M.', winner: 'Colomer S.', winnerScore: '6-7 / 7-5 / 10-6' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Fredkin B.', playerB: 'Guareschi A.', winner: 'Fredkin B.', winnerScore: '6-1 / 6-4' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Rossi F.', playerB: 'Cancio M.', winner: 'Rossi F.', winnerScore: '6-3 / 6-4' },
  { group: 'Semifinales', round: 0, playerA: 'Lacave L.', playerB: 'Fredkin B.', winner: 'Lacave L.', winnerScore: '6-2 / 6-4' },
  { group: 'Semifinales', round: 0, playerA: 'Rossi F.', playerB: 'Colomer S.', winner: 'Rossi F.', winnerScore: '6-2 / 6-3' },
  { group: 'Final', round: 0, playerA: 'Lacave L.', playerB: 'Rossi F.', note: 'Pendiente / sin resultado cargado.' },
];

function cleanPlayerName(raw: string): string {
  return raw
    .replace(/\s*\(P\)\s*$/i, '')
    .replace(/^\s*\(P\)\s*/i, '')
    .trim();
}

function playerId(name: string): string {
  const normalized = cleanPlayerName(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `p-l2-${normalized}`;
}

function dedupeKey(m: Pick<SeedMatch, 'group' | 'round' | 'playerA' | 'playerB'>): string {
  return `${TOURNAMENT_ID}|${m.round}|${m.group}|${cleanPlayerName(m.playerA).toLowerCase()}|${cleanPlayerName(m.playerB).toLowerCase()}`;
}

function groupMatchId(index: number): string {
  return `l2-${String(index + 1).padStart(2, '0')}`;
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
    fechas: [],
    nota: '(P): Jugador asignado para llevar pelotas en ese partido.',
  };
}

function bracketJson(pid: (name: string) => string): Prisma.InputJsonValue {
  return {
    preliminary: [
      {
        id: 'rp-1',
        slotA: pid('Cancio M.'),
        slotB: pid('Scilipoti N.'),
        winner: pid('Cancio M.'),
        status: 'walkover',
      },
    ],
    quarter: [
      { id: 'qf-1', slotA: pid('Lacave L.'), slotB: pid('Mayer D.'), winner: pid('Lacave L.'), status: 'played' },
      { id: 'qf-2', slotA: pid('Colomer S.'), slotB: pid('Komesu M.'), winner: pid('Colomer S.'), status: 'played' },
      { id: 'qf-3', slotA: pid('Fredkin B.'), slotB: pid('Guareschi A.'), winner: pid('Fredkin B.'), status: 'played' },
      { id: 'qf-4', slotA: pid('Rossi F.'), slotB: pid('Cancio M.'), winner: pid('Rossi F.'), status: 'played' },
    ],
    semifinals: [
      { id: 'sf-1', slotA: pid('Lacave L.'), slotB: pid('Fredkin B.'), winner: pid('Lacave L.'), status: 'played' },
      { id: 'sf-2', slotA: pid('Rossi F.'), slotB: pid('Colomer S.'), winner: pid('Rossi F.'), status: 'played' },
    ],
    final: { id: 'final', slotA: pid('Lacave L.'), slotB: pid('Rossi F.'), status: 'pending' },
    champion: null,
  };
}

async function upsertSeedMatch(
  tx: Prisma.TransactionClient,
  row: SeedMatch,
  id: string,
  leagueId: string,
  groupId: string | null,
): Promise<void> {
  const stage = stageFor(row.group);
  const score = scoreForPlayerA(row);
  const hasWinner = Boolean(row.winner);
  const winnerId = row.winner ? playerId(row.winner) : null;
  const loser = row.winner === row.playerA ? row.playerB : row.winner === row.playerB ? row.playerA : null;
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
      note: row.note ?? null,
    },
    update: {
      scheduleStatus,
      date: null,
      time: null,
      note: row.note ?? null,
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
  const rosterPlayers = Array.from(new Set(Object.values(groups).flat()));

  await prisma.$transaction(async (tx) => {
    for (const name of rosterPlayers) {
      await tx.player.upsert({
        where: { id: playerId(name) },
        create: { id: playerId(name), name, displayName: name, category: CATEGORY, nationality: 'Argentina' },
        update: { name, displayName: name, category: CATEGORY, rosterActive: true, profileVisibility: 'active' },
      });
    }

    await tx.tournament.upsert({
      where: { id: TOURNAMENT_ID },
      create: {
        id: TOURNAMENT_ID,
        slug: 'liga-2',
        name: 'Novak Djokovic - Liga 2',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-05-22T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'novaknaranja.webp',
        slotsTotal: rosterPlayers.length,
        slotsTaken: rosterPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'liga-2',
        name: 'Novak Djokovic - Liga 2',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'novaknaranja.webp',
        slotsTotal: rosterPlayers.length,
        slotsTaken: rosterPlayers.length,
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
      await upsertSeedMatch(tx, row, groupMatchId(index), league.id, groupIds.get(row.group) ?? null);
    }

    for (const [index, row] of knockoutFixtures.entries()) {
      await upsertSeedMatch(tx, row, koMatchId(index), league.id, null);
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
      'Novak Djokovic - Liga 2 seed listo.',
      `Grupos: ${fixtures.length} partidos con resultado.`,
      `Play Off: ${knockoutFixtures.filter((m) => m.winner).length} con resultado, final pendiente (Lacave L. vs Rossi F.).`,
      `Pendientes grupos: A — Monzón vs Cancio, Del Pino vs Lacave; C — Rossi vs Scilipoti, Molina vs Gadea.`,
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
