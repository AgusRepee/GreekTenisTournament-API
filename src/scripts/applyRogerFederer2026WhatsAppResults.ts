/**
 * Carga resultados WhatsApp Roger Federer 2026 (L1–L6). No cierra fase de grupos.
 * Idempotente: omite partidos ya cargados con el mismo marcador.
 */
import '../envBootstrap.js';
import type { MatchResultStatus, ScheduleStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

type ResultRow = {
  tournamentId: string;
  leagueNum: number;
  playerA: string;
  playerB: string;
  winner: string;
  score: string;
  date: string;
  time: string;
  status?: MatchResultStatus;
  groupHint?: string;
  roundHint?: number;
};

const ALIASES: Record<string, string> = {
  'Ávalos G.': 'Avalos G.',
  'Giménez F.': 'Gimenez F.',
  'Córdoba G.': 'Cordoba G.',
  'Gonzalez Días C.': 'Gonzalez Días C.',
  'Gonzalez Días F.': 'Gonzalez Días F.',
};

function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function canon(name: string): string {
  return ALIASES[name] ?? name;
}

function parseDateIso(dmy: string): string {
  const [dd, mm, yyyy] = dmy.split('/');
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function dedupeKey(tournamentId: string, group: string, round: number, playerA: string, playerB: string): string {
  return `${tournamentId}|${round}|${group}|${normName(playerA)}|${normName(playerB)}`;
}

function normScore(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Extrae pares de games por set (ej. "2-6 / 3-6" → [[2,6],[3,6]]). */
export function parseSetPairs(score: string): number[][] {
  const cleaned = score
    .replace(/\by\s+retiro\b/gi, '')
    .replace(/\babandono\b/gi, '')
    .trim();
  const out: number[][] = [];
  const re = /(\d+)\s*-\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    out.push([Number(m[1]), Number(m[2])]);
  }
  return out;
}

/**
 * Convierte sets a perspectiva fixture (player1 games, player2 games).
 * - stored: el texto ya viene en orden player1-player2 (como en Match.score).
 * - incoming: cada "X-Y" suele ser games ganador-perdedor; se orienta con winnerId.
 */
export function setsInFixtureOrder(
  pairs: number[][],
  p1Id: string,
  _p2Id: string,
  winnerId: string | null,
  mode: 'stored' | 'incoming',
): number[][] {
  if (mode === 'stored' || !winnerId || pairs.length === 0) {
    return pairs.map(([a, b]) => [a, b]);
  }
  const winnerIsP1 = winnerId === p1Id;
  return pairs.map(([a, b]) => {
    if (a === b) return [a, b];
    const firstWonSet = a > b;
    if (winnerIsP1) {
      return firstWonSet ? [a, b] : [b, a];
    }
    return firstWonSet ? [b, a] : [a, b];
  });
}

export function setsEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  return a.every((s, i) => s[0] === b[i]![0] && s[1] === b[i]![1]);
}

/** ¿Mismo resultado en perspectiva player1/player2 del partido? */
export function scoresEquivalentForFixture(
  storedScore: string,
  incomingScore: string,
  winnerId: string,
  p1Id: string,
  p2Id: string,
): boolean {
  const stored = setsInFixtureOrder(parseSetPairs(storedScore), p1Id, p2Id, null, 'stored');
  const incoming = setsInFixtureOrder(parseSetPairs(incomingScore), p1Id, p2Id, winnerId, 'incoming');
  return setsEqual(stored, incoming);
}

export function shouldSkipCompletedMatch(
  match: {
    completed: boolean;
    score: string | null;
    winnerId: string | null;
    player1Id: string;
    player2Id: string;
  },
  incomingScore: string,
  incomingWinnerId: string,
): { skip: boolean; conflict: boolean; reason?: string } {
  if (!match.completed) return { skip: false, conflict: false };
  if (match.winnerId && match.winnerId !== incomingWinnerId) {
    return { skip: false, conflict: true, reason: 'ganador distinto' };
  }
  const stored = match.score?.trim() ?? '';
  if (!stored) return { skip: false, conflict: false };
  if (normScore(stored) === normScore(incomingScore)) {
    return { skip: true, conflict: false, reason: 'mismo texto' };
  }
  if (
    scoresEquivalentForFixture(stored, incomingScore, incomingWinnerId, match.player1Id, match.player2Id)
  ) {
    return { skip: true, conflict: false, reason: 'score equivalente (perspectiva fixture)' };
  }
  return { skip: false, conflict: true, reason: 'otro marcador' };
}

function winnerIdFor(
  match: { player1: { id: string; name: string; displayName: string | null }; player2: { id: string; name: string; displayName: string | null } },
  winnerLabel: string,
): string {
  const w = normName(canon(winnerLabel));
  for (const p of [match.player1, match.player2]) {
    if (normName(p.name) === w || normName(p.displayName ?? '') === w) return p.id;
  }
  throw new Error(`Ganador ${winnerLabel} no coincide con jugadores del partido`);
}

async function findMatch(row: ResultRow) {
  const a = canon(row.playerA);
  const b = canon(row.playerB);
  const na = normName(a);
  const nb = normName(b);
  const matches = await prisma.match.findMany({
    where: { tournamentId: row.tournamentId },
    include: { player1: true, player2: true, group: true },
  });
  return (
    matches.find((m) => {
      const n1 = normName(m.player1.name);
      const n2 = normName(m.player2.name);
      const d1 = normName(m.player1.displayName ?? '');
      const d2 = normName(m.player2.displayName ?? '');
      const hit = (x: string, y: string) =>
        (x === na || x === nb) && (y === na || y === nb) && x !== y;
      return hit(n1, n2) || hit(d1, d2) || hit(n1, d2) || hit(d1, n2);
    }) ?? null
  );
}

async function applyOne(row: ResultRow, report: { loaded: string[]; skipped: string[]; conflicts: string[] }) {
  const match = await findMatch(row);
  if (!match) {
    report.conflicts.push(`Sin partido: ${row.tournamentId} ${row.playerA} vs ${row.playerB}`);
    return;
  }

  const status: MatchResultStatus = row.status ?? 'played';
  const score = row.score.trim();
  const winnerId = winnerIdFor(match, row.winner);
  const skipCheck = shouldSkipCompletedMatch(
    {
      completed: match.completed,
      score: match.score,
      winnerId: match.winnerId,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
    },
    score,
    winnerId,
  );
  if (skipCheck.conflict) {
    report.conflicts.push(
      `${match.id} ya tiene otro resultado (${skipCheck.reason}): ${match.score ?? '(sin score)'}`,
    );
    return;
  }
  if (skipCheck.skip) {
    report.skipped.push(`${match.id} (ya cargado${skipCheck.reason ? `, ${skipCheck.reason}` : ''})`);
    return;
  }

  const groupKey =
    match.group?.key ?? (match.stage === 'interzonal' ? 'Interzonal' : row.groupHint ?? 'A');
  const roundFromLabel = /Fecha (\d+)/.exec(match.roundLabel ?? '');
  const roundNum = roundFromLabel
    ? Number(roundFromLabel[1])
    : match.stage === 'interzonal'
      ? 4
      : (row.roundHint ?? 0);

  const playerA = match.player1.name;
  const playerB = match.player2.name;
  const key = dedupeKey(row.tournamentId, groupKey, roundNum, playerA, playerB);
  const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
  const playedAt = new Date(`${parseDateIso(row.date)}T12:00:00.000Z`);
  const scheduleStatus: ScheduleStatus = 'confirmed';

  await prisma.$transaction(async (tx) => {
    await tx.tournamentScheduleEntry.upsert({
      where: { dedupeKey: key },
      create: {
        dedupeKey: key,
        tournamentId: row.tournamentId,
        leagueNum: row.leagueNum,
        scheduleStatus,
        date: parseDateIso(row.date),
        time: row.time,
        note: null,
      },
      update: {
        scheduleStatus,
        date: parseDateIso(row.date),
        time: row.time,
      },
    });

    await tx.match.update({
      where: { id: match.id },
      data: {
        winnerId,
        loserId,
        score,
        completed: true,
        scheduleStatus,
        scheduledDate: playedAt,
        scheduledTime: row.time,
      },
    });

    await tx.matchResult.upsert({
      where: { dedupeKey: key },
      create: {
        dedupeKey: key,
        tournamentId: row.tournamentId,
        matchId: match.id,
        groupKey,
        roundNum,
        playerA,
        playerB,
        score,
        status,
        playedAt,
      },
      update: {
        matchId: match.id,
        groupKey,
        roundNum,
        playerA,
        playerB,
        score,
        status,
        playedAt,
      },
    });
  });

  report.loaded.push(`${match.id} ${playerA} vs ${playerB} → ${score}`);
}

const RESULTS: ResultRow[] = [
  // Liga 1
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Rossi F.', playerB: 'Garassi A.', winner: 'Garassi A.', score: '6-3 / 3-6 / 11-9', date: '05/09/2026', time: '11:30', groupHint: 'C', roundHint: 1 },
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Naddeo M.', playerB: 'Rothkel M.', winner: 'Rothkel M.', score: '2-6 / 6-1 / 10-4', date: '06/09/2026', time: '18:00', groupHint: 'A', roundHint: 1 },
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Pfening G.', playerB: 'Naddeo M.', winner: 'Pfening G.', score: '6-2 / 6-1', date: '11/09/2026', time: '18:00', groupHint: 'A', roundHint: 2 },
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Repecka A.', playerB: 'Alvarez I.', winner: 'Alvarez I.', score: '6-2 / 6-3', date: '12/09/2026', time: '11:30', groupHint: 'B', roundHint: 2 },
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Guidobono A.', playerB: 'Filosa M.', winner: 'Filosa M.', score: '6-2 / 6-1', date: '13/09/2026', time: '18:00', groupHint: 'C', roundHint: 1 },
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Gaudina A.', playerB: 'Alvarez I.', winner: 'Gaudina A.', score: '6-4 / 6-2', date: '17/09/2026', time: '12:00', groupHint: 'B', roundHint: 2 },
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Rothkel M.', playerB: 'Pfening G.', winner: 'Pfening G.', score: '6-3 / 3-6 / 10-2', date: '24/09/2026', time: '20:00', groupHint: 'A', roundHint: 3 },
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Duarte D.', playerB: 'Rossi F.', winner: 'Rossi F.', score: '6-0 / 6-0', date: '04/10/2026', time: '11:00', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Naddeo M.', playerB: 'Filosa M.', winner: 'Filosa M.', score: '6-1 / 6-1', date: '04/10/2026', time: '11:30', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l1', leagueNum: 1, playerA: 'Rothkel M.', playerB: 'Gaudina A.', winner: 'Rothkel M.', score: '6-2 / 6-3', date: '04/10/2026', time: '17:00', groupHint: 'Interzonal', roundHint: 4 },
  // Liga 2
  { tournamentId: 't-federer-l2', leagueNum: 2, playerA: 'Casais R.', playerB: 'Urbini A.', winner: 'Urbini A.', score: '6-2 / 6-2', date: '10/09/2026', time: '09:00', groupHint: 'A', roundHint: 1 },
  { tournamentId: 't-federer-l2', leagueNum: 2, playerA: 'Masciotra J.', playerB: 'Marin G.', winner: 'Masciotra J.', score: '7-5 / 6-3', date: '10/09/2026', time: '10:00', groupHint: 'B', roundHint: 1 },
  { tournamentId: 't-federer-l2', leagueNum: 2, playerA: 'Mayer D.', playerB: 'Andrioli M.', winner: 'Andrioli M.', score: '6-1 / 6-3', date: '11/09/2026', time: '09:00', groupHint: 'C', roundHint: 1 },
  { tournamentId: 't-federer-l2', leagueNum: 2, playerA: 'Santi G.', playerB: 'Monzon M.', winner: 'Monzon M.', score: '6-0 / 6-4', date: '13/09/2026', time: '19:00', groupHint: 'C', roundHint: 2 },
  { tournamentId: 't-federer-l2', leagueNum: 2, playerA: 'Monzon M.', playerB: 'Andrioli M.', winner: 'Andrioli M.', score: '6-4 / 3-6 / 10-8', date: '18/09/2026', time: '13:00', groupHint: 'C', roundHint: 2 },
  { tournamentId: 't-federer-l2', leagueNum: 2, playerA: 'Cancio M.', playerB: 'Masciotra J.', winner: 'Cancio M.', score: '6-4 / 4-6 / 10-6', date: '20/09/2026', time: '11:30', groupHint: 'B', roundHint: 3 },
  { tournamentId: 't-federer-l2', leagueNum: 2, playerA: 'Urbini A.', playerB: 'Santi G.', winner: 'Santi G.', score: '6-3 / 6-1', date: '25/09/2026', time: '10:00', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l2', leagueNum: 2, playerA: 'Marin G.', playerB: 'Fernandez B.', winner: 'Fernandez B.', score: '6-3 / 6-4', date: '25/09/2026', time: '20:30', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l2', leagueNum: 2, playerA: 'Mayer D.', playerB: 'Monzon M.', winner: 'Mayer D.', score: '6-4 / 6-4', date: '04/10/2026', time: '19:30', groupHint: 'C', roundHint: 3 },
  // Liga 3 (Del Valle vs Rojas antes del reemplazo)
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Del Valle G.', playerB: 'Rojas L.', winner: 'Del Valle G.', score: '6-2 / 6-1', date: '30/08/2026', time: '19:00', groupHint: 'C', roundHint: 1 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Cordoba G.', playerB: 'Gadea M.', winner: 'Gadea M.', score: '6-2 / 7-5', date: '02/09/2026', time: '21:00', groupHint: 'B', roundHint: 3 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Vito C.', playerB: 'Figueroa M.', winner: 'Figueroa M.', score: '6-2 / 6-7 / 11-9', date: '05/09/2026', time: '18:30', groupHint: 'A', roundHint: 4 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Komesu F.', playerB: 'Santi Mat.', winner: 'Santi Mat.', score: '6-4 / 6-3', date: '06/09/2026', time: '19:00', groupHint: 'A', roundHint: 4 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Cordoba G.', playerB: 'Santi Mar.', winner: 'Santi Mar.', score: '6-3 / 6-3', date: '07/09/2026', time: '17:30', groupHint: 'B', roundHint: 3 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Aguirre W.', playerB: 'Rusel S.', winner: 'Rusel S.', score: '6-3 / 6-0', date: '13/09/2026', time: '19:30', groupHint: 'C', roundHint: 3 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Bocchicchio F.', playerB: 'Cordoba G.', winner: 'Bocchicchio F.', score: '4-6 / 3-1 y retiro', date: '14/09/2026', time: '18:00', status: 'retired', groupHint: 'B', roundHint: 4 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Gadea M.', playerB: 'Bianco D.', winner: 'Gadea M.', score: '6-1 / 6-3', date: '16/09/2026', time: '21:00', groupHint: 'B', roundHint: 3 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Figueroa M.', playerB: 'Santi Mat.', winner: 'Santi Mat.', score: '6-0 / 6-3', date: '17/09/2026', time: '21:00', groupHint: 'A', roundHint: 2 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Figueroa M.', playerB: 'Komesu F.', winner: 'Komesu F.', score: '6-1 / 1-6 / 10-8', date: '18/09/2026', time: '19:30', groupHint: 'A', roundHint: 5 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Santi Mar.', playerB: 'Bianco D.', winner: 'Santi Mar.', score: '7-6 / 6-2', date: '20/09/2026', time: '09:00', groupHint: 'B', roundHint: 5 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Santi Mat.', playerB: 'Vito C.', winner: 'Vito C.', score: '2-2 y retiro', date: '23/09/2026', time: '21:00', status: 'retired', groupHint: 'A', roundHint: 3 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Vito C.', playerB: 'Bernardini G.', winner: 'Bernardini G.', score: '6-1 / 6-2', date: '25/09/2026', time: '18:00', groupHint: 'A', roundHint: 5 },
  { tournamentId: 't-federer-l3', leagueNum: 3, playerA: 'Bernardini G.', playerB: 'Figueroa M.', winner: 'Bernardini G.', score: '7-5 / 7-5', date: '04/10/2026', time: '19:00', groupHint: 'A', roundHint: 3 },
  // Liga 4
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Cardozo M.', playerB: 'Rios J.', winner: 'Rios J.', score: '6-4 / 6-4', date: '29/08/2026', time: '11:30', groupHint: 'A', roundHint: 1 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Chantada M.', playerB: 'Murchio M.', winner: 'Chantada M.', score: '6-3 / 6-7 / 10-8', date: '30/08/2026', time: '11:30', groupHint: 'C', roundHint: 2 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Miletta J.', playerB: 'Gonzalez Días C.', winner: 'Gonzalez Días C.', score: '6-2 / 6-3', date: '30/08/2026', time: '17:00', groupHint: 'B', roundHint: 5 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Oviedo M.', playerB: 'Gonzalez Días F.', winner: 'Gonzalez Días F.', score: '4-6 / 6-3 / 10-7', date: '30/08/2026', time: '18:00', groupHint: 'A', roundHint: 2 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Vidigt F.', playerB: 'Miletta J.', winner: 'Vidigt F.', score: '7-5 / 6-3', date: '05/09/2026', time: '18:30', groupHint: 'B', roundHint: 1 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Garcia J.', playerB: 'Cardozo M.', winner: 'Garcia J.', score: '6-1 / 6-2', date: '06/09/2026', time: '15:00', groupHint: 'A', roundHint: 2 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Murchio M.', playerB: 'Maza S.', winner: 'Maza S.', score: '6-2 / 6-2', date: '07/09/2026', time: '20:00', groupHint: 'C', roundHint: 3 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Anetta D.', playerB: 'Vidigt F.', winner: 'Vidigt F.', score: '7-5 / 7-6', date: '08/09/2026', time: '20:00', groupHint: 'B', roundHint: 3 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Blanco J.', playerB: 'Maza S.', winner: 'Maza S.', score: '6-0 / 6-2', date: '09/09/2026', time: '10:00', groupHint: 'C', roundHint: 2 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Rios J.', playerB: 'Oviedo M.', winner: 'Rios J.', score: '6-7 / 6-4 / 10-3', date: '14/09/2026', time: '20:00', groupHint: 'A', roundHint: 5 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Anetta D.', playerB: 'Miletta J.', winner: 'Miletta J.', score: '6-3 / 7-5', date: '19/09/2026', time: '18:30', groupHint: 'B', roundHint: 4 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Chantada M.', playerB: 'Bauerkamper G.', winner: 'Bauerkamper G.', score: '6-3 / 6-1', date: '20/09/2026', time: '12:30', groupHint: 'C', roundHint: 1 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Gonzalez Días F.', playerB: 'Rios J.', winner: 'Gonzalez Días F.', score: '6-4 / 6-4', date: '26/09/2026', time: '18:30', groupHint: 'A', roundHint: 3 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Repecka J.', playerB: 'Anetta D.', winner: 'Repecka J.', score: '7-5 / 7-6', date: '29/09/2026', time: '20:00', groupHint: 'B', roundHint: 3 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Bauerkamper G.', playerB: 'Murchio M.', winner: 'Bauerkamper G.', score: '6-2 / 6-2', date: '04/10/2026', time: '12:00', groupHint: 'C', roundHint: 5 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Blanco J.', playerB: 'Chantada M.', winner: 'Chantada M.', score: '6-1 / 3-6 / 10-7', date: '04/10/2026', time: '16:00', groupHint: 'C', roundHint: 3 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Gonzalez Días C.', playerB: 'Repecka J.', winner: 'Gonzalez Días C.', score: '7-6 / 6-7 / 10-6', date: '04/10/2026', time: '17:00', groupHint: 'B', roundHint: 4 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Garcia J.', playerB: 'Gonzalez Días F.', winner: 'Gonzalez Días F.', score: '5-7 / 6-4 / 10-6', date: '04/10/2026', time: '18:00', groupHint: 'A', roundHint: 5 },
  { tournamentId: 't-federer-l4', leagueNum: 4, playerA: 'Cardozo M.', playerB: 'Oviedo M.', winner: 'Cardozo M.', score: '6-1 / 1-6 / 11-9', date: '04/10/2026', time: '19:00', groupHint: 'A', roundHint: 3 },
  // Liga 5 (Davino tras reemplazo)
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Avalos G.', playerB: 'Cellilli M.', winner: 'Cellilli M.', score: '6-3 / 6-4', date: '30/08/2026', time: '16:00', groupHint: 'C', roundHint: 1 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Vila E.', playerB: 'Merlo S.', winner: 'Merlo S.', score: '6-1 / 6-4', date: '06/09/2026', time: '11:30', groupHint: 'A', roundHint: 2 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Merlo S.', playerB: 'Chantada S.', winner: 'Merlo S.', score: '6-2 / 6-2', date: '13/09/2026', time: '11:30', groupHint: 'A', roundHint: 3 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Peralta G.', playerB: 'Cellilli M.', winner: 'Cellilli M.', score: '7-6 / 1-6 / 10-8', date: '13/09/2026', time: '16:00', groupHint: 'C', roundHint: 2 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Tellechea L.', playerB: 'Cirigliano D.', winner: 'Tellechea L.', score: '6-3 / 6-2', date: '14/09/2026', time: '12:45', groupHint: 'B', roundHint: 1 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Avalos G.', playerB: 'Cirigliano D.', winner: 'Avalos G.', score: '6-3 / 6-2', date: '18/09/2026', time: '20:50', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Tellechea L.', playerB: 'Peralta G.', winner: 'Peralta G.', score: '7-6 / 6-3', date: '19/09/2026', time: '11:30', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Peralta G.', playerB: 'Avalos G.', winner: 'Peralta G.', score: '6-4 / 6-3', date: '25/09/2026', time: '20:00', groupHint: 'C', roundHint: 3 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Gimenez F.', playerB: 'Merlo S.', winner: 'Gimenez F.', score: '7-6 / 1-6 / 10-5', date: '26/09/2026', time: '18:30', groupHint: 'A', roundHint: 1 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Cirigliano D.', playerB: 'Oswald J.', winner: 'Cirigliano D.', score: '4-6 / 6-3 / 10-3', date: '02/10/2026', time: '21:00', groupHint: 'B', roundHint: 2 },
  { tournamentId: 't-federer-l5', leagueNum: 5, playerA: 'Cellilli M.', playerB: 'Davino C.', winner: 'Davino C.', score: '6-4 / 5-7 / 11-9', date: '03/10/2026', time: '18:30', groupHint: 'C', roundHint: 3 },
  // Liga 6
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Jaureguiberry C.', playerB: 'Lasca M.', winner: 'Jaureguiberry C.', score: '6-1 / 6-2', date: '30/08/2026', time: '17:00', groupHint: 'A', roundHint: 1 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'De Ruyck G.', playerB: 'Saenz D.', winner: 'Saenz D.', score: '4-6 / 6-3 / 10-7', date: '30/08/2026', time: '19:00', groupHint: 'B', roundHint: 1 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Marceca M.', playerB: 'Fedrjanic N.', winner: 'Fedrjanic N.', score: '6-3 / 6-4', date: '30/08/2026', time: '11:30', groupHint: 'C', roundHint: 2 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Bustos C.', playerB: 'Jaureguiberry C.', winner: 'Bustos C.', score: '6-4 / 6-4', date: '01/09/2026', time: '20:00', groupHint: 'A', roundHint: 2 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Fratini M.', playerB: 'Cellilli F.', winner: 'Cellilli F.', score: '6-0 / 6-2', date: '06/09/2026', time: '14:00', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Lasca M.', playerB: 'Bustos C.', winner: 'Bustos C.', score: '6-0 / 6-2', date: '06/09/2026', time: '16:00', groupHint: 'A', roundHint: 2 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Fratini M.', playerB: 'Marceca M.', winner: 'Marceca M.', score: '6-3 / 6-2', date: '11/09/2026', time: '11:30', groupHint: 'C', roundHint: 3 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Bonacalza M.', playerB: 'Marceca F.', winner: 'Marceca F.', score: '6-3 / 7-5', date: '11/09/2026', time: '15:30', groupHint: 'B', roundHint: 1 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Jaureguiberry C.', playerB: 'Bonacalza M.', winner: 'Bonacalza M.', score: '6-0 / 6-2', date: '22/09/2026', time: '12:30', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Saenz D.', playerB: 'Marceca F.', winner: 'Saenz D.', score: '6-7 / 6-0 / 10-5', date: '22/09/2026', time: '20:00', groupHint: 'B', roundHint: 2 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Fedrjanic N.', playerB: 'Saenz D.', winner: 'Saenz D.', score: '6-4 / 6-0', date: '29/09/2026', time: '18:00', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Bustos C.', playerB: 'Marceca M.', winner: 'Bustos C.', score: '6-4 / 6-3', date: '03/10/2026', time: '19:00', groupHint: 'Interzonal', roundHint: 4 },
  { tournamentId: 't-federer-l6', leagueNum: 6, playerA: 'Lasca M.', playerB: 'Cellilli F.', winner: 'Cellilli F.', score: '6-2 / 6-2', date: '04/10/2026', time: '15:00', groupHint: 'A', roundHint: 3 },
];

