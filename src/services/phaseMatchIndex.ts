/**
 * Índice de partidos por fase (grupos + KO) por clave `tournamentId|leagueNum`.
 * Compartido entre `recalculateRankings` y `buildPublicPlayerProfile`.
 */

import type { Group, Match, MatchResult, Player, PrismaClient, TournamentLeague } from '@prisma/client';
import { parseKoPlayedScoreDetail } from './koScoreParse.js';
import { walkoverWinnerIsPlayerB } from './walkoverWinnerSide.js';
import type { TournamentPhaseMatch } from './rankingPhase.js';
import { koRoundKind, octavosRound, repechageRound } from './rankingPhase.js';

export type MatchWithLeagueGroup = Match & {
  tournamentLeague: TournamentLeague | null;
  group: Group | null;
};

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '');
}

export function normName(s: string): string {
  return stripDiacritics(
    s
      .replace(/\s*\(P\)\s*$/i, '')
      .replace(/^\s*\(P\)\s*/i, '')
      .trim()
      .toLowerCase(),
  );
}

export function buildNameToId(players: Player[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of players) {
    m.set(normName(p.name), p.id);
    m.set(normName(p.displayName ?? ''), p.id);
    m.set(p.id.toLowerCase(), p.id);
  }
  return m;
}

export function buildScheduleLeagueByDedupeKey(
  entries: { dedupeKey: string; leagueNum: number }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of entries) {
    const key = row.dedupeKey.trim();
    if (!key) continue;
    map.set(key, row.leagueNum);
  }
  return map;
}

export function resolveLeagueForResult(
  r: MatchResult,
  matchById: Map<string, MatchWithLeagueGroup>,
  leaguesByTournament: Map<string, number[]>,
  scheduleLeagueByDedupeKey?: Map<string, number>,
): number | null {
  const m = linkedMatchForResult(r, matchById);
  if (m?.tournamentLeague) return m.tournamentLeague.leagueNum;
  const fromSchedule = scheduleLeagueByDedupeKey?.get(r.dedupeKey.trim());
  if (fromSchedule != null && fromSchedule >= 1 && fromSchedule <= 6) return fromSchedule;
  const arr = leaguesByTournament.get(r.tournamentId) ?? [];
  if (arr.length === 1) return arr[0]!;
  return null;
}

export function leagueNumForPrismaMatch(m: MatchWithLeagueGroup, leaguesByTournament: Map<string, number[]>): number | null {
  if (m.tournamentLeagueId && m.tournamentLeague) return m.tournamentLeague.leagueNum;
  const arr = leaguesByTournament.get(m.tournamentId) ?? [];
  if (arr.length === 1) return arr[0]!;
  return null;
}

function groupStatusFromMatchResult(linked: MatchResult | null | undefined): TournamentPhaseMatch['groupResultStatus'] | undefined {
  if (!linked || linked.status === 'pending' || linked.status === 'suspended') return undefined;
  if (linked.status === 'walkover') return 'walkover';
  if (linked.status === 'retired') return 'retired';
  return 'played';
}

/** Algunos KO históricos quedaron con `groupKey` pero sin `matchId`; la clave conserva el id del Match. */
export function linkedMatchIdForResult(r: Pick<MatchResult, 'matchId' | 'groupKey'>): string | null {
  const direct = r.matchId?.trim();
  if (direct) return direct;
  const groupKey = r.groupKey?.trim() ?? '';
  return /^KO-/i.test(groupKey) ? groupKey.replace(/^KO-/i, '') : null;
}

// Indice de respaldo para linkedMatchForResult: mapea tournamentId|groupKey(match,
// normalizado)|fecha -> primer partido que matchea, replicando exactamente el mismo
// criterio que antes hacia con [...matchById.values()].find(...). Cacheado por
// instancia de matchById (una instancia nueva por cada loadPhaseMatchContext) para
// que un mismo recalculo de rankings no vuelva a escanear todos los partidos por
// cada resultado legacy sin matchId -- antes era O(resultados x partidos) y corria
// en el hilo unico de Node cada vez que un admin cargaba un resultado.
const fallbackIndexCache = new WeakMap<Map<string, MatchWithLeagueGroup>, Map<string, MatchWithLeagueGroup>>();

function fallbackIndexFor(matchById: Map<string, MatchWithLeagueGroup>): Map<string, MatchWithLeagueGroup> {
  const cached = fallbackIndexCache.get(matchById);
  if (cached) return cached;

  const index = new Map<string, MatchWithLeagueGroup>();
  for (const m of matchById.values()) {
    if (m.stage !== 'group') continue;
    const key = (m.group?.key ?? m.group?.displayName ?? '').trim().toLowerCase().replace(/^grupo\s+/i, '');
    const round = /fecha\s*(\d+)/i.exec(m.roundLabel ?? '')?.[1];
    if (!key || round == null) continue;
    const idxKey = `${m.tournamentId}|${key}|${Number(round)}`;
    // Primer partido que matchea gana, igual que Array.find sobre el mismo orden
    // de iteracion (matchById.values() esta en el mismo orden en ambos casos).
    if (!index.has(idxKey)) index.set(idxKey, m);
  }
  fallbackIndexCache.set(matchById, index);
  return index;
}

