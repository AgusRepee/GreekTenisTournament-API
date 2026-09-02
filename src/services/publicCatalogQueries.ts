import type { NewsStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withQueryTimeout } from '../lib/queryTimeout.js';
import { readPublicCacheTtlMs, TimedCache } from '../lib/timedCache.js';
import { mergeActiveRosterRankingRows } from './activeRosterRankingRows.js';
import { buildCurrentLeagueMap } from './playerCurrentLeague.js';
import { rankPublicRankingRows, type RankingRowWithPlayer } from './rankingPublicSort.js';
import { buildPublicPlayerProfile } from './buildPublicPlayerProfile.js';
import { buildPublicGroupStandings } from './buildPublicGroupStandings.js';

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

export async function fetchPublicPlayerProfile(playerId: string) {
  const key = `profile:${playerId}`;
  const hit = catalogCache.get(key);
  if (hit !== undefined) return hit;

  const payload = await withQueryTimeout(
    buildPublicPlayerProfile(prisma, playerId),
    'public.playerProfile',
  );
  catalogCache.set(key, payload);
  return payload;
}

export async function fetchPublicTournamentDetail(slugOrId: string) {
  const key = `tournamentDetail:${slugOrId}`;
  const hit = catalogCache.get(key);
  if (hit !== undefined) return hit;

  const payload = await withQueryTimeout(buildPublicTournamentDetail(prisma, slugOrId), 'public.tournamentDetail');
  catalogCache.set(key, payload);
  return payload;
}

async function buildPublicTournamentDetail(prismaClient: typeof prisma, slugOrId: string) {
  const row = await prismaClient.tournament.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    include: {
      groups: {
        orderBy: { key: 'asc' },
        include: {
          players: {
            orderBy: { seed: 'asc' },
            include: { player: { select: { id: true, name: true, displayName: true } } },
          },
        },
      },
      leagues: { orderBy: { leagueNum: 'asc' }, include: { elimination: true } },
    },
  });
  if (!row) return null;

  const [matches, matchResults, schedules, groupStandings] = await Promise.all([
    prismaClient.match.findMany({
      where: { tournamentId: row.id },
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }, { roundLabel: 'asc' }, { id: 'asc' }],
      include: {
        group: { select: { id: true, key: true, displayName: true } },
        tournamentLeague: { select: { id: true, leagueNum: true } },
        player1: { select: { id: true, name: true, displayName: true, category: true, profileImage: true } },
        player2: { select: { id: true, name: true, displayName: true, category: true, profileImage: true } },
        winner: { select: { id: true, name: true, displayName: true } },
        loser: { select: { id: true, name: true, displayName: true } },
      },
    }),
    prismaClient.matchResult.findMany({
      where: { tournamentId: row.id },
      orderBy: [{ roundNum: 'asc' }, { updatedAt: 'desc' }],
      include: {
        match: {
          select: {
            id: true,
            group: { select: { id: true, key: true, displayName: true } },
            player1: { select: { id: true, name: true, displayName: true } },
            player2: { select: { id: true, name: true, displayName: true } },
            winner: { select: { id: true, name: true, displayName: true } },
          },
        },
      },
    }),
    prismaClient.tournamentScheduleEntry.findMany({
      where: { tournamentId: row.id },
      orderBy: [{ date: 'asc' }, { time: 'asc' }, { updatedAt: 'desc' }],
    }),
    buildPublicGroupStandings(prismaClient, row.id),
  ]);

  const elimination = row.leagues.map((league) => ({
    league,
    bracket: league.elimination,
    matches: matches.filter((m) => m.tournamentLeagueId === league.id && m.stage !== 'group' && m.stage !== 'interzonal'),
  }));

  const tournament = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tournamentType: row.tournamentType,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    location: row.location,
    coverImage: row.coverImage,
    slotsTotal: row.slotsTotal,
    slotsTaken: row.slotsTaken,
    ligaDoc: row.ligaDoc,
    preclasificacionJson: row.preclasificacionJson,
    groupRosterOverrideJson: row.groupRosterOverrideJson,
    winnerId: row.winnerId,
    finalistId: row.finalistId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  return {
    ...tournament,
    tournament,
    leagues: row.leagues,
    groups: row.groups,
    matches,
    matchResults,
    schedules,
    standings: groupStandings?.groups ?? [],
    groupStandings: groupStandings?.groups ?? [],
    elimination,
    preclasificacion: row.preclasificacionJson ?? null,
    groupRosterOverrideJson: row.groupRosterOverrideJson ?? null,
  };
}

export async function fetchPublicGroupStandings(tournamentId: string) {
  const key = `standings:${tournamentId}`;
  const hit = catalogCache.get(key);
  if (hit !== undefined) return hit;

  const payload = await withQueryTimeout(
    buildPublicGroupStandings(prisma, tournamentId),
    'public.groupStandings',
  );
  catalogCache.set(key, payload);
  return payload;
}

/** Invalida caché pública tras writes admin (rankings, roster, noticias). */
export function invalidatePublicCatalogCache(): void {
  catalogCache.clear();
  // buildCurrentLeagueMap tiene su propia caché; se refresca por TTL.
}
