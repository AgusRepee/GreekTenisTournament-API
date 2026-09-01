import type { Match, MatchResult, PrismaClient, TournamentLeague } from '@prisma/client';
import { normName, buildNameToId, buildScheduleLeagueByDedupeKey } from './phaseMatchIndex.js';
import { parseKoPlayedScoreDetail } from './koScoreParse.js';
import { walkoverWinnerIsPlayerB } from './walkoverWinnerSide.js';
import {
  buildProfileMatchPhaseLabel,
  parseScheduleDateIso,
} from './profileMatchPhaseLabel.js';

export const PROFILE_RECENT_MATCHES_PREVIEW_LIMIT = 5;
export const PROFILE_RECENT_MATCHES_MAX_LIMIT = 200;

export type ProfileRecentMatchDto = {
  id: string;
  score: string;
  status: string;
  stage: string;
  scheduledDate: string | null;
  dateIso: string | undefined;
  phaseLabel: string;
  player1: { id: string; name: string };
  player2: { id: string; name: string };
  winner: { id: string; name: string } | null;
  tournament: { id: string; name: string; slug: string | null } | null;
};

type MatchWithRelations = Match & {
  tournamentLeague: TournamentLeague | null;
  group: { key: string } | null;
};

type ResultWithRelations = MatchResult & {
  tournament: { id: string; name: string; slug: string | null } | null;
  match: MatchWithRelations | null;
};

function leagueForProfileResult(
  r: ResultWithRelations,
  matchById: Map<string, MatchWithRelations>,
  leaguesByTournament: Map<string, number[]>,
  scheduleLeagueByDedupeKey: Map<string, number>,
): number | null {
  if (r.match?.tournamentLeague) return r.match.tournamentLeague.leagueNum;
  const mid = r.matchId?.trim();
  if (mid) {
    const linked = matchById.get(mid);
    if (linked?.tournamentLeague) return linked.tournamentLeague.leagueNum;
  }
  const fromSchedule = scheduleLeagueByDedupeKey.get(r.dedupeKey.trim());
  if (fromSchedule != null && fromSchedule >= 1 && fromSchedule <= 6) return fromSchedule;
  const arr = leaguesByTournament.get(r.tournamentId) ?? [];
  if (arr.length === 1) return arr[0]!;
  return null;
}

function leagueForProfileMatch(
  m: MatchWithRelations,
  leaguesByTournament: Map<string, number[]>,
): number | null {
  if (m.tournamentLeague) return m.tournamentLeague.leagueNum;
  const arr = leaguesByTournament.get(m.tournamentId) ?? [];
  if (arr.length === 1) return arr[0]!;
  return null;
}

function resultDateIso(
  r: MatchResult,
  match: MatchWithRelations | null | undefined,
  scheduleDateByDedupeKey: Map<string, string>,
): string | undefined {
  if (r.playedAt) return r.playedAt.toISOString().slice(0, 10);
  if (match?.scheduledDate) return match.scheduledDate.toISOString().slice(0, 10);
  return scheduleDateByDedupeKey.get(r.dedupeKey.trim());
}

function resultSortMs(
  r: MatchResult,
  match: MatchWithRelations | null | undefined,
  scheduleDateByDedupeKey: Map<string, string>,
): number {
  if (r.playedAt) return r.playedAt.getTime();
  if (match?.scheduledDate) return match.scheduledDate.getTime();
  const sched = scheduleDateByDedupeKey.get(r.dedupeKey.trim());
  if (sched) {
    const t = Date.parse(sched);
    if (Number.isFinite(t)) return t;
  }
  return r.updatedAt.getTime();
}

function matchSortMsFromParts(playedAt: Date | null | undefined, updatedAt: Date, scheduledDate?: Date | null): number {
  if (playedAt) return playedAt.getTime();
  if (scheduledDate) return scheduledDate.getTime();
  return updatedAt.getTime();
}

function playerInResult(
  r: MatchResult,
  playerId: string,
  playerNames: string[],
  nameToId: Map<string, string>,
): boolean {
  const idA = nameToId.get(normName(r.playerA));
  const idB = nameToId.get(normName(r.playerB));
  if (idA === playerId || idB === playerId) return true;
  const selfNames = new Set(playerNames.map((n) => normName(n)).filter(Boolean));
  return selfNames.has(normName(r.playerA)) || selfNames.has(normName(r.playerB));
}

function sideForPlayer(
  r: MatchResult,
  playerId: string,
  playerNames: string[],
  nameToId: Map<string, string>,
): 'A' | 'B' | null {
  const selfNames = new Set(playerNames.map((n) => normName(n)).filter(Boolean));
  const idA = nameToId.get(normName(r.playerA));
  if (idA === playerId || selfNames.has(normName(r.playerA))) return 'A';
  const idB = nameToId.get(normName(r.playerB));
  if (idB === playerId || selfNames.has(normName(r.playerB))) return 'B';
  return null;
}

