import type { Match, PrismaClient, Tournament } from '@prisma/client';
import { categoryToLeague } from './recalculateRankings.js';
import { resolvePlayerCurrentLeagueById } from './playerCurrentLeague.js';
import { loadPhaseMatchContext, phaseKey } from './phaseMatchIndex.js';
import { playerListedInTournamentGroupRoster } from './leagueRankingMembership.js';
import {
  mergePointsTable,
  parseRankingPointsFromRulesJson,
  tournamentPointsFromPhaseMatches,
  defaultRankingPointsForCatalogType,
  effectivePrismaTournamentCatalogType,
  type TournamentPhase,
} from './rankingPointsConfig.js';
import { comparePublicRankingRows, type RankingRowWithPlayer } from './rankingPublicSort.js';
import {
  aggregateDedupedPlayerCareerStats,
  buildNameToId,
  loadRecentMatchesForPlayerProfile,
} from './profileMatchFeed.js';
import { computeBestHistoricalLeagueRank } from './computeBestHistoricalLeagueRank.js';

function phaseLabelEs(phase: TournamentPhase): string {
  switch (phase) {
    case 'champion':
      return 'Campeón';
    case 'finalist':
      return 'Finalista';
    case 'semifinalist':
      return 'Semifinalista';
    case 'quarterfinalist':
      return 'Cuartos de final';
    case 'repechage':
      return 'Repechaje';
    case 'group_participant':
      return 'Fase de grupos';
    default:
      return 'Participó';
  }
}

function phaseDepth(phase: TournamentPhase): number {
  switch (phase) {
    case 'champion':
      return 6;
    case 'finalist':
      return 5;
    case 'semifinalist':
      return 4;
    case 'quarterfinalist':
      return 3;
    case 'repechage':
      return 2;
    case 'group_participant':
      return 1;
    default:
      return 0;
  }
}

function pickDeeperPhase(a: TournamentPhase, b: TournamentPhase): TournamentPhase {
  return phaseDepth(a) >= phaseDepth(b) ? a : b;
}

function matchSortTimeMs(m: Match & { tournament?: Pick<Tournament, 'endDate'> | null }): number {
  if (m.scheduledDate) return m.scheduledDate.getTime();
  if (m.tournament?.endDate) return m.tournament.endDate.getTime();
  return m.updatedAt.getTime();
}

type ProfileRankings = {
  globalPosition: number | null;
  globalTotal: number;
  league: number;
  leaguePosition: number | null;
  leagueTotal: number;
};

function buildProfileRankingsFromDb(
  playerId: string,
  primaryLeague: number,
  allPlayers: { id: string; name: string; category: string }[],
  rankingRows: RankingRowWithPlayer[],
): ProfileRankings | null {
  const pointsForPlayer = (pid: string): { points: number; setsWon: number; setsLost: number } => {
    const p = allPlayers.find((x) => x.id === pid);
    if (!p) return { points: 0, setsWon: 0, setsLost: 0 };
    const L = pid === playerId ? primaryLeague : categoryToLeague(p.category);
    const row = rankingRows.find((r) => r.playerId === pid && r.league === L);
    const sj = row?.statsJson as Record<string, unknown> | null | undefined;
    const sw = typeof sj?.setsWon === 'number' ? sj.setsWon : 0;
    const sl = typeof sj?.setsLost === 'number' ? sj.setsLost : 0;
    return { points: row?.points ?? 0, setsWon: sw, setsLost: sl };
  };

  const merged = allPlayers.map((pl) => {
    const { points, setsWon, setsLost } = pointsForPlayer(pl.id);
    return { playerId: pl.id, points, setsWon, setsLost };
  });
  merged.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const sdB = b.setsWon - b.setsLost;
    const sdA = a.setsWon - a.setsLost;
    if (sdB !== sdA) return sdB - sdA;
    const na = allPlayers.find((p) => p.id === a.playerId)?.name ?? '';
    const nb = allPlayers.find((p) => p.id === b.playerId)?.name ?? '';
    return na.localeCompare(nb, 'es');
  });
  const gIdx = merged.findIndex((x) => x.playerId === playerId);
  const globalPosition = gIdx >= 0 ? gIdx + 1 : null;

  const leagueList = rankingRows.filter((r) => r.league === primaryLeague).sort(comparePublicRankingRows);
  const lIdx = leagueList.findIndex((r) => r.playerId === playerId);
  const leaguePosition = lIdx >= 0 ? lIdx + 1 : null;

  return {
    globalPosition,
    globalTotal: Math.max(allPlayers.length, 1),
    league: primaryLeague,
    leaguePosition,
    leagueTotal: Math.max(leagueList.length, 1),
  };
}