/**
 * Para grupos legacy sin `matchId`, grupo + fecha identifica el cruce real.
 * Así el resultado usa IDs de jugador, incluso si existe un homónimo en otra liga.
 */
export function linkedMatchForResult(
  r: Pick<MatchResult, 'matchId' | 'groupKey' | 'roundNum' | 'tournamentId'>,
  matchById: Map<string, MatchWithLeagueGroup>,
): MatchWithLeagueGroup | undefined {
  const directId = linkedMatchIdForResult(r);
  if (directId) return matchById.get(directId);

  const groupKey = r.groupKey?.trim().toLowerCase();
  if (!groupKey || r.roundNum == null) return undefined;
  return fallbackIndexFor(matchById).get(`${r.tournamentId}|${groupKey}|${r.roundNum}`);
}

function winnerIdFromLinkedResult(
  m: Pick<Match, 'player1Id' | 'player2Id' | 'winnerId'>,
  linked: MatchResult | null | undefined,
): string | null {
  if (!linked || linked.status === 'pending' || linked.status === 'suspended') return m.winnerId;
  if (linked.status === 'walkover') {
    return walkoverWinnerIsPlayerB(linked.score) ? m.player2Id : m.player1Id;
  }
  if (linked.status === 'played' || linked.status === 'retired') {
    const parsed = parseKoPlayedScoreDetail(linked.score ?? '', linked.status === 'retired');
    if (parsed.ok) return parsed.winner === 'A' ? m.player1Id : m.player2Id;
  }
  return m.winnerId;
}

export function prismaMatchToPhase(m: MatchWithLeagueGroup, linkedResult?: MatchResult | null): TournamentPhaseMatch | null {
  const winnerId = winnerIdFromLinkedResult(m, linkedResult);
  if (m.stage === 'group') {
    const g = m.group?.displayName?.trim() || m.group?.key?.trim() || '';
    return {
      playerA: m.player1Id,
      playerB: m.player2Id,
      winnerId,
      group: g || null,
      completed: m.completed,
      groupResultStatus: groupStatusFromMatchResult(linkedResult),
    };
  }
  if (m.stage === 'interzonal') {
    return {
      playerA: m.player1Id,
      playerB: m.player2Id,
      winnerId,
      group: 'interzonal',
      completed: m.completed,
    };
  }
  if (m.stage === 'quarterfinal' || m.stage === 'semifinal' || m.stage === 'final' || m.stage === 'repechage') {
    const round =
      m.roundLabel?.trim() ||
      (m.stage === 'quarterfinal'
        ? 'Cuartos de final'
        : m.stage === 'semifinal'
          ? 'Semifinales'
          : m.stage === 'final'
            ? 'Final'
            : 'Repechaje');
    return {
      playerA: m.player1Id,
      playerB: m.player2Id,
      winnerId,
      round,
      completed: m.completed,
      groupResultStatus: groupStatusFromMatchResult(linkedResult),
    };
  }
  const label = m.roundLabel?.trim() ?? '';
  if (label && (repechageRound(label) || octavosRound(label) || koRoundKind(label))) {
    return {
      playerA: m.player1Id,
      playerB: m.player2Id,
      winnerId,
      round: label,
      completed: m.completed,
      groupResultStatus: groupStatusFromMatchResult(linkedResult),
    };
  }
  return null;
}

export function matchResultToPhaseMatch(r: MatchResult, nameToId: Map<string, string>): TournamentPhaseMatch | null {
  const status = r.status;
  if (status === 'pending' || status === 'suspended') return null;
  const idA = nameToId.get(normName(r.playerA));
  const idB = nameToId.get(normName(r.playerB));
  if (!idA || !idB) return null;
  const g = (r.groupKey ?? '').trim();
  if (!g || /^interzonal$/i.test(g)) return null;
  if (/^KO-/i.test(g)) return null;

  let winnerId: string | null = null;
  if (status === 'walkover') {
    winnerId = walkoverWinnerIsPlayerB(r.score) ? idB : idA;
  } else if (status === 'played' || status === 'retired') {
    const det = parseKoPlayedScoreDetail(r.score ?? '', status === 'retired');
    if (!det.ok) return null;
    winnerId = det.winner === 'A' ? idA : idB;
  }
  const completed = status === 'played' || status === 'walkover' || status === 'retired';
  const groupResultStatus: TournamentPhaseMatch['groupResultStatus'] =
    status === 'walkover' ? 'walkover' : status === 'retired' ? 'retired' : 'played';
  return {
    playerA: idA,
    playerB: idB,
    winnerId,
    group: g,
    completed,
    groupResultStatus,
  };
}

