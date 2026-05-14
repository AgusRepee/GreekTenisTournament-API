import type { Match, PrismaClient, Tournament } from '@prisma/client';
import { categoryToLeague } from './recalculateRankings.js';
import { loadPhaseMatchContext, phaseKey } from './phaseMatchIndex.js';
import {
  mergePointsTable,
  parseRankingPointsFromRulesJson,
  tournamentPointsFromPhaseMatches,
  defaultRankingPointsForCatalogType,
  effectivePrismaTournamentCatalogType,
  type TournamentPhase,
} from './rankingPointsConfig.js';
import { parseKoPlayedScoreDetail } from './koScoreParse.js';
import { comparePublicRankingRows, type RankingRowWithPlayer } from './rankingPublicSort.js';

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

function calendarYearFromMatch(m: Match & { tournament?: Pick<Tournament, 'endDate' | 'startDate'> | null }): number {
  const t = matchSortTimeMs(m);
  return new Date(t).getFullYear();
}

function stageLabelForRecent(stage: string): string {
  switch (stage) {
    case 'group':
      return 'Grupos';
    case 'interzonal':
      return 'Interzonal';
    case 'quarterfinal':
      return 'Cuartos';
    case 'semifinal':
      return 'Semifinales';
    case 'final':
      return 'Final';
    case 'repechage':
      return 'Repechaje';
    default:
      return 'Partido';
  }
}

async function computeBestHistoricalLeagueRank(prisma: PrismaClient, playerId: string): Promise<number | null> {
  const rows = await prisma.leagueRankingRow.findMany({
    include: { player: { select: { id: true, name: true, category: true, profileImage: true } } },
  });
  const typed = rows as RankingRowWithPlayer[];
  let best: number | null = null;
  for (let L = 1; L <= 6; L++) {
    const list = typed.filter((r) => r.league === L).sort(comparePublicRankingRows);
    const idx = list.findIndex((r) => r.playerId === playerId);
    if (idx < 0) continue;
    const row = list[idx]!;
    if (row.played <= 0 && row.wins <= 0) continue;
    const pos = idx + 1;
    best = best === null ? pos : Math.min(best, pos);
  }
  return best;
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
  playerCategory: string,
  allPlayers: { id: string; name: string; category: string }[],
  rankingRows: RankingRowWithPlayer[],
): ProfileRankings | null {
  const primaryLeague = categoryToLeague(playerCategory);
  const pointsForPlayer = (pid: string): { points: number; setsWon: number; setsLost: number } => {
    const p = allPlayers.find((x) => x.id === pid);
    if (!p) return { points: 0, setsWon: 0, setsLost: 0 };
    const L = categoryToLeague(p.category);
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

  const allRankingRows = allRankingRowsRaw as RankingRowWithPlayer[];
  const rosterIds = new Set(ctx.players.map((p) => p.id));
  const allPlayers = ctx.players.map((p) => ({ id: p.id, name: p.name, category: p.category }));
  if (!rosterIds.has(player.id)) {
    allPlayers.push({ id: player.id, name: player.name, category: player.category });
  }

  const primaryLeague = categoryToLeague(player.category);
  const rankings = allRankingRows.filter((r) => r.playerId === playerId).sort((a, b) => a.league - b.league);

  const rankingsByLeague: Record<string, (typeof rankings)[0] | null> = {};
  for (let L = 1; L <= 6; L++) {
    rankingsByLeague[String(L)] = rankings.find((r) => r.league === L) ?? null;
  }

  const careerAgg = aggregateCareerFromRankingRows(rankings);

  const primaryRank = rankings.find((r) => r.league === primaryLeague) ?? null;
  const primaryPoints = primaryRank?.points ?? 0;

  const profileRankings = buildProfileRankingsFromDb(player.id, player.category, allPlayers, allRankingRows);

  const { phaseMap, tournaments, tlByTournamentLeague } = ctx;
  const finishedTournaments = tournaments.filter((t) => t.status === 'finished');

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
  const seasonMatches = completedWithWinner.filter((m) => calendarYearFromMatch(m) === seasonYear);

  function addMatchAgg(list: typeof seasonMatches) {
    let pj = 0;
    let pg = 0;
    let pp = 0;
    let sw = 0;
    let sl = 0;
    for (const m of list) {
      pj += 1;
      const won = m.winnerId === playerId;
      if (won) pg += 1;
      else pp += 1;
      const line = (m.score ?? '').trim();
      if (line) {
        const det = parseKoPlayedScoreDetail(line, false);
        if (det.ok) {
          const swSelf = m.player1Id === playerId ? det.setsWonA : det.setsWonB;
          const slSelf = m.player1Id === playerId ? det.setsWonB : det.setsWonA;
          sw += swSelf;
          sl += slSelf;
        }
      }
    }
    const setDiff = sw - sl;
    const winRate = pj > 0 ? pg / pj : 0;
    return { totalMatchesPlayed: pj, totalWins: pg, totalLosses: pp, setsWon: sw, setsLost: sl, setDifference: setDiff, winRate };
  }

  const seasonCore = addMatchAgg(seasonMatches);
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
    tournamentsPlayed: participation.filter((p) => new Date(p.endDate).getFullYear() === seasonYear).length,
    tournamentsWon: seasonTitles,
    bestHistoricalRanking: null as number | null,
    currentLeague: primaryLeague,
  };

  const careerStats = {
    playerId,
    playerName: player.name,
    totalMatchesPlayed: careerAgg.played,
    totalWins: careerAgg.wins,
    totalLosses: careerAgg.losses,
    setsWon: careerAgg.setsWon,
    setsLost: careerAgg.setsLost,
    setDifference: careerAgg.setDiff,
    tournamentsPlayed: Math.max(careerAgg.tournamentsPlayed, distinctTournamentIds.size),
    tournamentsWon: careerAgg.titles,
    bestHistoricalRanking,
    currentLeague: primaryLeague,
    winRate: careerAgg.winRate,
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

  const recentMatchesDb = await prisma.match.findMany({
    where: {
      completed: true,
      OR: [{ player1Id: playerId }, { player2Id: playerId }],
    },
    take: 40,
    include: {
      player1: { select: { id: true, name: true } },
      player2: { select: { id: true, name: true } },
      winner: { select: { id: true, name: true } },
      loser: { select: { id: true, name: true } },
      tournament: { select: { id: true, name: true, slug: true, endDate: true } },
    },
  });
  recentMatchesDb.sort((a, b) => matchSortTimeMs(b) - matchSortTimeMs(a));
  const recentMatchesTop = recentMatchesDb.slice(0, 15);

  const recentMatches = recentMatchesTop.map((m) => {
    const dateIso = m.scheduledDate
      ? m.scheduledDate.toISOString().slice(0, 10)
      : m.tournament?.endDate
        ? m.tournament.endDate.toISOString().slice(0, 10)
        : undefined;
    const phaseLabel = `${m.tournament?.name ?? 'Torneo'} · ${stageLabelForRecent(m.stage)}`;
    return {
      id: m.id,
      score: m.score ?? '',
      stage: m.stage,
      scheduledDate: m.scheduledDate ? m.scheduledDate.toISOString() : null,
      dateIso,
      phaseLabel,
      player1: m.player1,
      player2: m.player2,
      winner: m.winner,
      tournament: m.tournament ? { id: m.tournament.id, name: m.tournament.name, slug: m.tournament.slug } : null,
    };
  });

  return {
    player,
    primaryLeague,
    primaryRanking: primaryRank,
    rankingsByLeague,
    profileRankings,
    recentMatches,
    tournamentsPlayedCount: tidFromMatches.size,
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
