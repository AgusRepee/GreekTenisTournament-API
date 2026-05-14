import '../envBootstrap.js';
import type { MatchResultStatus, MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-novak-l2';
const LEAGUE_NUM = 2;
const INCONSISTENCY =
  'Grupo A - Cancio M. a Cancio M. 6-4/6-1: no se carga porque Cancio M. no puede jugar contra sí mismo; rival pendiente de confirmación.';

const groups = {
  A: ['Colomer S.', 'Monzón M.', 'Cancio M.', 'Del Pino A.', 'Lacave L.'],
  B: ['Mayer D.', 'Ruiz J.', 'Guareschi A.', 'Komesu M.', 'Ferreyra O.'],
  C: ['Rossi F.', 'Molina L.', 'Scilipoti N.', 'Gadea M.', 'Fredkin B.'],
} as const;

type SeedMatch = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  winner: string;
  score: string;
  status?: MatchResultStatus;
};

const results: SeedMatch[] = [
  { group: 'A', round: 5, playerA: 'Colomer S.', playerB: 'Monzón M.', winner: 'Colomer S.', score: '6-3 / 4-1 y abandono', status: 'retired' },
  { group: 'A', round: 5, playerA: 'Cancio M.', playerB: 'Del Pino A.', winner: 'Cancio M.', score: '6-4 / 1-6 / 10-8' },
  { group: 'A', round: 2, playerA: 'Lacave L.', playerB: 'Cancio M.', winner: 'Lacave L.', score: '6-7 / 6-4 / 10-4' },
  { group: 'A', round: 2, playerA: 'Colomer S.', playerB: 'Del Pino A.', winner: 'Colomer S.', score: '6-3 / 6-4' },
  { group: 'A', round: 1, playerA: 'Lacave L.', playerB: 'Monzón M.', winner: 'Lacave L.', score: '6-1 / 6-1' },
  { group: 'A', round: 1, playerA: 'Colomer S.', playerB: 'Cancio M.', winner: 'Colomer S.', score: '3-6 / 6-3 / 10-6' },
  { group: 'A', round: 3, playerA: 'Monzón M.', playerB: 'Del Pino A.', winner: 'Monzón M.', score: '4-6 / 6-0 / 10-4' },
  { group: 'A', round: 4, playerA: 'Cancio M.', playerB: 'Monzón M.', winner: 'Cancio M.', score: '6-1 / 6-4' },
  { group: 'A', round: 3, playerA: 'Lacave L.', playerB: 'Colomer S.', winner: 'Lacave L.', score: '7-5 / 6-4' },
  { group: 'B', round: 3, playerA: 'Mayer D.', playerB: 'Ruiz J.', winner: 'Mayer D.', score: '6-1 / 7-5' },
  { group: 'B', round: 1, playerA: 'Guareschi A.', playerB: 'Komesu M.', winner: 'Guareschi A.', score: '6-2 / 6-4' },
  { group: 'B', round: 1, playerA: 'Ferreyra O.', playerB: 'Ruiz J.', winner: 'Ferreyra O.', score: '6-4 / 3-6 / 10-3' },
  { group: 'B', round: 5, playerA: 'Mayer D.', playerB: 'Guareschi A.', winner: 'Mayer D.', score: '5-7 / 7-6 / 10-7' },
  { group: 'B', round: 2, playerA: 'Guareschi A.', playerB: 'Ferreyra O.', winner: 'Guareschi A.', score: '6-2 / 6-3' },
  { group: 'B', round: 4, playerA: 'Mayer D.', playerB: 'Ferreyra O.', winner: 'Mayer D.', score: '6-3 / 3-6 / 10-3' },
  { group: 'B', round: 2, playerA: 'Komesu M.', playerB: 'Mayer D.', winner: 'Komesu M.', score: '7-5 / 7-6' },
  { group: 'B', round: 4, playerA: 'Guareschi A.', playerB: 'Ruiz J.', winner: 'Guareschi A.', score: '6-1 / 7-6' },
  { group: 'B', round: 3, playerA: 'Komesu M.', playerB: 'Ferreyra O.', winner: 'Komesu M.', score: '5-7 / 6-2 / 11-9' },
  { group: 'B', round: 5, playerA: 'Komesu M.', playerB: 'Ruiz J.', winner: 'Komesu M.', score: '6-3 / 6-2' },
  { group: 'C', round: 3, playerA: 'Rossi F.', playerB: 'Molina L.', winner: 'Rossi F.', score: '6-0 / 6-2' },
  { group: 'C', round: 5, playerA: 'Scilipoti N.', playerB: 'Gadea M.', winner: 'Scilipoti N.', score: '6-0 / 6-1' },
  { group: 'C', round: 1, playerA: 'Rossi F.', playerB: 'Fredkin B.', winner: 'Rossi F.', score: '6-0 / 6-2' },
  { group: 'C', round: 3, playerA: 'Fredkin B.', playerB: 'Gadea M.', winner: 'Fredkin B.', score: '6-4 / 6-3' },
  { group: 'C', round: 1, playerA: 'Scilipoti N.', playerB: 'Molina L.', winner: 'Scilipoti N.', score: '6-1 / 6-2' },
  { group: 'C', round: 4, playerA: 'Rossi F.', playerB: 'Gadea M.', winner: 'Rossi F.', score: '6-2 / 6-2' },
  { group: 'C', round: 4, playerA: 'Fredkin B.', playerB: 'Scilipoti N.', winner: 'Fredkin B.', score: '6-4 / 2-6 / 10-2' },
  { group: 'C', round: 5, playerA: 'Fredkin B.', playerB: 'Molina L.', winner: 'Fredkin B.', score: '6-1 / 7-5' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Lacave L.', playerB: 'Mayer D.', winner: 'Lacave L.', score: '6-3 / 6-4' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Colomer S.', playerB: 'Komesu M.', winner: 'Colomer S.', score: '6-7 / 7-5 / 10-6' },
];

