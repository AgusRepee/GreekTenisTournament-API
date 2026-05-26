import '../envBootstrap.js';
import type { MatchResultStatus, MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

const TOURNAMENT_ID = 't-novak-l5';
const LEAGUE_NUM = 5;
const CLASSIFICATION_RULE =
  'Los tres primeros de cada grupo clasifican a Play Off. Los dos peores terceros juegan Repechaje. El ganador entra a Cuartos como octavo clasificado. Cruces: 1° vs 8°, 2° vs 7°, 3° vs 6°, 4° vs 5°.';

const groups = {
  A: ['Ríos J.', 'Peralta G.', 'Oviedo M.', 'Ali M.', 'Manrique E.'],
  B: ['González Días F.', 'Chantada S.', 'Sola M.', 'Cirigliano D.', 'Córdoba A.'],
  C: ['Córdoba G.', 'González Días C.', 'Tellechea L.', 'Vila E.', 'Giménez F.'],
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
  { group: 'A', round: 1, date: '2026-03-11', time: '21:00', playerA: 'Ríos J.', playerB: 'Ali M.', ballPlayer: 'Ríos J.', winner: 'Ríos J.', winnerScore: '5-7 / 6-3 / 11-9' },
  { group: 'A', round: 5, date: '2026-03-14', time: '14:00', playerA: 'Oviedo M.', playerB: 'Manrique E.', ballPlayer: 'Oviedo M.', winner: 'Oviedo M.', winnerScore: '6-4 / 6-2' },
  { group: 'A', round: 1, date: '2026-03-22', time: '18:00', playerA: 'Peralta G.', playerB: 'Oviedo M.', ballPlayer: 'Peralta G.', winner: 'Peralta G.', winnerScore: '6-3 / 6-1' },
  { group: 'A', round: 3, date: '2026-03-23', time: '11:00', playerA: 'Manrique E.', playerB: 'Ali M.', ballPlayer: 'Manrique E.', winner: 'Ali M.', winnerScore: '6-2 / 6-2' },
  { group: 'A', round: 2, date: '2026-04-03', time: '18:00', playerA: 'Ríos J.', playerB: 'Oviedo M.', ballPlayer: 'Ríos J.', winner: 'Ríos J.', winnerScore: '4-6 / 6-2 / 10-7' },
  { group: 'A', round: 5, date: '2026-04-05', time: '19:00', playerA: 'Ali M.', playerB: 'Peralta G.', ballPlayer: 'Ali M.', winner: 'Peralta G.', winnerScore: '6-2 / 7-5' },
  { group: 'A', round: 3, date: '2026-04-12', time: '20:00', playerA: 'Ríos J.', playerB: 'Peralta G.', ballPlayer: 'Ríos J.', winner: 'Ríos J.', winnerScore: '6-3 / 6-2' },
  { group: 'A', round: 4, date: '2026-04-18', time: '18:30', playerA: 'Ali M.', playerB: 'Oviedo M.', ballPlayer: 'Ali M.', winner: 'Oviedo M.', winnerScore: '6-0 / 6-1' },
  { group: 'A', round: 4, date: '2026-04-25', time: '11:30', playerA: 'Manrique E.', playerB: 'Ríos J.', ballPlayer: 'Manrique E.', winner: 'Ríos J.', winnerScore: '6-0 / 6-4' },
  { group: 'A', round: 2, playerA: 'Peralta G.', playerB: 'Manrique E.', winner: 'Peralta G.', winnerScore: 'W.O.', status: 'walkover', note: 'Resultado informado el 06/05/2026.' },
  { group: 'B', round: 5, date: '2026-03-12', time: '21:00', playerA: 'González Días F.', playerB: 'Córdoba A.', ballPlayer: 'González Días F.', winner: 'González Días F.', winnerScore: '6-1 / 6-1', note: 'Corregido como Grupo B aunque en el chat figure Grupo C.' },
  { group: 'B', round: 2, date: '2026-03-22', time: '11:00', playerA: 'González Días F.', playerB: 'Sola M.', winner: 'González Días F.', winnerScore: '6-4 / 6-3' },
  { group: 'B', round: 1, date: '2026-03-26', time: '21:00', playerA: 'Cirigliano D.', playerB: 'Córdoba A.', ballPlayer: 'Cirigliano D.', winner: 'Cirigliano D.', winnerScore: 'W.O.', status: 'walkover' },
  { group: 'B', round: 3, playerA: 'González Días F.', playerB: 'Cirigliano D.', winner: 'González Días F.', winnerScore: '6-4 / 6-1', note: 'Resultado informado el 28/03/2026.' },
  { group: 'B', round: 3, date: '2026-04-02', time: '11:00', playerA: 'Sola M.', playerB: 'Córdoba A.', ballPlayer: 'Sola M.', winner: 'Sola M.', winnerScore: '6-2 / 6-0' },
  { group: 'B', round: 4, date: '2026-04-10', time: '11:00', playerA: 'Sola M.', playerB: 'Cirigliano D.', ballPlayer: 'Sola M.', winner: 'Sola M.', winnerScore: '6-4 / 6-3' },
  { group: 'B', round: 1, date: '2026-04-12', time: '18:00', playerA: 'González Días F.', playerB: 'Chantada S.', ballPlayer: 'González Días F.', winner: 'Chantada S.', winnerScore: '4-6 / 6-4 / 12-10' },
  { group: 'B', round: 5, date: '2026-04-18', time: '11:30', playerA: 'Chantada S.', playerB: 'Sola M.', ballPlayer: 'Chantada S.', winner: 'Chantada S.', winnerScore: '1-6 / 6-4 / 10-8', note: 'Reprogramado desde el 29/03/2026.' },
  { group: 'B', round: 2, date: '2026-04-27', time: '20:00', playerA: 'Chantada S.', playerB: 'Cirigliano D.', ballPlayer: 'Chantada S.', winner: 'Cirigliano D.', winnerScore: '6-3 / 2-6 / 10-5' },
  { group: 'B', round: 4, playerA: 'Chantada S.', playerB: 'Córdoba A.', winner: 'Chantada S.', winnerScore: 'W.O.', status: 'walkover', note: 'Resultado informado el 06/05/2026.' },
  { group: 'C', round: 4, date: '2026-03-19', time: '08:30', playerA: 'Vila E.', playerB: 'Tellechea L.', ballPlayer: 'Vila E.', winner: 'Tellechea L.', winnerScore: '6-3 / 6-4' },
  { group: 'C', round: 1, date: '2026-03-19', time: '21:00', playerA: 'Córdoba G.', playerB: 'Giménez F.', ballPlayer: 'Córdoba G.', winner: 'Córdoba G.', winnerScore: '6-2 / 6-7 / 10-8' },
  { group: 'C', round: 1, date: '2026-03-23', time: '20:45', playerA: 'Tellechea L.', playerB: 'González Días C.', ballPlayer: 'Tellechea L.', winner: 'González Días C.', winnerScore: '7-6 / 6-1' },
  { group: 'C', round: 5, date: '2026-04-05', time: '18:00', playerA: 'González Días C.', playerB: 'Córdoba G.', ballPlayer: 'González Días C.', winner: 'Córdoba G.', winnerScore: '6-3 / 6-0' },
  { group: 'C', round: 3, date: '2026-04-09', time: '12:00', playerA: 'Tellechea L.', playerB: 'Córdoba G.', ballPlayer: 'Tellechea L.', winner: 'Córdoba G.', winnerScore: '6-2 / 6-4' },
  { group: 'C', round: 3, date: '2026-04-14', time: '09:00', playerA: 'Vila E.', playerB: 'González Días C.', ballPlayer: 'Vila E.', winner: 'González Días C.', winnerScore: '6-3 / 6-3' },
  { group: 'C', round: 2, date: '2026-04-23', time: '10:00', playerA: 'Córdoba G.', playerB: 'Vila E.', ballPlayer: 'Córdoba G.', winner: 'Córdoba G.', winnerScore: '6-1 / 6-1' },
  { group: 'C', round: 4, date: '2026-05-01', time: '11:00', playerA: 'González Días C.', playerB: 'Giménez F.', ballPlayer: 'González Días C.', winner: 'González Días C.', winnerScore: '6-4 / 6-3' },
  { group: 'C', round: 2, playerA: 'Tellechea L.', playerB: 'Giménez F.', winner: 'Tellechea L.', winnerScore: 'W.O.', status: 'walkover', note: 'Resultado informado el 06/05/2026.' },
  { group: 'C', round: 5, playerA: 'Vila E.', playerB: 'Giménez F.', winner: 'Vila E.', winnerScore: 'W.O.', status: 'walkover', note: 'Resultado informado el 06/05/2026.' },
  { group: 'Repechaje', round: 0, date: '2026-05-08', time: '09:00', playerA: 'Tellechea L.', playerB: 'Sola M.', ballPlayer: 'Tellechea L.', winner: 'Sola M.', winnerScore: '3-6 / 6-3 / 10-6' },
  { group: 'Cuartos de Final', round: 0, playerA: 'Córdoba G.', playerB: 'Sola M.', note: 'Pendiente / sin resultado cargado. Sola M. entra desde Repechaje.' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-11', time: '08:30', playerA: 'González Días C.', playerB: 'Peralta G.', ballPlayer: 'González Días C.', winner: 'González Días C.', winnerScore: '6-1 / 6-2' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-10', time: '16:00', playerA: 'González Días F.', playerB: 'Chantada S.', ballPlayer: 'González Días F.', winner: 'González Días F.', winnerScore: '6-0 / 4-1 y abandono', status: 'retired' },
  { group: 'Cuartos de Final', round: 0, date: '2026-05-10', time: '17:00', playerA: 'Oviedo M.', playerB: 'Ríos J.', ballPlayer: 'Oviedo M.', winner: 'Ríos J.', winnerScore: '6-3 / 6-1' },
];

function playerId(name: string): string {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `p-l5nd-${normalized}`;
}

function cleanPlayerName(raw: string): string {
  return raw.replace(/\s*\(P\)\s*$/i, '').replace(/^\s*\(P\)\s*/i, '').trim();
}

function dedupeKey(m: Pick<SeedMatch, 'group' | 'round' | 'playerA' | 'playerB'>): string {
  return `${TOURNAMENT_ID}|${m.round}|${m.group}|${cleanPlayerName(m.playerA).toLowerCase()}|${cleanPlayerName(m.playerB).toLowerCase()}`;
}

function matchId(index: number): string {
  return `l5nd-${String(index + 1).padStart(2, '0')}`;
}

function stageFor(group: string): MatchStage {
  if (group === 'Cuartos de Final') return 'quarterfinal';
  if (group === 'Repechaje') return 'repechage';
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
    nota: CLASSIFICATION_RULE,
  };
}