function aggregateCareerFromRankingRows(
  rankings: { wins: number; losses: number; played: number; titles: number; finals: number; points: number; statsJson: unknown }[],
) {
  let titles = 0;
  let finals = 0;
  let wins = 0;
  let losses = 0;
  let played = 0;
  let pointsSum = 0;
  let setsWon = 0;
  let setsLost = 0;
  let semifinals = 0;
  let tournamentsPlayed = 0;
  for (const r of rankings) {
    titles += r.titles;
    finals += r.finals;
    wins += r.wins;
    losses += r.losses;
    played += r.played;
    pointsSum += r.points;
    const sj = r.statsJson as Record<string, unknown> | null | undefined;
    if (sj && typeof sj === 'object' && !Array.isArray(sj)) {
      if (typeof sj.setsWon === 'number') setsWon += sj.setsWon;
      if (typeof sj.setsLost === 'number') setsLost += sj.setsLost;
      if (typeof sj.semifinals === 'number') semifinals += sj.semifinals;
      if (typeof sj.tournamentsPlayed === 'number') tournamentsPlayed += sj.tournamentsPlayed;
    }
  }
  const setDiff = setsWon - setsLost;
  const winRate = played > 0 ? wins / played : 0;
  return {
    titles,
    finals,
    wins,
    losses,
    played,
    pointsSum,
    setsWon,
    setsLost,
    setDiff,
    winRate,
    semifinals,
    tournamentsPlayed,
  };
}