export const phaseKey = (tid: string, leagueNum: number) => `${tid}|${leagueNum}`;

export type PhaseMatchContext = {
  players: Player[];
  tournaments: import('@prisma/client').Tournament[];
  tournamentLeagues: TournamentLeague[];
  matches: MatchWithLeagueGroup[];
  matchResults: MatchResult[];
  matchById: Map<string, MatchWithLeagueGroup>;
  leaguesByTournament: Map<string, number[]>;
  tlByTournamentLeague: Map<string, TournamentLeague>;
  nameToId: Map<string, string>;
  prismaMatchIds: Set<string>;
  phaseMap: Map<string, TournamentPhaseMatch[]>;
  scheduleLeagueByDedupeKey: Map<string, number>;
  /** Plantel de grupos por torneo (jugador inscripto → cuenta como torneo jugado). */
  groupRosterByTournament: Map<string, Set<string>>;
};

export async function loadPhaseMatchContext(prisma: PrismaClient): Promise<PhaseMatchContext> {
  const [players, tournaments, tournamentLeagues, matches, matchResults, scheduleEntries, groupPlayers] =
    await Promise.all([
    prisma.player.findMany({ where: { rosterActive: true } }),
    prisma.tournament.findMany(),
    prisma.tournamentLeague.findMany(),
    prisma.match.findMany({
      include: { tournamentLeague: true, group: true },
    }),
    prisma.matchResult.findMany(),
    prisma.tournamentScheduleEntry.findMany({ select: { dedupeKey: true, leagueNum: true } }),
    prisma.groupPlayer.findMany({
      include: { group: { select: { tournamentId: true } } },
    }),
  ]);

  const scheduleLeagueByDedupeKey = buildScheduleLeagueByDedupeKey(scheduleEntries);

  const nameToId = buildNameToId(players);
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const leaguesByTournament = new Map<string, number[]>();
  const tlByTournamentLeague = new Map<string, TournamentLeague>();
  for (const tl of tournamentLeagues) {
    const arr = leaguesByTournament.get(tl.tournamentId) ?? [];
    arr.push(tl.leagueNum);
    leaguesByTournament.set(tl.tournamentId, arr);
    tlByTournamentLeague.set(`${tl.tournamentId}|${tl.leagueNum}`, tl);
  }
  for (const [tid, arr] of leaguesByTournament) {
    arr.sort((a, b) => a - b);
    leaguesByTournament.set(tid, [...new Set(arr)]);
  }

  const prismaMatchIds = new Set(matches.map((m) => m.id));
  const phaseMap = new Map<string, TournamentPhaseMatch[]>();

  const resultByMatchId = new Map<string, MatchResult>();
  for (const r of matchResults) {
    const mid = linkedMatchForResult(r, matchById)?.id;
    if (!mid) continue;
    const prev = resultByMatchId.get(mid);
    if (!prev || r.updatedAt > prev.updatedAt) resultByMatchId.set(mid, r);
  }

  for (const m of matches) {
    const ln = leagueNumForPrismaMatch(m, leaguesByTournament);
    if (ln == null) continue;
    const pm = prismaMatchToPhase(m, resultByMatchId.get(m.id));
    if (!pm) continue;
    const k = phaseKey(m.tournamentId, ln);
    const list = phaseMap.get(k) ?? [];
    list.push(pm);
    phaseMap.set(k, list);
  }

  for (const r of matchResults) {
    const ln = resolveLeagueForResult(r, matchById, leaguesByTournament, scheduleLeagueByDedupeKey);
    if (ln == null) continue;
    const linkedMatchId = linkedMatchForResult(r, matchById)?.id;
    if (linkedMatchId && prismaMatchIds.has(linkedMatchId)) continue;
    const pm = matchResultToPhaseMatch(r, nameToId);
    if (!pm) continue;
    const k = phaseKey(r.tournamentId, ln);
    const list = phaseMap.get(k) ?? [];
    list.push(pm);
    phaseMap.set(k, list);
  }

  const groupRosterByTournament = new Map<string, Set<string>>();
  for (const gp of groupPlayers) {
    const tid = gp.group.tournamentId;
    const set = groupRosterByTournament.get(tid) ?? new Set<string>();
    set.add(gp.playerId);
    groupRosterByTournament.set(tid, set);
  }

  return {
    players,
    tournaments,
    tournamentLeagues,
    matches,
    matchResults,
    matchById,
    leaguesByTournament,
    tlByTournamentLeague,
    nameToId,
    prismaMatchIds,
    phaseMap,
    scheduleLeagueByDedupeKey,
    groupRosterByTournament,
  };
}