function playerId(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `p-l2-${normalized}`;
}

function cleanPlayerName(raw: string): string {
  return raw
    .replace(/\s*\(P\)\s*$/i, '')
    .replace(/^\s*\(P\)\s*/i, '')
    .trim();
}

function dedupeKey(m: SeedMatch): string {
  return `${TOURNAMENT_ID}|${m.round}|${m.group}|${cleanPlayerName(m.playerA).toLowerCase()}|${cleanPlayerName(m.playerB).toLowerCase()}`;
}

function matchId(index: number): string {
  return `l2-${String(index + 1).padStart(2, '0')}`;
}

function stageFor(group: string): MatchStage {
  return group === 'Cuartos de Final' ? 'quarterfinal' : 'group';
}

function ligaDoc(): Prisma.InputJsonValue {
  return {
    torneo: 'Novak Djokovic',
    liga: LEAGUE_NUM,
    grupos: groups,
    fechas: [],
    nota: '(P): Jugador asignado para llevar pelotas en ese partido.',
    inconsistenciasPendientes: [INCONSISTENCY],
  };
}

async function main() {
  const allPlayers = Array.from(new Set(Object.values(groups).flat()));
  await prisma.$transaction(async (tx) => {
    for (const name of allPlayers) {
      await tx.player.upsert({
        where: { id: playerId(name) },
        create: {
          id: playerId(name),
          name,
          displayName: name,
          category: 'Segunda',
          nationality: 'Argentina',
        },
        update: {
          name,
          displayName: name,
          category: 'Segunda',
        },
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
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'novaknaranja.jpg',
        slotsTotal: 15,
        slotsTaken: 15,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'liga-2',
        name: 'Novak Djokovic - Liga 2',
        tournamentType: 'greek500',
        status: 'upcoming',
        location: 'Club de Tenis',
        coverImage: 'novaknaranja.jpg',
        slotsTotal: 15,
        slotsTaken: 15,
        ligaDoc: ligaDoc(),
      },
    });

    const league = await tx.tournamentLeague.upsert({
      where: { tournamentId_leagueNum: { tournamentId: TOURNAMENT_ID, leagueNum: LEAGUE_NUM } },
      create: {
        tournamentId: TOURNAMENT_ID,
        leagueNum: LEAGUE_NUM,
        groupStageStatus: 'confirmed',
      },
      update: {
        groupStageStatus: 'confirmed',
      },
    });

    const groupIds = new Map<string, string>();
    for (const [key, names] of Object.entries(groups)) {
      const group = await tx.group.upsert({
        where: { tournamentId_key: { tournamentId: TOURNAMENT_ID, key } },
        create: {
          tournamentId: TOURNAMENT_ID,
          key,
          displayName: `Grupo ${key}`,
        },
        update: {
          displayName: `Grupo ${key}`,
        },
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

    for (const [index, row] of results.entries()) {
      const id = matchId(index);
      const winnerId = playerId(row.winner);
      const loser = row.winner === row.playerA ? row.playerB : row.playerA;
      await tx.match.upsert({
        where: { id },
        create: {
          id,
          tournamentId: TOURNAMENT_ID,
          tournamentLeagueId: league.id,
          groupId: groupIds.get(row.group) ?? null,
          stage: stageFor(row.group),
          roundLabel: row.group === 'Cuartos de Final' ? 'Cuartos de Final' : `Grupo ${row.group} - Fecha ${row.round}`,
          player1Id: playerId(row.playerA),
          player2Id: playerId(row.playerB),
          winnerId,
          loserId: playerId(loser),
          score: row.score,
          scheduleStatus: 'unscheduled',
          completed: true,
        },
        update: {
          tournamentLeagueId: league.id,
          groupId: groupIds.get(row.group) ?? null,
          stage: stageFor(row.group),
          roundLabel: row.group === 'Cuartos de Final' ? 'Cuartos de Final' : `Grupo ${row.group} - Fecha ${row.round}`,
          player1Id: playerId(row.playerA),
          player2Id: playerId(row.playerB),
          winnerId,
          loserId: playerId(loser),
          score: row.score,
          scheduleStatus: 'unscheduled',
          scheduledDate: null,
          scheduledTime: null,
          completed: true,
        },
      });

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
          score: row.score,
          status: row.status ?? 'played',
          playedAt: null,
        },
        update: {
          matchId: id,
          groupKey: row.group,
          roundNum: row.round,
          playerA: row.playerA,
          playerB: row.playerB,
          score: row.score,
          status: row.status ?? 'played',
          playedAt: null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: 'data_inconsistency_pending',
        entity: 'Tournament',
        entityId: TOURNAMENT_ID,
        tournamentId: TOURNAMENT_ID,
        league: String(LEAGUE_NUM),
        payload: { message: INCONSISTENCY },
      },
    });
  });

  const ranking = await recalculateRankings(prisma);
  console.log(`Liga 2 seed listo: ${results.length} resultados, ${ranking.rowsWritten} filas de ranking recalculadas.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