async function main() {
  const allPlayers = Array.from(new Set(Object.values(groups).flat()));
  await prisma.$transaction(async (tx) => {
    for (const name of allPlayers) {
      await tx.player.upsert({
        where: { id: playerId(name) },
        create: { id: playerId(name), name, displayName: name, category: 'Quinta A', nationality: 'Argentina' },
        update: { name, displayName: name, category: 'Quinta A' },
      });
    }

    await tx.tournament.upsert({
      where: { id: TOURNAMENT_ID },
      create: {
        id: TOURNAMENT_ID,
        slug: 'novak-djokovic-liga-5',
        name: 'Novak Djokovic - Liga 5',
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: new Date('2026-03-11T00:00:00.000Z'),
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        location: 'Club de Tenis',
        coverImage: 'novaknegro.jpg',
        slotsTotal: allPlayers.length,
        slotsTaken: allPlayers.length,
        ligaDoc: ligaDoc(),
      },
      update: {
        slug: 'novak-djokovic-liga-5',
        name: 'Novak Djokovic - Liga 5',
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

      await tx.match.upsert({
        where: { id },
        create: {
          id,
          tournamentId: TOURNAMENT_ID,
          tournamentLeagueId: league.id,
          groupId: groupIds.get(row.group) ?? null,
          stage: stageFor(row.group),
          roundLabel: row.group === 'A' || row.group === 'B' || row.group === 'C' ? `Grupo ${row.group} - Fecha ${row.round}` : row.group,
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
          groupId: groupIds.get(row.group) ?? null,
          stage: stageFor(row.group),
          roundLabel: row.group === 'A' || row.group === 'B' || row.group === 'C' ? `Grupo ${row.group} - Fecha ${row.round}` : row.group,
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
  await prisma.tournament.deleteMany({ where: { id: 't-liga5-nd-2026' } });
  console.log(`Novak Djokovic - Liga 5 seed listo: ${fixtures.length} partidos, ${ranking.rowsWritten} filas de ranking recalculadas.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
