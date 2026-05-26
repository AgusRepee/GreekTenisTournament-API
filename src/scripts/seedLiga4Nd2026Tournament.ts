import '../envBootstrap.js';
import type { MatchResultStatus, MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-novak-l4';
const LEAGUE_NUM = 4;
const INTERZONAL_GROUP = 'Fecha 4 (Interzonal)';

const groups = {
  A: ['Beitia J.', 'Chantada M.', 'Malcangi R.', 'Cardozo M.'],
  B: ['Repecka J.', 'Vera F.', 'Blanco J.', 'Anetta D.'],
  C: ['Bernardini G.', 'Garcia J.', 'Murchio M.', 'Cellilli M.'],
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
  date?: string;
  time?: string;
  note?: string;
};

const fixtures: SeedMatch[] = [
  { group: 'A', round: 1, date: '2026-03-15', time: '17:00', playerA: 'Malcangi R.', playerB: 'Cardozo M.', ballPlayer: 'Malcangi R.', winner: 'Malcangi R.', winnerScore: '6-3 / 6-4' },
  { group: 'A', round: 1, date: '2026-04-04', time: '11:00', playerA: 'Beitia J.', playerB: 'Chantada M.', ballPlayer: 'Beitia J.', winner: 'Beitia J.', winnerScore: '6-1 / 6-4' },
  { group: 'A', round: 2, playerA: 'Beitia J.', playerB: 'Malcangi R.', ballPlayer: 'Beitia J.', winner: 'Beitia J.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'A', round: 2, date: '2026-04-25', time: '08:00', playerA: 'Cardozo M.', playerB: 'Chantada M.', ballPlayer: 'Cardozo M.', winner: 'Chantada M.', winnerScore: '6-1 / 4-6 / 11-9' },
  { group: 'A', round: 3, date: '2026-03-24', time: '12:00', playerA: 'Cardozo M.', playerB: 'Beitia J.', ballPlayer: 'Cardozo M.', winner: 'Beitia J.', winnerScore: '7-5 / 6-2' },
  { group: 'A', round: 3, playerA: 'Chantada M.', playerB: 'Malcangi R.', ballPlayer: 'Chantada M.', winner: 'Chantada M.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'B', round: 1, date: '2026-04-12', time: '11:00', playerA: 'Blanco J.', playerB: 'Anetta D.', ballPlayer: 'Blanco J.', winner: 'Blanco J.', winnerScore: '4-6 / 6-2 / 10-7' },
  { group: 'B', round: 1, date: '2026-04-19', time: '17:00', playerA: 'Repecka J.', playerB: 'Vera F.', ballPlayer: 'Repecka J.', winner: 'Repecka J.', winnerScore: '6-4 / 3-6 / 10-4' },
  { group: 'B', round: 2, date: '2026-03-24', time: '11:00', playerA: 'Blanco J.', playerB: 'Repecka J.', ballPlayer: 'Blanco J.', winner: 'Repecka J.', winnerScore: '6-0 / 7-6' },
  { group: 'B', round: 2, date: '2026-03-24', time: '18:00', playerA: 'Vera F.', playerB: 'Anetta D.', ballPlayer: 'Vera F.', winner: 'Vera F.', winnerScore: '6-2 / 6-4' },
  { group: 'B', round: 3, playerA: 'Anetta D.', playerB: 'Repecka J.', ballPlayer: 'Anetta D.', winner: 'Repecka J.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'B', round: 3, date: '2026-05-01', time: '14:00', playerA: 'Blanco J.', playerB: 'Vera F.', ballPlayer: 'Blanco J.', winner: 'Vera F.', winnerScore: '6-7 / 6-4 / 10-8' },
  { group: 'C', round: 1, date: '2026-04-19', time: '11:30', playerA: 'Bernardini G.', playerB: 'Garcia J.', ballPlayer: 'Bernardini G.', winner: 'Bernardini G.', winnerScore: '4-6 / 6-3 / 10-7' },
  { group: 'C', round: 1, date: '2026-03-29', time: '16:00', playerA: 'Murchio M.', playerB: 'Cellilli M.', ballPlayer: 'Murchio M.', winner: 'Cellilli M.', winnerScore: '7-5 / 7-5' },
  { group: 'C', round: 2, date: '2026-03-22', time: '19:30', playerA: 'Bernardini G.', playerB: 'Murchio M.', ballPlayer: 'Bernardini G.', winner: 'Murchio M.', winnerScore: '6-4 / 6-2' },
  { group: 'C', round: 2, date: '2026-04-05', time: '09:00', playerA: 'Garcia J.', playerB: 'Cellilli M.', ballPlayer: 'Garcia J.', winner: 'Garcia J.', winnerScore: '6-2 / 6-3' },
  { group: 'C', round: 3, date: '2026-03-15', time: '20:00', playerA: 'Garcia J.', playerB: 'Murchio M.', ballPlayer: 'Garcia J.', winner: 'Garcia J.', winnerScore: '6-4 / 6-4' },
  { group: 'C', round: 3, date: '2026-04-26', time: '18:00', playerA: 'Cellilli M.', playerB: 'Bernardini G.', ballPlayer: 'Cellilli M.', winner: 'Bernardini G.', winnerScore: '6-1 / 6-2' },
  { group: INTERZONAL_GROUP, round: 4, date: '2026-03-22', time: '16:00', playerA: 'Cellilli M.', playerB: 'Chantada M.', ballPlayer: 'Cellilli M.', winner: 'Chantada M.', winnerScore: '6-2 / 6-0' },
  { group: INTERZONAL_GROUP, round: 4, date: '2026-05-03', time: '12:00', playerA: 'Beitia J.', playerB: 'Bernardini G.', ballPlayer: 'Beitia J.', winner: 'Bernardini G.', winnerScore: '6-3 / 6-2' },
  { group: INTERZONAL_GROUP, round: 4, date: '2026-03-31', time: '10:00', playerA: 'Malcangi R.', playerB: 'Blanco J.', ballPlayer: 'Malcangi R.', winner: 'Malcangi R.', winnerScore: '3-6 / 6-4 / 10-8' },
  { group: INTERZONAL_GROUP, round: 4, date: '2026-04-05', time: '10:30', playerA: 'Repecka J.', playerB: 'Cardozo M.', ballPlayer: 'Repecka J.', winner: 'Repecka J.', winnerScore: '6-3 / 6-1', note: 'Corregido como Interzonal aunque en el chat figure Grupo B.' },
  { group: INTERZONAL_GROUP, round: 4, playerA: 'Anetta D.', playerB: 'Murchio M.', ballPlayer: 'Anetta D.', winner: 'Murchio M.', winnerScore: 'W.O.', status: 'walkover' },
  { group: INTERZONAL_GROUP, round: 4, date: '2026-05-03', time: '11:30', playerA: 'Garcia J.', playerB: 'Vera F.', ballPlayer: 'Garcia J.', winner: 'Vera F.', winnerScore: '2-6 / 6-3 / 15-13' },
  { group: 'Repechaje', round: 0, date: '2026-05-10', time: '16:00', playerA: 'Blanco J.', playerB: 'Malcangi R.', ballPlayer: 'Blanco J.', winner: 'Blanco J.', winnerScore: 'W.O.', status: 'walkover', note: 'W.O. por lesión de Malcangi R.' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-10', time: '11:30', playerA: 'Repecka J.', playerB: 'Blanco J.', ballPlayer: 'Repecka J.', winner: 'Repecka J.', winnerScore: '6-2 / 6-4' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-09', time: '08:00', playerA: 'Chantada M.', playerB: 'Vera F.', ballPlayer: 'Chantada M.', winner: 'Vera F.', winnerScore: '6-4 / 6-1' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-15', time: '21:00', playerA: 'Bernardini G.', playerB: 'Garcia J.', ballPlayer: 'Bernardini G.', winner: 'Bernardini G.', winnerScore: '5-7 / 6-4 / 10-7' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-17', time: '17:00', playerA: 'Murchio M.', playerB: 'Beitia J.', ballPlayer: 'Murchio M.', winner: 'Beitia J.', winnerScore: '6-3 / 6-3' },
  { group: 'Semifinales', round: 0, date: '2026-05-20', time: '20:00', playerA: 'Repecka J.', playerB: 'Vera F.', ballPlayer: 'Repecka J.', winner: 'Vera F.', winnerScore: '6-1 / 7-6' },
  { group: 'Semifinales', round: 0, playerA: 'Bernardini G.', playerB: 'Beitia J.', note: 'Pendiente / sin resultado cargado.' },
];

function playerId(name: string): string {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `p-l4nd-${normalized}`;
}

function cleanPlayerName(raw: string): string {
  return raw.replace(/\s*\(P\)\s*$/i, '').replace(/^\s*\(P\)\s*/i, '').trim();
}

function dedupeKey(m: Pick<SeedMatch, 'group' | 'round' | 'playerA' | 'playerB'>): string {
  return `${TOURNAMENT_ID}|${m.round}|${m.group}|${cleanPlayerName(m.playerA).toLowerCase()}|${cleanPlayerName(m.playerB).toLowerCase()}`;
}

function matchId(index: number): string {
  return `l4nd-${String(index + 1).padStart(2, '0')}`;
}

function stageFor(group: string): MatchStage {
  if (group === 'Cuartos de Final') return 'quarterfinal';
  if (group === 'Semifinales') return 'semifinal';
  if (group === 'Repechaje') return 'repechage';
  if (group === INTERZONAL_GROUP) return 'interzonal';
  return 'group';
}

function roundLabel(row: SeedMatch): string {
  if (row.group === 'A' || row.group === 'B' || row.group === 'C') return `Grupo ${row.group} - Fecha ${row.round}`;
  if (row.group === INTERZONAL_GROUP) return 'Interzonal';
  return row.group;
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

async function main() {
  const allPlayers = Array.from(new Set(Object.values(groups).flat()));
  await prisma.$transaction(async (tx) => {
    for (const name of allPlayers) {
      await tx.player.upsert({
        where: { id: playerId(name) },
        create: { id: playerId(name), name, displayName: name, category: 'Cuarta', nationality: 'Argentina' },
        update: { name, displayName: name, category: 'Cuarta' },
      });
    }

    await tx.tournament.upsert({
      where: { id: TOURNAMENT_ID },
      create: {
        id: TOURNAMENT_ID,
        slug: 'novak-djokovic-liga-4',
        name: 'Novak Djokovic - Liga 4',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-03-15T00:00:00.000Z'),
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'novaknegro.jpg',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'novak-djokovic-liga-4',
        name: 'Novak Djokovic - Liga 4',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'novaknegro.jpg',
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
        await tx.groupPlayer.upsert({
          where: { groupId_playerId: { groupId: group.id, playerId: playerId(name) } },
          create: { groupId: group.id, playerId: playerId(name), seed: index + 1 },
          update: { seed: index + 1 },
        });
      }
    }

    for (const [index, row] of fixtures.entries()) {
      const id = matchId(index);
      const score = scoreForPlayerA(row);
      const hasWinner = Boolean(row.winner);
      const winnerId = row.winner ? playerId(row.winner) : null;
      const loser = row.winner === row.playerA ? row.playerB : row.winner === row.playerB ? row.playerA : null;
      const scheduledDate = row.date ? new Date(`${row.date}T00:00:00.000Z`) : null;
      const note = [row.ballPlayer ? `Jugador con pelotas: ${row.ballPlayer}.` : '', row.note ?? ''].filter(Boolean).join(' ');
      const groupId = groupIds.get(row.group) ?? null;

      await tx.match.upsert({
        where: { id },
        create: {
          id,
          tournamentId: TOURNAMENT_ID,
          tournamentLeagueId: league.id,
          groupId,
          stage: stageFor(row.group),
          roundLabel: roundLabel(row),
          player1Id: playerId(row.playerA),
          player2Id: playerId(row.playerB),
          winnerId,
          loserId: loser ? playerId(loser) : null,
          score,
          scheduleStatus: scheduledDate || row.time ? 'confirmed' : 'unscheduled',
          scheduledDate,
          scheduledTime: row.time ?? null,
          completed: hasWinner,
        },
        update: {
          tournamentLeagueId: league.id,
          groupId,
          stage: stageFor(row.group),
          roundLabel: roundLabel(row),
          player1Id: playerId(row.playerA),
          player2Id: playerId(row.playerB),
          winnerId,
          loserId: loser ? playerId(loser) : null,
          score,
          scheduleStatus: scheduledDate || row.time ? 'confirmed' : 'unscheduled',
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
          scheduleStatus: scheduledDate || row.time ? 'confirmed' : 'unscheduled',
          date: row.date ?? null,
          time: row.time ?? null,
          note: note || null,
        },
        update: {
          scheduleStatus: scheduledDate || row.time ? 'confirmed' : 'unscheduled',
          date: row.date ?? null,
          time: row.time ?? null,
          note: note || null,
        },
      });

      if (!hasWinner) continue;
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
          playedAt: scheduledDate,
        },
        update: {
          matchId: id,
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
  });

  const ranking = await recalculateRankings(prisma);
  console.log(`Novak Djokovic - Liga 4 seed listo: ${fixtures.length} partidos, ${ranking.rowsWritten} filas de ranking recalculadas.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
