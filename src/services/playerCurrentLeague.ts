import type { Player, PrismaClient } from '@prisma/client';
import { readPublicCacheTtlMs, TimedCache } from '../lib/timedCache.js';
import { categoryToLeague } from './recalculateRankings.js';
import { buildScheduleLeagueByDedupeKey } from './phaseMatchIndex.js';

export type CurrentLeagueInputs = {
  /** Ligas donde figura en plantel de torneo (GroupPlayer). */
  rosterLeagues?: number[];
  /** Ligas donde tiene fila en ranking materializado. */
  rankingLeagues?: number[];
  /** Ligas inferidas por partidos (MatchResult o Match). */
  matchLeagues?: number[];
  /** Liga confirmada por ascenso (auditoría admin). */
  promotionToLeague?: number | null;
};

/** Liga actual = la más alta (número más bajo) entre todas las señales. */
export function resolvePlayerCurrentLeague(
  player: Pick<Player, 'category'>,
  inputs: CurrentLeagueInputs = {},
): number {
  const candidates = new Set<number>();
  candidates.add(categoryToLeague(player.category));
  for (const list of [
    inputs.rosterLeagues,
    inputs.rankingLeagues,
    inputs.matchLeagues,
  ]) {
    for (const L of list ?? []) {
      if (L >= 1 && L <= 6) candidates.add(L);
    }
  }
  const promo = inputs.promotionToLeague;
  if (promo != null && promo >= 1 && promo <= 6) candidates.add(promo);
  return Math.min(...candidates);
}

function leaguesByTournamentMap(
  tournamentLeagues: { tournamentId: string; leagueNum: number }[],
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const tl of tournamentLeagues) {
    const arr = map.get(tl.tournamentId) ?? [];
    arr.push(tl.leagueNum);
    map.set(tl.tournamentId, arr);
  }
  for (const [tid, arr] of map) {
    map.set(tid, [...new Set(arr)].sort((a, b) => a - b));
  }
  return map;
}

function pushLeague(map: Map<string, number[]>, playerId: string, league: number): void {
  if (league < 1 || league > 6) return;
  const cur = map.get(playerId) ?? [];
  if (!cur.includes(league)) cur.push(league);
  map.set(playerId, cur);
}

const currentLeagueCache = new TimedCache<Map<string, number>>(readPublicCacheTtlMs());

export async function buildCurrentLeagueMap(prisma: PrismaClient): Promise<Map<string, number>> {
  const cached = currentLeagueCache.get('all');
  if (cached) return cached;

  const map = await buildCurrentLeagueMapUncached(prisma);
  currentLeagueCache.set('all', map);
  return map;
}

async function buildCurrentLeagueMapUncached(prisma: PrismaClient): Promise<Map<string, number>> {
  const [
    players,
    groupPlayers,
    tournamentLeagues,
    promotions,
    matchResults,
    allPlayers,
    rankingRows,
    prismaMatches,
    scheduleEntries,
  ] = await Promise.all([
    prisma.player.findMany({ select: { id: true, category: true } }),
    prisma.groupPlayer.findMany({ include: { group: { select: { tournamentId: true } } } }),
    prisma.tournamentLeague.findMany({ select: { tournamentId: true, leagueNum: true } }),
    prisma.auditLog.findMany({
      where: { action: 'player_league_promotion', entity: 'Player' },
      orderBy: { createdAt: 'desc' },
      select: { entityId: true, payload: true },
    }),
    prisma.matchResult.findMany({
      where: { status: { in: ['played', 'walkover', 'retired'] } },
      select: { tournamentId: true, playerA: true, playerB: true, matchId: true, dedupeKey: true },
    }),
    prisma.player.findMany({ select: { id: true, name: true, displayName: true } }),
    prisma.leagueRankingRow.findMany({ select: { playerId: true, league: true } }),
    prisma.match.findMany({
      where: { completed: true },
      select: {
        player1Id: true,
        player2Id: true,
        tournamentLeague: { select: { leagueNum: true } },
      },
    }),
    prisma.tournamentScheduleEntry.findMany({ select: { dedupeKey: true, leagueNum: true } }),
  ]);

  const scheduleLeagueByDedupeKey = buildScheduleLeagueByDedupeKey(scheduleEntries);

  const byTournament = leaguesByTournamentMap(tournamentLeagues);

  const rosterByPlayer = new Map<string, number[]>();
  for (const gp of groupPlayers) {
    for (const L of byTournament.get(gp.group.tournamentId) ?? []) {
      pushLeague(rosterByPlayer, gp.playerId, L);
    }
  }

  const rankingByPlayer = new Map<string, number[]>();
  for (const row of rankingRows) {
    pushLeague(rankingByPlayer, row.playerId, row.league);
  }

  const promotionByPlayer = new Map<string, number>();
  for (const row of promotions) {
    const pid = row.entityId?.trim();
    if (!pid || promotionByPlayer.has(pid)) continue;
    const payload = row.payload as Record<string, unknown> | null;
    const to = payload?.toLeague;
    if (typeof to === 'number' && to >= 1 && to <= 6) promotionByPlayer.set(pid, to);
  }

  const nameToId = new Map<string, string>();
  for (const p of allPlayers) {
    nameToId.set(p.name.trim().toLowerCase(), p.id);
    if (p.displayName?.trim()) nameToId.set(p.displayName.trim().toLowerCase(), p.id);
    nameToId.set(p.id.toLowerCase(), p.id);
  }

  const matchLeaguesByPlayer = new Map<string, number[]>();
  for (const m of prismaMatches) {
    const L = m.tournamentLeague?.leagueNum;
    if (L == null) continue;
    pushLeague(matchLeaguesByPlayer, m.player1Id, L);
    pushLeague(matchLeaguesByPlayer, m.player2Id, L);
  }

  for (const r of matchResults) {
    let L = scheduleLeagueByDedupeKey.get(r.dedupeKey.trim()) ?? null;
    if (L == null) {
      const leagues = byTournament.get(r.tournamentId) ?? [];
      if (leagues.length !== 1) continue;
      L = leagues[0]!;
    }
    for (const nm of [r.playerA, r.playerB]) {
      const pid = nameToId.get(nm.trim().toLowerCase());
      if (!pid) continue;
      pushLeague(matchLeaguesByPlayer, pid, L);
    }
  }

  const out = new Map<string, number>();
  for (const p of players) {
    out.set(
      p.id,
      resolvePlayerCurrentLeague(p, {
        rosterLeagues: rosterByPlayer.get(p.id),
        rankingLeagues: rankingByPlayer.get(p.id),
        matchLeagues: matchLeaguesByPlayer.get(p.id),
        promotionToLeague: promotionByPlayer.get(p.id) ?? null,
      }),
    );
  }
  return out;
}

export async function resolvePlayerCurrentLeagueById(
  prisma: PrismaClient,
  player: Pick<Player, 'id' | 'category'>,
): Promise<number> {
  const map = await buildCurrentLeagueMap(prisma);
  return map.get(player.id) ?? categoryToLeague(player.category);
}
