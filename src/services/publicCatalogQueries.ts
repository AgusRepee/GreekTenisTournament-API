import type { NewsStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withQueryTimeout } from '../lib/queryTimeout.js';
import { readPublicCacheTtlMs, TimedCache } from '../lib/timedCache.js';
import { mergeActiveRosterRankingRows } from './activeRosterRankingRows.js';
import { buildCurrentLeagueMap } from './playerCurrentLeague.js';
import { rankPublicRankingRows, type RankingRowWithPlayer } from './rankingPublicSort.js';

const catalogCache = new TimedCache<unknown>(readPublicCacheTtlMs());

export async function fetchPublicTournamentsCatalog() {
  const key = 'catalog:tournaments';
  const hit = catalogCache.get(key);
  if (hit) return hit;

  const rows = await withQueryTimeout(
    prisma.tournament.findMany({
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        location: true,
        coverImage: true,
        tournamentType: true,
        slotsTotal: true,
        slotsTaken: true,
        winnerId: true,
        finalistId: true,
        leagues: { orderBy: { leagueNum: 'asc' }, select: { leagueNum: true } },
      },
    }),
    'public.tournaments',
  );
  catalogCache.set(key, rows);
  return rows;
}

export async function fetchPublicPlayersCatalog() {
  const key = 'catalog:players';
  const hit = catalogCache.get(key);
  if (hit) return hit;

  const [rows, currentLeagueByPlayer] = await withQueryTimeout(
    Promise.all([
      prisma.player.findMany({
        where: { profileVisibility: 'active', rosterActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          name: true,
          category: true,
          birthDate: true,
          nationality: true,
          playingHand: true,
          heightCm: true,
          profileBio: true,
          profileImage: true,
          profileVisibility: true,
          rosterActive: true,
        },
      }),
      buildCurrentLeagueMap(prisma),
    ]),
    'public.players',
  );

  const payload = rows.map((p) => ({
    ...p,
    currentLeague: currentLeagueByPlayer.get(p.id) ?? null,
  }));
  catalogCache.set(key, payload);
  return payload;
}

export async function fetchPublicNewsCatalog() {
  const key = 'catalog:news';
  const hit = catalogCache.get(key);
  if (hit) return hit;

  const { mapPublicNewsRow } = await import('./adminNewsMap.js');
  const rows = await withQueryTimeout(
    prisma.news.findMany({
      where: { status: 'published' as NewsStatus },
      take: 50,
    }),
    'public.news',
  );
  rows.sort((a, b) => {
    const aPinned = a.pinnedAt != null;
    const bPinned = b.pinnedAt != null;
    if (aPinned && bPinned) return a.pinnedAt!.getTime() - b.pinnedAt!.getTime();
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    const aPub = (a.publishedAt ?? a.createdAt).getTime();
    const bPub = (b.publishedAt ?? b.createdAt).getTime();
    return bPub - aPub;
  });
  const payload = rows.map(mapPublicNewsRow);
  catalogCache.set(key, payload);
  return payload;
}

function rankRows(list: RankingRowWithPlayer[]) {
  return rankPublicRankingRows(list);
}

export async function fetchPublicRankingsCatalog(leagueNum: number | null) {
  const key = `catalog:rankings:${leagueNum ?? 'all'}`;
  const hit = catalogCache.get(key);
  if (hit) return hit;

  const baseWhere =
    leagueNum != null && leagueNum >= 1 && leagueNum <= 6 ? { league: leagueNum } : {};

  const rows = await withQueryTimeout(
    prisma.leagueRankingRow.findMany({
      where: baseWhere,
      include: {
        player: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            displayName: true,
            category: true,
            profileImage: true,
            nationality: true,
          },
        },
      },
      take: 2000,
    }),
    'public.rankings.rows',
  );

  const typed = await withQueryTimeout(
    mergeActiveRosterRankingRows(prisma, rows as RankingRowWithPlayer[], leagueNum),
    'public.rankings.mergeRoster',
  );

  const snapshots = await withQueryTimeout(
    prisma.rankingSnapshot.findMany({
      orderBy: { computedAt: 'desc' },
      take: 5,
    }),
    'public.rankings.snapshots',
  );

  let payload: unknown;
  if (leagueNum != null) {
    const withRank = rankRows(typed);
    payload = {
      rows: withRank,
      leagueFilter: leagueNum,
      snapshots,
      leagueRows: withRank,
    };
  } else {
    const byLeague: Record<string, ReturnType<typeof rankRows>> = {};
    for (let L = 1; L <= 6; L++) {
      byLeague[String(L)] = rankRows(typed.filter((r) => r.league === L));
    }
    payload = {
      byLeague,
      snapshots,
      leagueRows: rankRows(typed),
    };
  }

  catalogCache.set(key, payload);
  return payload;
}

/** Invalida caché pública tras writes admin (rankings, roster, noticias). */
export function invalidatePublicCatalogCache(): void {
  catalogCache.clear();
  // buildCurrentLeagueMap tiene su propia caché; se refresca por TTL.
}