export async function buildPublicPlayerProfile(prisma: PrismaClient, playerId: string) {
  const [player, ctx, allRankingRowsRaw, bestHistoricalRanking] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    loadPhaseMatchContext(prisma),
    prisma.leagueRankingRow.findMany({
      include: { player: { select: { id: true, name: true, category: true, profileImage: true } } },
    }),
    computeBestHistoricalLeagueRank(prisma, playerId),
  ]);

  if (!player) return null;

  const currentLeague = await resolvePlayerCurrentLeagueById(prisma, player);

  const allRankingRows = allRankingRowsRaw as RankingRowWithPlayer[];
  const rosterIds = new Set(ctx.players.map((p) => p.id));
  const allPlayers = ctx.players.map((p) => ({ id: p.id, name: p.name, category: p.category }));
  if (!rosterIds.has(player.id)) {
    allPlayers.push({ id: player.id, name: player.name, category: player.category });
  }

  const primaryLeague = currentLeague;
  const rosterCategoryLeague = categoryToLeague(player.category);
  const rankings = allRankingRows.filter((r) => r.playerId === playerId).sort((a, b) => a.league - b.league);

  const rankingsByLeague: Record<string, (typeof rankings)[0] | null> = {};
  for (let L = 1; L <= 6; L++) {
    rankingsByLeague[String(L)] = rankings.find((r) => r.league === L) ?? null;
  }

  const careerAgg = aggregateCareerFromRankingRows(rankings);

  const primaryRank = rankings.find((r) => r.league === primaryLeague) ?? null;
  const primaryPoints = primaryRank?.points ?? 0;

  const profileRankings = buildProfileRankingsFromDb(player.id, currentLeague, allPlayers, allRankingRows);

  const activeLeagueRankings: Array<{
    league: number;
    position: number | null;
    total: number;
    points: number;
    played: number;
  }> = [];
  for (let L = 1; L <= 6; L++) {
    const row = rankings.find((r) => r.league === L);
    if (!row || (row.points <= 0 && row.played <= 0 && row.wins <= 0)) continue;
    const leagueList = allRankingRows.filter((r) => r.league === L).sort(comparePublicRankingRows);
    const idx = leagueList.findIndex((r) => r.playerId === playerId);
    activeLeagueRankings.push({
      league: L,
      position: idx >= 0 ? idx + 1 : null,
      total: leagueList.length,
      points: row.points,
      played: row.played,
    });
  }

  const { phaseMap, tournaments, tlByTournamentLeague, groupRosterByTournament } = ctx;
  const finishedTournaments = tournaments.filter((t) => t.status === 'finished');

  const rosterTournamentIds = (year?: number): Set<string> => {
    const ids = new Set<string>();
    for (const t of tournaments) {
      if (year != null && t.startDate.getFullYear() !== year && t.endDate.getFullYear() !== year) continue;
      if (playerListedInTournamentGroupRoster(groupRosterByTournament, t.id, playerId)) ids.add(t.id);
    }
    return ids;
  };

  const participation: Array<{
    tournamentId: string;
    name: string;
    slug: string | null;
    endDate: string;
    league: number;
    phase: TournamentPhase;
    phaseLabel: string;
    points: number;
  }> = [];

  for (const t of finishedTournaments) {
    for (let L = 1; L <= 6; L++) {
      const pm = phaseMap.get(phaseKey(t.id, L)) ?? [];
      const tl = tlByTournamentLeague.get(`${t.id}|${L}`);
      const patch = tl?.rulesJson ? parseRankingPointsFromRulesJson(tl.rulesJson) : null;
      const catalog = effectivePrismaTournamentCatalogType({ id: t.id, name: t.name, tournamentType: t.tournamentType });
      const pointsTable = mergePointsTable(defaultRankingPointsForCatalogType(catalog), patch);
      const tp = tournamentPointsFromPhaseMatches(playerId, pm, pointsTable);
      if (!tp.playedInTournament) continue;
      participation.push({
        tournamentId: t.id,
        name: t.name,
        slug: t.slug,
        endDate: t.endDate.toISOString().slice(0, 10),
        league: L,
        phase: tp.phase,
        phaseLabel: tp.phase === 'none' ? 'Participó' : phaseLabelEs(tp.phase),
        points: tp.points,
      });
    }
  }
  participation.sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
  const distinctTournamentIds = new Set(participation.map((p) => p.tournamentId));

  let finalsGaugeReached = 0;
  let finalsGaugeWon = 0;
  for (const t of finishedTournaments) {
    let best: TournamentPhase = 'none';
    for (let L = 1; L <= 6; L++) {
      const pm = phaseMap.get(phaseKey(t.id, L)) ?? [];
      const tl = tlByTournamentLeague.get(`${t.id}|${L}`);
      const patch = tl?.rulesJson ? parseRankingPointsFromRulesJson(tl.rulesJson) : null;
      const catalog = effectivePrismaTournamentCatalogType({ id: t.id, name: t.name, tournamentType: t.tournamentType });
      const pointsTable = mergePointsTable(defaultRankingPointsForCatalogType(catalog), patch);
      const tp = tournamentPointsFromPhaseMatches(playerId, pm, pointsTable);
      if (!tp.playedInTournament) continue;
      best = pickDeeperPhase(best, tp.phase);
    }
    if (best === 'champion') {
      finalsGaugeReached += 1;
      finalsGaugeWon += 1;
    } else if (best === 'finalist') {
      finalsGaugeReached += 1;
    }
  }
  const finalsGaugePct = finalsGaugeReached > 0 ? Math.round((finalsGaugeWon / finalsGaugeReached) * 100) : null;

  const playerMatches = await prisma.match.findMany({
    where: {
      OR: [{ player1Id: playerId }, { player2Id: playerId }],
    },
    include: {
      player1: { select: { id: true, name: true } },
      player2: { select: { id: true, name: true } },
      winner: { select: { id: true, name: true } },
      loser: { select: { id: true, name: true } },
      tournament: { select: { id: true, name: true, slug: true, endDate: true, startDate: true, status: true } },
    },
  });

  const completedWithWinner = playerMatches.filter((m) => m.completed && m.winnerId);
  completedWithWinner.sort((a, b) => matchSortTimeMs(a) - matchSortTimeMs(b));

  let streakCur = 0;
  let streakMax = 0;
  for (const m of completedWithWinner) {
    const won = m.winnerId === playerId;
    if (won) {
      streakCur += 1;
      streakMax = Math.max(streakMax, streakCur);
    } else {
      streakCur = 0;
    }
  }

  const seasonYear = new Date().getFullYear();

  const playersForMatching = rosterIds.has(player.id)
    ? ctx.players
    : [
        ...ctx.players,
        { id: player.id, name: player.name, displayName: player.displayName, category: player.category },
      ];
  const playerNameAliases = [player.name, player.displayName].filter((x): x is string => !!x?.trim());
  const nameToId = buildNameToId(playersForMatching as Parameters<typeof buildNameToId>[0]);
  const allMatchResults = await prisma.matchResult.findMany({
    where: { status: { in: ['played', 'walkover', 'retired'] } },
  });
  const seasonCore = aggregateDedupedPlayerCareerStats(
    allMatchResults,
    completedWithWinner,
    playerId,
    playerNameAliases,
    nameToId,
    seasonYear,
  );
  const careerMatchCore = aggregateDedupedPlayerCareerStats(
    allMatchResults,
    completedWithWinner,
    playerId,
    playerNameAliases,
    nameToId,
  );
  let seasonTitles = 0;
  let finalsSeasonReached = 0;
  let finalsSeasonWon = 0;
  for (const t of finishedTournaments) {
    const y = t.endDate.getFullYear();
    if (y !== seasonYear) continue;
    let best: TournamentPhase = 'none';
    for (let L = 1; L <= 6; L++) {
      const pm = phaseMap.get(phaseKey(t.id, L)) ?? [];
      const tl = tlByTournamentLeague.get(`${t.id}|${L}`);
      const patch = tl?.rulesJson ? parseRankingPointsFromRulesJson(tl.rulesJson) : null;
      const catalog = effectivePrismaTournamentCatalogType({ id: t.id, name: t.name, tournamentType: t.tournamentType });
      const pointsTable = mergePointsTable(defaultRankingPointsForCatalogType(catalog), patch);
      const tp = tournamentPointsFromPhaseMatches(playerId, pm, pointsTable);
      if (!tp.playedInTournament) continue;
      best = pickDeeperPhase(best, tp.phase);
    }
    if (best === 'champion') {
      seasonTitles += 1;
      finalsSeasonReached += 1;
      finalsSeasonWon += 1;
    } else if (best === 'finalist') {
      finalsSeasonReached += 1;
    }
  }

  const statsSeason = {
    playerId,
    playerName: player.name,
    ...seasonCore,
    tournamentsPlayed: Math.max(
      participation.filter((p) => new Date(p.endDate).getFullYear() === seasonYear).length,
      rosterTournamentIds(seasonYear).size,
    ),
    tournamentsWon: seasonTitles,
    bestHistoricalRanking: null as number | null,
    currentLeague: primaryLeague,
  };

  const careerStats = {
    playerId,
    playerName: player.name,
    totalMatchesPlayed: careerMatchCore.totalMatchesPlayed,
    totalWins: careerMatchCore.totalWins,
    totalLosses: careerMatchCore.totalLosses,
    setsWon: careerMatchCore.setsWon,
    setsLost: careerMatchCore.setsLost,
    setDifference: careerMatchCore.setDifference,
    tournamentsPlayed: Math.max(
      careerAgg.tournamentsPlayed,
      distinctTournamentIds.size,
      rosterTournamentIds().size,
    ),
    tournamentsWon: careerAgg.titles,
    bestHistoricalRanking: bestHistoricalRanking?.position ?? null,
    bestHistoricalRankingLeague: bestHistoricalRanking?.league ?? null,
    currentLeague: primaryLeague,
    winRate: careerMatchCore.winRate,
  };

  const gaugeMatchStages = { group: 0, interzonal: 0, quarterfinal: 0, semifinal: 0, final: 0, other: 0 };
  for (const m of completedWithWinner) {
    const k = m.stage as keyof typeof gaugeMatchStages;
    if (k in gaugeMatchStages) gaugeMatchStages[k] += 1;
    else gaugeMatchStages.other += 1;
  }

  const tidFromMatches = new Set(playerMatches.map((x) => x.tournamentId));
  const tidFromResults = await prisma.matchResult.findMany({
    where: {
      OR: [{ playerA: player.name }, { playerB: player.name }],
      status: { in: ['played', 'walkover', 'retired'] },
    },
    select: { tournamentId: true },
  });
  for (const r of tidFromResults) tidFromMatches.add(r.tournamentId);

  const tournamentHistory = await prisma.tournament.findMany({
    where: {
      status: 'finished',
      OR: [{ winnerId: playerId }, { finalistId: playerId }],
    },
    orderBy: { endDate: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      winnerId: true,
      finalistId: true,
      endDate: true,
    },
  });

  const histMapped = tournamentHistory.map((t) => ({
    tournamentId: t.id,
    name: t.name,
    slug: t.slug,
    endDate: t.endDate.toISOString().slice(0, 10),
    role: t.winnerId === playerId ? ('Campeón' as const) : ('Finalista' as const),
  }));

  const recentMatchesDb = await loadRecentMatchesForPlayerProfile(
    prisma,
    playerId,
    playerNameAliases,
    playersForMatching as Parameters<typeof buildNameToId>[0],
  );
  const recentMatches = recentMatchesDb;

  return {
    player: { ...player, currentLeague, rosterCategoryLeague },
    primaryLeague,
    rosterCategoryLeague,
    primaryRanking: primaryRank,
    rankingsByLeague,
    profileRankings,
    activeLeagueRankings,
    recentMatches,
    tournamentsPlayedCount: Math.max(tidFromMatches.size, rosterTournamentIds().size),
    tournamentHistory: histMapped,
    aggregate: {
      pointsSum: careerAgg.pointsSum,
      primaryLeaguePoints: primaryPoints,
      titles: careerAgg.titles,
      finals: careerAgg.finals,
      semifinals: careerAgg.semifinals,
      wins: careerAgg.wins,
      losses: careerAgg.losses,
      played: careerAgg.played,
      setsWon: careerAgg.setsWon,
      setsLost: careerAgg.setsLost,
      setDifference: careerAgg.setDiff,
      winRate: careerAgg.winRate,
    },
    careerStats,
    statsSeason,
    seasonYear,
    finalsGauge: {
      reached: finalsGaugeReached,
      won: finalsGaugeWon,
      pct: finalsGaugePct,
    },
    finalsSeason: {
      reached: finalsSeasonReached,
      won: finalsSeasonWon,
      pct: finalsSeasonReached > 0 ? Math.round((finalsSeasonWon / finalsSeasonReached) * 100) : null,
    },
    longestWinStreak: streakMax,
    tournamentParticipation: participation,
    gaugeMatchStages,
  };
}