function winnerSideFromResult(r: MatchResult): 'A' | 'B' | null {
  if (r.status === 'walkover') {
    return walkoverWinnerIsPlayerB(r.score) ? 'B' : 'A';
  }
  if (r.status === 'played' || r.status === 'retired') {
    const det = parseKoPlayedScoreDetail(r.score ?? '', r.status === 'retired');
    if (det.ok) return det.winner;
  }
  return null;
}

function canonicalProfileMatchKey(matchId: string | null | undefined, dedupeKey?: string): string {
  const mid = matchId?.trim();
  if (mid) return `mid:${mid}`;
  const dk = dedupeKey?.trim();
  if (dk) return `dk:${dk}`;
  return '';
}

function mapResultToRecent(
  r: ResultWithRelations,
  nameToId: Map<string, string>,
  leagueNum: number | null,
  scheduleDateByDedupeKey: Map<string, string>,
): ProfileRecentMatchDto {
  const idA = nameToId.get(normName(r.playerA)) ?? r.playerA;
  const idB = nameToId.get(normName(r.playerB)) ?? r.playerB;
  const winSide = winnerSideFromResult(r);
  const winner =
    winSide === 'A'
      ? { id: idA, name: r.playerA }
      : winSide === 'B'
        ? { id: idB, name: r.playerB }
        : null;
  const linked = r.match;
  const dateIso = resultDateIso(r, linked, scheduleDateByDedupeKey);
  const tName = r.tournament?.name ?? 'Torneo';
  const matchId = r.matchId?.trim() || ( /^KO-/i.test(r.groupKey ?? '') ? (r.groupKey ?? '').slice(3) : null );
  return {
    id: r.dedupeKey,
    score: r.score ?? '',
    status: r.status,
    stage: linked?.stage ?? 'group',
    scheduledDate: dateIso ? `${dateIso}T12:00:00.000Z` : null,
    dateIso,
    phaseLabel: buildProfileMatchPhaseLabel({
      tournamentName: tName,
      leagueNum,
      groupKey: r.groupKey,
      matchId,
      matchStage: linked?.stage ?? null,
      roundLabel: linked?.roundLabel ?? null,
    }),
    player1: { id: idA, name: r.playerA },
    player2: { id: idB, name: r.playerB },
    winner,
    tournament: r.tournament ? { id: r.tournament.id, name: r.tournament.name, slug: r.tournament.slug } : null,
  };
}

function mapPrismaMatchToRecent(
  m: Match & {
    player1: { id: string; name: string };
    player2: { id: string; name: string };
    winner: { id: string; name: string } | null;
    tournament: { id: string; name: string; slug: string | null } | null;
    group: { key: string } | null;
    tournamentLeague: TournamentLeague | null;
  },
  leagueNum: number | null,
): ProfileRecentMatchDto {
  const idA = m.player1Id ?? m.player1.id;
  const idB = m.player2Id ?? m.player2.id;
  const winSide: 'A' | 'B' | null = m.winnerId === idA ? 'A' : m.winnerId === idB ? 'B' : null;
  const winner =
    winSide === 'A'
      ? { id: idA, name: m.player1.name }
      : winSide === 'B'
        ? { id: idB, name: m.player2.name }
        : null;
  const dateIso = m.scheduledDate ? m.scheduledDate.toISOString().slice(0, 10) : undefined;
  const tName = m.tournament?.name ?? 'Torneo';
  return {
    id: `match:${m.id}`,
    score: m.score ?? '',
    status: 'played',
    stage: m.stage ?? 'group',
    scheduledDate: m.scheduledDate ? m.scheduledDate.toISOString() : null,
    dateIso,
    phaseLabel: buildProfileMatchPhaseLabel({
      tournamentName: tName,
      leagueNum,
      groupKey: m.group?.key ?? null,
      matchId: m.id,
      matchStage: m.stage ?? null,
      roundLabel: m.roundLabel ?? null,
    }),
    player1: { id: idA, name: m.player1.name },
    player2: { id: idB, name: m.player2.name },
    winner,
    tournament: m.tournament ? { id: m.tournament.id, name: m.tournament.name, slug: m.tournament.slug } : null,
  };
}

