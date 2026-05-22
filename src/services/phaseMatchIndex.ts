/**
 * Índice de partidos por fase (grupos + KO) por clave `tournamentId|leagueNum`.
 * Compartido entre `recalculateRankings` y `buildPublicPlayerProfile`.
 */

import type { Group, Match, MatchResult, Player, PrismaClient, TournamentLeague } from '@prisma/client';
import { parseKoPlayedScoreDetail } from './koScoreParse.js';
import type { TournamentPhaseMatch } from './rankingPhase.js';

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

export function resolveLeagueForResult(
  r: MatchResult,
  matchById: Map<string, MatchWithLeagueGroup>,
  leaguesByTournament: Map<string, number[]>,
): number | null {
  if (r.matchId) {
    const m = matchById.get(r.matchId);
    if (m?.tournamentLeague) return m.tournamentLeague.leagueNum;
  }
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

export function prismaMatchToPhase(m: MatchWithLeagueGroup, linkedResult?: MatchResult | null): TournamentPhaseMatch | null {
  if (m.stage === 'group') {
    const g = m.group?.displayName?.trim() || m.group?.key?.trim() || '';
    return {
      playerA: m.player1Id,
      playerB: m.player2Id,
      winnerId: m.winnerId,
      group: g || null,
      completed: m.completed,
      groupResultStatus: groupStatusFromMatchResult(linkedResult),
    };
  }
  if (m.stage === 'interzonal') {
    return {
      playerA: m.player1Id,
      playerB: m.player2Id,
      winnerId: m.winnerId,
      group: 'interzonal',
      completed: m.completed,
    };
  }
  if (m.stage === 'quarterfinal' || m.stage === 'semifinal' || m.stage === 'final' || m.stage === 'repechage') {
    const round =
      m.stage === 'quarterfinal'
        ? 'Cuartos de final'
        : m.stage === 'semifinal'
          ? 'Semifinales'
          : m.stage === 'final'
            ? 'Final'
            : 'Repechaje';
    return {
      playerA: m.player1Id,
      playerB: m.player2Id,
      winnerId: m.winnerId,
      round,
      completed: m.completed,
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
    const s = (r.score ?? '').trim().toUpperCase();
    winnerId = s === 'B' ? idB : idA;
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
};

export async function loadPhaseMatchContext(prisma: PrismaClient): Promise<PhaseMatchContext> {
  const [players, tournaments, tournamentLeagues, matches, matchResults] = await Promise.all([
    prisma.player.findMany({ where: { rosterActive: true } }),
    prisma.tournament.findMany(),
    prisma.tournamentLeague.findMany(),
    prisma.match.findMany({
      include: { tournamentLeague: true, group: true },
    }),
    prisma.matchResult.findMany(),
  ]);

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
    const mid = r.matchId?.trim();
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
    const ln = resolveLeagueForResult(r, matchById, leaguesByTournament);
    if (ln == null) continue;
    if (r.matchId && prismaMatchIds.has(r.matchId)) continue;
    const pm = matchResultToPhaseMatch(r, nameToId);
    if (!pm) continue;
    const k = phaseKey(r.tournamentId, ln);
    const list = phaseMap.get(k) ?? [];
    list.push(pm);
    phaseMap.set(k, list);
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
  };
}
