import '../envBootstrap.js';
import type { MatchResultStatus, MatchStage, Prisma, ScheduleStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-novak-l6';
const LEAGUE_NUM = 6;
const CATEGORY = 'Sexta';
const BYE_PLAYER_ID = 'sys-ko-bye';
const CLASSIFICATION_RULE =
  'Clasifican a Cuartos de Final los 4 primeros de cada grupo.';

const groups = {
  A: ['Cellilli F.', 'Amezague J.', 'De Ruyck G.', 'Fedrjanic N.', 'Bataglia F.'],
  B: ['Ballesta F.', 'Antuña A.', 'Ferrarotti E.', 'Fratini M.', 'Marceca M.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer?: string;
  winner?: string;
  winnerScore?: string;
  scoreIsPlayerAPerspective?: boolean;
  status?: MatchResultStatus;
  date?: string;
  time?: string;
  note?: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 2, date: '2026-03-15', time: '18:00', playerA: 'De Ruyck G.', playerB: 'Amezague J.', ballPlayer: 'De Ruyck G.', winner: 'Amezague J.', winnerScore: '6-3 / 6-1' },
  { group: 'A', round: 1, date: '2026-04-11', time: '18:30', playerA: 'Cellilli F.', playerB: 'Bataglia F.', ballPlayer: 'Cellilli F.', winner: 'Cellilli F.', winnerScore: '7-6 / 6-2', note: 'Postergado originalmente del 22/03/2026 15:00.' },
  { group: 'A', round: 1, date: '2026-03-24', time: '14:00', playerA: 'De Ruyck G.', playerB: 'Fedrjanic N.', ballPlayer: 'De Ruyck G.', winner: 'De Ruyck G.', winnerScore: '6-0 / 7-5' },
  { group: 'A', round: 5, date: '2026-04-04', time: '13:00', playerA: 'Fedrjanic N.', playerB: 'Amezague J.', ballPlayer: 'Fedrjanic N.', winner: 'Amezague J.', winnerScore: '6-4 / 6-1', note: 'Resultado corregido desde 6-4/-6-1.' },
  { group: 'A', round: 5, date: '2026-04-18', time: '13:00', playerA: 'Bataglia F.', playerB: 'De Ruyck G.', ballPlayer: 'Bataglia F.', winner: 'De Ruyck G.', winnerScore: '6-2 / 6-1' },
  { group: 'A', round: 4, date: '2026-04-19', time: '11:00', playerA: 'Amezague J.', playerB: 'Cellilli F.', ballPlayer: 'Amezague J.', winner: 'Cellilli F.', winnerScore: '7-5 / 2-6 / 10-5' },
  { group: 'A', round: 2, date: '2026-04-26', time: '14:00', playerA: 'Fedrjanic N.', playerB: 'Cellilli F.', ballPlayer: 'Fedrjanic N.', winner: 'Cellilli F.', winnerScore: '6-1 / 6-4' },
  { group: 'A', round: 3, date: '2026-04-26', time: '15:00', playerA: 'Amezague J.', playerB: 'Bataglia F.', ballPlayer: 'Amezague J.', winner: 'Amezague J.', winnerScore: '6-2 / 6-2' },
  { group: 'A', round: 4, date: '2026-05-03', time: '15:00', playerA: 'Bataglia F.', playerB: 'Fedrjanic N.', ballPlayer: 'Bataglia F.', winner: 'Fedrjanic N.', winnerScore: '6-2 / 6-4' },
  { group: 'A', round: 3, date: '2026-05-04', time: '14:00', playerA: 'Cellilli F.', playerB: 'De Ruyck G.', winner: 'Cellilli F.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'B', round: 2, date: '2026-03-15', time: '20:00', playerA: 'Antuña A.', playerB: 'Ballesta F.', ballPlayer: 'Antuña A.', winner: 'Ballesta F.', winnerScore: '6-2 / 3-6 / 10-7' },
  { group: 'B', round: 2, date: '2026-03-24', time: '09:00', playerA: 'Antuña A.', playerB: 'Fratini M.', ballPlayer: 'Antuña A.', winner: 'Antuña A.', winnerScore: '6-1 / 6-1' },
  { group: 'B', round: 1, date: '2026-04-02', time: '21:00', playerA: 'Ballesta F.', playerB: 'Ferrarotti E.', ballPlayer: 'Ballesta F.', winner: 'Ballesta F.', winnerScore: '6-1 / 6-1' },
  { group: 'B', round: 3, date: '2026-04-12', time: '16:00', playerA: 'Fratini M.', playerB: 'Ferrarotti E.', ballPlayer: 'Fratini M.', winner: 'Ferrarotti E.', winnerScore: '6-2 / 6-1' },
  { group: 'B', round: 4, date: '2026-04-12', time: '18:00', playerA: 'Marceca M.', playerB: 'Antuña A.', ballPlayer: 'Marceca M.', winner: 'Antuña A.', winnerScore: '6-2 / 6-1' },
  { group: 'B', round: 5, date: '2026-04-26', time: '16:00', playerA: 'Marceca M.', playerB: 'Fratini M.', ballPlayer: 'Marceca M.', winner: 'Fratini M.', winnerScore: '0-1 y abandono', scoreIsPlayerAPerspective: true, status: 'retired' },
  { group: 'B', round: 4, date: '2026-04-26', time: '19:00', playerA: 'Ferrarotti E.', playerB: 'Antuña A.', ballPlayer: 'Ferrarotti E.', winner: 'Antuña A.', winnerScore: '6-1 / 6-0' },
  { group: 'B', round: 5, date: '2026-05-01', time: '12:45', playerA: 'Ballesta F.', playerB: 'Marceca M.', ballPlayer: 'Ballesta F.', winner: 'Ballesta F.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'B', round: 3, date: '2026-05-04', time: '15:00', playerA: 'Ballesta F.', playerB: 'Fratini M.', winner: 'Ballesta F.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'B', round: 2, date: '2026-05-02', time: '12:00', playerA: 'Ferrarotti E.', playerB: 'Marceca M.', winner: 'Ferrarotti E.', winnerScore: 'W.O.', status: 'walkover' },
];

const knockoutFixtures: SeedMatch[] = [
  { group: 'Cuartos de Final', round: 0, date: '2026-05-10', time: '12:00', playerA: 'Cellilli F.', playerB: 'Fratini M.', winner: 'Cellilli F.', winnerScore: '6-1 / 6-1' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-16', time: '18:00', playerA: 'Antuña A.', playerB: 'De Ruyck G.', winner: 'Antuña A.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-22', time: '18:00', playerA: 'Amezague J.', playerB: 'Ferrarotti E.', winner: 'Amezague J.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-10', time: '12:30', playerA: 'Ballesta F.', playerB: 'Fedrjanic N.', winner: 'Ballesta F.', winnerScore: '6-3 / 1-6 / 10-7' },
  { group: 'Semifinales', round: 0, date: '2026-05-17', time: '16:00', playerA: 'Cellilli F.', playerB: 'Antuña A.', winner: 'Antuña A.', winnerScore: '6-4 / 6-3' },
  { group: 'Semifinales', round: 0, date: '2026-05-22', time: '21:00', playerA: 'Amezague J.', playerB: 'Ballesta F.', note: 'Pendiente / sin resultado cargado.' },
  { group: 'Final', round: 0, date: '2026-05-29', time: '21:00', playerA: 'Antuña A.', playerB: 'TBD (Final B)', note: 'Pendiente: ganador de Amezague J. / Ballesta F.' },
];

function playerId(name: string): string {
  if (name === 'BYE') return BYE_PLAYER_ID;
  if (name === 'TBD (SF1)') return 'sys-ko-sf1b';
  if (name === 'TBD (SF2)') return 'sys-ko-sf2a';
  if (name === 'TBD (Final A)') return 'sys-ko-fa';
  if (name === 'TBD (Final B)') return 'sys-ko-fb';
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `p-l6nd-${normalized}`;
}

function dedupeKey(m: Pick<SeedMatch, 'group' | 'round' | 'playerA' | 'playerB'>): string {
  const players = [m.playerA.toLowerCase(), m.playerB.toLowerCase()].sort().join('|');
  return `${TOURNAMENT_ID}|${m.round}|${m.group}|${players}`;
}

function matchId(index: number): string {
  return `l6nd-${String(index + 1).padStart(2, '0')}`;
}

function koMatchId(index: number): string {
  const labels = ['qf-0', 'qf-1', 'qf-2', 'qf-3', 'sf-0', 'sf-1', 'fn-0'];
  return `ko-${TOURNAMENT_ID}-${labels[index]}`;
}

function stageFor(group: string): MatchStage {
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
  if (row.winnerScore === 'BYE') return 'BYE';
  return row.scoreIsPlayerAPerspective || row.winner === row.playerA ? row.winnerScore : invertScore(row.winnerScore);
}

function nameAliases(name: string): string[] {
  if (name === 'Antuña A.') return ['Antuña A.', 'Antuña R.'];
  if (name === 'Bataglia F.') return ['Bataglia F.', 'Bataglia'];
  return [name];
}

function ligaDoc(): Prisma.InputJsonValue {
  return {
    torneo: 'Novak Djokovic',
    liga: LEAGUE_NUM,
    grupos: groups,
    fechas: [],
    nota: CLASSIFICATION_RULE,
  };
}

function bracketJson(): Prisma.InputJsonValue {
  return {
    preliminary: [],
    quarter: [
      { id: 'qf-1', slotA: playerId('Cellilli F.'), slotB: playerId('Fratini M.'), status: 'pending' },
      { id: 'qf-2', slotA: playerId('Antuña A.'), slotB: playerId('De Ruyck G.'), status: 'pending' },
      { id: 'qf-3', slotA: playerId('Amezague J.'), slotB: playerId('Ferrarotti E.'), status: 'pending' },
      { id: 'qf-4', slotA: playerId('Ballesta F.'), slotB: playerId('Fedrjanic N.'), status: 'pending' },
    ],
    semifinals: [
      { id: 'sf-1', slotA: 'WIN_QF_1', slotB: 'WIN_QF_2', status: 'pending' },
      { id: 'sf-2', slotA: 'WIN_QF_3', slotB: 'WIN_QF_4', status: 'pending' },
    ],
    final: { id: 'final', slotA: 'WIN_SF_1', slotB: 'WIN_SF_2', status: 'pending' },
    champion: null,
    note: CLASSIFICATION_RULE,
  };
}

async function upsertSystemPlayer(tx: Prisma.TransactionClient, id: string, name: string): Promise<void> {
  await tx.player.upsert({
    where: { id },
    create: { id, name, displayName: name, category: 'system', profileVisibility: 'hidden', rosterActive: false },
    update: { name, displayName: name, category: 'system', profileVisibility: 'hidden', rosterActive: false },
  });
}

async function findExistingMatchId(
  tx: Prisma.TransactionClient,
  row: SeedMatch,
  groupId: string | null,
  stage: MatchStage,
): Promise<string | null> {
  const p1 = playerId(row.playerA);
  const p2 = playerId(row.playerB);
  const namesA = nameAliases(row.playerA);
  const namesB = nameAliases(row.playerB);
  const found = await tx.match.findFirst({
    where: {
      tournamentId: TOURNAMENT_ID,
      stage,
      groupId,
      OR: [
        { player1Id: p1, player2Id: p2 },
        { player1Id: p2, player2Id: p1 },
        { player1: { name: { in: namesA } }, player2: { name: { in: namesB } } },
        { player1: { name: { in: namesB } }, player2: { name: { in: namesA } } },
        { player1: { displayName: { in: namesA } }, player2: { displayName: { in: namesB } } },
        { player1: { displayName: { in: namesB } }, player2: { displayName: { in: namesA } } },
      ],
    },
    select: { id: true },
  });
  return found?.id ?? null;
}

async function upsertSeedMatch(
  tx: Prisma.TransactionClient,
  row: SeedMatch,
  id: string,
  leagueId: string,
  groupId: string | null,
): Promise<{ created: boolean; matchId: string }> {
  const stage = stageFor(row.group);
  const existingId = await findExistingMatchId(tx, row, groupId, stage);
  const matchIdToUse = existingId ?? id;
  const score = scoreForPlayerA(row);
  const hasWinner = Boolean(row.winner);
  const winnerId = row.winner ? playerId(row.winner) : null;
  const loser = row.winner === row.playerA ? row.playerB : row.winner === row.playerB ? row.playerA : null;
  const scheduledDate = row.date ? new Date(`${row.date}T00:00:00.000Z`) : null;
  const note = [row.ballPlayer ? `Jugador con pelotas: ${row.ballPlayer}.` : '', row.note ?? ''].filter(Boolean).join(' ');
  const scheduleStatus: ScheduleStatus = scheduledDate || row.time ? 'confirmed' : 'unscheduled';

  await tx.match.upsert({
    where: { id: matchIdToUse },
    create: {
      id: matchIdToUse,
      tournamentId: TOURNAMENT_ID,
      tournamentLeagueId: leagueId,
      groupId,
      stage,
      roundLabel: stage === 'group' ? `Grupo ${row.group} - Fecha ${row.round}` : row.group,
      player1Id: playerId(row.playerA),
      player2Id: playerId(row.playerB),
      winnerId,
      loserId: loser ? playerId(loser) : null,
      score,
      scheduleStatus,
      scheduledDate,
      scheduledTime: row.time ?? null,
      completed: hasWinner,
    },
    update: {
      tournamentLeagueId: leagueId,
      groupId,
      stage,
      roundLabel: stage === 'group' ? `Grupo ${row.group} - Fecha ${row.round}` : row.group,
      player1Id: playerId(row.playerA),
      player2Id: playerId(row.playerB),
      winnerId,
      loserId: loser ? playerId(loser) : null,
      score,
      scheduleStatus,
      scheduledDate,
      scheduledTime: row.time ?? null,
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
      date: row.date ?? null,
      time: row.time ?? null,
      note: note || null,
    },
    update: {
      scheduleStatus,
      date: row.date ?? null,
      time: row.time ?? null,
      note: note || null,
    },
  });

  if (hasWinner && stage === 'group') {
    await tx.matchResult.upsert({
      where: { dedupeKey: dedupeKey(row) },
      create: {
        dedupeKey: dedupeKey(row),
        tournamentId: TOURNAMENT_ID,
        matchId: matchIdToUse,
        groupKey: row.group,
        roundNum: row.round,
        playerA: row.playerA,
        playerB: row.playerB,
        score,
        status: row.status ?? 'played',
        playedAt: scheduledDate,
      },
      update: {
        matchId: matchIdToUse,
        groupKey: row.group,
        roundNum: row.round,
        playerA: row.playerA,
        playerB: row.playerB,
        score,
        status: row.status ?? 'played',
        playedAt: scheduledDate,
      },
    });
  }

  return { created: !existingId, matchId: matchIdToUse };
}
async function main() {
  const allPlayers = Array.from(new Set(Object.values(groups).flat()));
  let createdGroupMatches = 0;
  let updatedGroupMatches = 0;
  let createdKoMatches = 0;
  let updatedKoMatches = 0;

  await prisma.$transaction(async (tx) => {
    await tx.player.updateMany({ where: { name: 'Antuña R.' }, data: { name: 'Antuña A.', displayName: 'Antuña A.' } });
    await tx.player.updateMany({ where: { name: 'Bataglia' }, data: { name: 'Bataglia F.', displayName: 'Bataglia F.' } });
    for (const name of allPlayers) {
      await tx.player.upsert({
        where: { id: playerId(name) },
        create: { id: playerId(name), name, displayName: name, category: CATEGORY, nationality: 'Argentina' },
        update: { name, displayName: name, category: CATEGORY, rosterActive: true, profileVisibility: 'active' },
      });
    }
    await upsertSystemPlayer(tx, BYE_PLAYER_ID, 'BYE');
    await upsertSystemPlayer(tx, 'sys-ko-sf1a', 'TBD');
    await upsertSystemPlayer(tx, 'sys-ko-sf1b', 'TBD');
    await upsertSystemPlayer(tx, 'sys-ko-sf2a', 'TBD');
    await upsertSystemPlayer(tx, 'sys-ko-sf2b', 'TBD');
    await upsertSystemPlayer(tx, 'sys-ko-fa', 'TBD');
    await upsertSystemPlayer(tx, 'sys-ko-fb', 'TBD');

    await tx.tournament.upsert({
      where: { id: TOURNAMENT_ID },
      create: {
        id: TOURNAMENT_ID,
        slug: 'novak-djokovic-liga-6',
        name: 'Novak Djokovic - Liga 6',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-05-22T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'novakblanco.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'novak-djokovic-liga-6',
        name: 'Novak Djokovic - Liga 6',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'novakblanco.webp',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
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

    for (const [index, row] of fixtures.entries()) {
      const result = await upsertSeedMatch(tx, row, matchId(index), league.id, groupIds.get(row.group) ?? null);
      if (result.created) createdGroupMatches += 1;
      else updatedGroupMatches += 1;
    }

    for (const [index, row] of knockoutFixtures.entries()) {
      const result = await upsertSeedMatch(tx, row, koMatchId(index), league.id, null);
      if (result.created) createdKoMatches += 1;
      else updatedKoMatches += 1;
    }

    await tx.eliminationBracket.upsert({
      where: { tournamentLeagueId: league.id },
      create: { tournamentLeagueId: league.id, status: 'in_progress', bracketJson: bracketJson() },
      update: { status: 'in_progress', bracketJson: bracketJson() },
    });
  });

  const ranking = await recalculateRankings(prisma);
  console.log(
    [
      'Novak Djokovic - Liga 6 seed listo.',
      `Fase de grupos: ${updatedGroupMatches} actualizados, ${createdGroupMatches} creados.`,
      `Play Off: ${updatedKoMatches} actualizados, ${createdKoMatches} creados.`,
      `Ranking recalculado: ${ranking.rowsWritten} filas.`,
      'Pendientes Play Off: Antuña A. vs De Ruyck G.; Amezague J. vs Ferrarotti E.; Semifinales y Final.',
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