export type ApplyReport = {
  loaded: string[];
  skipped: string[];
  conflicts: string[];
};

export async function applyRogerFederer2026WhatsAppResults(filter?: {
  tournamentIds?: string[];
  excludeTournamentIds?: string[];
}): Promise<ApplyReport> {
  const report: ApplyReport = { loaded: [], skipped: [], conflicts: [] };
  let rows = RESULTS;
  if (filter?.tournamentIds?.length) {
    rows = rows.filter((r) => filter.tournamentIds!.includes(r.tournamentId));
  }
  if (filter?.excludeTournamentIds?.length) {
    rows = rows.filter((r) => !filter.excludeTournamentIds!.includes(r.tournamentId));
  }
  for (const row of rows) {
    try {
      await applyOne(row, report);
    } catch (e) {
      report.conflicts.push(
        `${row.playerA} vs ${row.playerB}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return report;
}

/** Chequeo local sin BD: Miletta vs González (prod-like) + casos borde. */
export function runEquivalenceDryCheck(): { ok: boolean; cases: unknown[] } {
  const p1 = 'p-miletta';
  const p2 = 'p-gonzalez';
  const winnerP2 = p2;
  const cases = [
    {
      name: 'Miletta vs Gonzalez (WhatsApp vs prod fixture score)',
      stored: '2-6 3-6',
      incoming: '6-2 / 6-3',
      equivalent: scoresEquivalentForFixture('2-6 3-6', '6-2 / 6-3', winnerP2, p1, p2),
      skip: shouldSkipCompletedMatch(
        { completed: true, score: '2-6 3-6', winnerId: p2, player1Id: p1, player2Id: p2 },
        '6-2 / 6-3',
        winnerP2,
      ),
    },
    {
      name: 'mismo texto',
      skip: shouldSkipCompletedMatch(
        { completed: true, score: '6-4 6-2', winnerId: p1, player1Id: p1, player2Id: p2 },
        '6-4 / 6-2',
        p1,
      ),
    },
    {
      name: 'conflicto real distinto ganador',
      skip: shouldSkipCompletedMatch(
        { completed: true, score: '2-6 3-6', winnerId: p2, player1Id: p1, player2Id: p2 },
        '6-2 / 6-3',
        p1,
      ),
    },
  ];
  const ok =
    cases[0]!.equivalent === true &&
    cases[0]!.skip.skip === true &&
    cases[0]!.skip.conflict === false &&
    cases[1]!.skip.skip === true &&
    cases[2]!.skip.conflict === true;
  return { ok, cases };
}

async function main() {
  if (process.argv.includes('--dry-check-equivalence')) {
    const result = runEquivalenceDryCheck();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  const only = process.argv.find((a) => a.startsWith('--tournament='))?.split('=')[1];
  const filter = only ? { tournamentIds: only.split(',') } : undefined;
  const report = await applyRogerFederer2026WhatsAppResults(filter);
  await recalculateRankings(prisma);
  console.log(JSON.stringify({ report, rankingRecalculated: true }, null, 2));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