export async function loadRecentMatchesForPlayerProfile(
  prisma: PrismaClient,
  playerId: string,
  playerNames: string[],
  players: { id: string; name: string; displayName: string | null }[],
  limit = PROFILE_RECENT_MATCHES_MAX_LIMIT,
): Promise<ProfileRecentMatchDto[]> {
  const nameToId = buildNameToId(players as Parameters<typeof buildNameToId>[0]);
  const [rawRows, prismaMatches, scheduleEntries, tournamentLeagues] = await Promise.all([
    prisma.matchResult.findMany({
      where: { status: { in: ['played', 'walkover', 'retired'] } },
      include: {
        tournament: { select: { id: true, name: true, slug: true } },
        match: {
          include: {
            tournamentLeague: true,
            group: { select: { key: true } },
          },
        },
      },
      orderBy: [{ playedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 400,
    }),
    prisma.match.findMany({
      where: {
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
        completed: true,
        winnerId: { not: null },
      },
      include: {
        tournament: { select: { id: true, name: true, slug: true } },
        player1: { select: { id: true, name: true } },
        player2: { select: { id: true, name: true } },
        winner: { select: { id: true, name: true } },
        group: { select: { key: true } },
        tournamentLeague: true,
      },
      orderBy: [{ scheduledDate: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    }),
    prisma.tournamentScheduleEntry.findMany({
      select: { dedupeKey: true, date: true, leagueNum: true },
    }),
    prisma.tournamentLeague.findMany({ select: { tournamentId: true, leagueNum: true } }),
  ]);

  const rows = rawRows as ResultWithRelations[];

  const leaguesByTournament = new Map<string, number[]>();
  for (const tl of tournamentLeagues) {
    const arr = leaguesByTournament.get(tl.tournamentId) ?? [];
    arr.push(tl.leagueNum);
    leaguesByTournament.set(tl.tournamentId, arr);
  }

  const scheduleLeagueByDedupeKey = buildScheduleLeagueByDedupeKey(scheduleEntries);
  const scheduleDateByDedupeKey = new Map<string, string>();
  for (const row of scheduleEntries) {
    const iso = parseScheduleDateIso(row.date);
    if (iso) scheduleDateByDedupeKey.set(row.dedupeKey.trim(), iso);
  }

  const matchById = new Map<string, MatchWithRelations>();
  for (const m of prismaMatches) {
    matchById.set(m.id, m);
  }
  for (const r of rows) {
    if (r.match) matchById.set(r.match.id, r.match);
  }

  const merged: Array<{ sortMs: number; dto: ProfileRecentMatchDto; dedupe: string }> = [];

  for (const r of rows.filter((row) => playerInResult(row, playerId, playerNames, nameToId))) {
    const leagueNum = leagueForProfileResult(r, matchById, leaguesByTournament, scheduleLeagueByDedupeKey);
    const dto = mapResultToRecent(r, nameToId, leagueNum, scheduleDateByDedupeKey);
    merged.push({
      sortMs: resultSortMs(r, r.match, scheduleDateByDedupeKey),
      dto,
      dedupe: canonicalProfileMatchKey(r.matchId, r.dedupeKey),
    });
  }

  for (const m of prismaMatches) {
    if (m.player1Id !== playerId && m.player2Id !== playerId) continue;
    const dedupe = canonicalProfileMatchKey(m.id);
    const leagueNum = leagueForProfileMatch(m as MatchWithRelations, leaguesByTournament);
    merged.push({
      sortMs: matchSortMsFromParts(null, m.updatedAt, m.scheduledDate),
      dto: mapPrismaMatchToRecent(m, leagueNum),
      dedupe,
    });
  }

  merged.sort((a, b) => {
    const byDate = b.sortMs - a.sortMs;
    if (byDate !== 0) return byDate;
    return b.dto.id.localeCompare(a.dto.id, 'es');
  });

  const bestByKey = new Map<string, { sortMs: number; dto: ProfileRecentMatchDto }>();
  for (const item of merged) {
    const key = item.dedupe || item.dto.id;
    if (!key) continue;
    const prev = bestByKey.get(key);
    if (!prev) {
      bestByKey.set(key, item);
      continue;
    }
    const prevHasDate = Boolean(prev.dto.dateIso);
    const nextHasDate = Boolean(item.dto.dateIso);
    if (nextHasDate && !prevHasDate) {
      bestByKey.set(key, item);
      continue;
    }
    if (!nextHasDate && prevHasDate) continue;
    if (item.sortMs > prev.sortMs) bestByKey.set(key, item);
  }

  const deduped = [...bestByKey.values()].sort((a, b) => {
    const byDate = b.sortMs - a.sortMs;
    if (byDate !== 0) return byDate;
    return b.dto.id.localeCompare(a.dto.id, 'es');
  });

  const out: ProfileRecentMatchDto[] = [];
  for (const { dto } of deduped) {
    out.push(dto);
    if (out.length >= limit) break;
  }
  return out;
}

export type MatchAgg = {
  totalMatchesPlayed: number;
  totalWins: number;
  totalLosses: number;
  setsWon: number;
  setsLost: number;
  setDifference: number;
  winRate: number;
};

export function aggregateMatchResultsForPlayer(
  results: MatchResult[],
  playerId: string,
  playerNames: string[],
  nameToId: Map<string, string>,
  yearFilter?: number,
): MatchAgg {
  let pj = 0;
  let pg = 0;
  let pp = 0;
  let sw = 0;
  let sl = 0;
  const seen = new Set<string>();
  for (const r of results) {
    if (!playerInResult(r, playerId, playerNames, nameToId)) continue;
    if (yearFilter != null) {
      const y = r.playedAt ? r.playedAt.getFullYear() : r.updatedAt.getFullYear();
      if (y !== yearFilter) continue;
    }
    const dedupe = r.matchId?.trim() || r.dedupeKey;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const side = sideForPlayer(r, playerId, playerNames, nameToId);
    if (!side) continue;
    pj += 1;
    const winSide = winnerSideFromResult(r);
    const won = winSide === side;
    if (won) pg += 1;
    else if (winSide) pp += 1;
    if (r.status === 'played' || r.status === 'retired') {
      const det = parseKoPlayedScoreDetail(r.score ?? '', r.status === 'retired');
      if (det.ok) {
        const swSelf = side === 'A' ? det.setsWonA : det.setsWonB;
        const slSelf = side === 'A' ? det.setsWonB : det.setsWonA;
        sw += swSelf;
        sl += slSelf;
      }
    }
  }
  return {
    totalMatchesPlayed: pj,
    totalWins: pg,
    totalLosses: pp,
    setsWon: sw,
    setsLost: sl,
    setDifference: sw - sl,
    winRate: pj > 0 ? pg / pj : 0,
  };
}

type CompletedPlayerMatch = Match & {
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  scheduledDate: Date | null;
  updatedAt: Date;
  score: string | null;
};

function calendarYearFromPrismaMatch(m: CompletedPlayerMatch): number {
  const t = matchSortMsFromParts(null, m.updatedAt, m.scheduledDate);
  return new Date(t).getFullYear();
}

/** Estadísticas de carrera/temporada deduplicando MatchResult y Match completados. */
export function aggregateDedupedPlayerCareerStats(
  matchResults: MatchResult[],
  completedMatches: CompletedPlayerMatch[],
  playerId: string,
  playerNames: string[],
  nameToId: Map<string, string>,
  yearFilter?: number,
): MatchAgg {
  const fromResults = aggregateMatchResultsForPlayer(matchResults, playerId, playerNames, nameToId, yearFilter);
  const linkedMatchIds = new Set(
    matchResults
      .map((r) => r.matchId?.trim())
      .filter((id): id is string => Boolean(id)),
  );

  let extraPj = 0;
  let extraPg = 0;
  let extraPp = 0;
  let extraSw = 0;
  let extraSl = 0;

  for (const m of completedMatches) {
    if (!m.winnerId || !m.player1Id || !m.player2Id) continue;
    if (m.player1Id !== playerId && m.player2Id !== playerId) continue;
    if (linkedMatchIds.has(m.id)) continue;
    if (yearFilter != null && calendarYearFromPrismaMatch(m) !== yearFilter) continue;

    extraPj += 1;
    const won = m.winnerId === playerId;
    if (won) extraPg += 1;
    else extraPp += 1;
    const line = (m.score ?? '').trim();
    if (line) {
      const det = parseKoPlayedScoreDetail(line, false);
      if (det.ok) {
        const swSelf = m.player1Id === playerId ? det.setsWonA : det.setsWonB;
        const slSelf = m.player1Id === playerId ? det.setsWonB : det.setsWonA;
        extraSw += swSelf;
        extraSl += slSelf;
      }
    }
  }

  const pj = fromResults.totalMatchesPlayed + extraPj;
  const pg = fromResults.totalWins + extraPg;
  const pp = fromResults.totalLosses + extraPp;
  const sw = fromResults.setsWon + extraSw;
  const sl = fromResults.setsLost + extraSl;
  return {
    totalMatchesPlayed: pj,
    totalWins: pg,
    totalLosses: pp,
    setsWon: sw,
    setsLost: sl,
    setDifference: sw - sl,
    winRate: pj > 0 ? pg / pj : 0,
  };
}

export async function loadPlayerMatchResultsForProfile(prisma: PrismaClient): Promise<MatchResult[]> {
  return prisma.matchResult.findMany({
    where: { status: { in: ['played', 'walkover', 'retired', 'suspended'] } },
  });
}

export { buildNameToId, normName, playerInResult };
