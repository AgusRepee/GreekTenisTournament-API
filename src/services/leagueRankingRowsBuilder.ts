import type { MatchResult } from '@prisma/client';
import { parseKoPlayedScoreDetail } from './koScoreParse.js';
import { walkoverWinnerIsPlayerB } from './walkoverWinnerSide.js';
import type { PhaseMatchContext } from './phaseMatchIndex.js';
import {
  leagueNumForPrismaMatch,
  linkedMatchForResult,
  normName,
  phaseKey,
  resolveLeagueForResult,
} from './phaseMatchIndex.js';
import type { TournamentPhaseMatch } from './rankingPhase.js';
import {
  DEFAULT_RANKING_POINTS,
  mergePointsTable,
  parseRankingPointsFromRulesJson,
  tournamentPointsFromPhaseMatches,
  countSemifinalTournaments,
  defaultRankingPointsForCatalogType,
  effectivePrismaTournamentCatalogType,
} from './rankingPointsConfig.js';
import {
  playerCountsAsTournamentParticipant,
  playersForLeagueRanking,
  tournamentIdsForLeague,
} from './leagueRankingMembership.js';
import { statsJsonSetDiff } from './rankingPublicSort.js';
import {
  filterPhaseMatchesForPublishedRanking,
  shouldIncludeMatchResultInRankingStats,
  shouldIncludePrismaMatchInRankingStats,
} from './rankingMilestoneFilter.js';

type Agg = {
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
};

export type LeagueRankingRowBuilt = {
  playerId: string;
  playerName: string;
  league: number;
  points: number;
  played: number;
  wins: number;
  losses: number;
  titles: number;
  finals: number;
  statsJson: Record<string, unknown>;
};

function addAgg(m: Map<string, Agg>, key: string, init: Partial<Agg>) {
  const cur = m.get(key) ?? {
    played: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
  };
  m.set(key, {
    played: cur.played + (init.played ?? 0),
    wins: cur.wins + (init.wins ?? 0),
    losses: cur.losses + (init.losses ?? 0),
    setsWon: cur.setsWon + (init.setsWon ?? 0),
    setsLost: cur.setsLost + (init.setsLost ?? 0),
    gamesWon: cur.gamesWon + (init.gamesWon ?? 0),
    gamesLost: cur.gamesLost + (init.gamesLost ?? 0),
  });
}

function ingestMatchResultStats(
  r: MatchResult,
  leagueNum: number,
  nameToId: Map<string, string>,
  leaguePlayerIds: Set<string>,
  agg: Map<string, Agg>,
  linkedMatch?: { player1Id: string; player2Id: string } | null,
): void {
  const status = r.status;
  if (status === 'pending' || status === 'suspended') return;
  // Cuando existe Match, sus IDs son la fuente de verdad: resolver por nombre
  // podía asignar el resultado a un homónimo de otra liga.
  const idA = linkedMatch?.player1Id ?? nameToId.get(normName(r.playerA));
  const idB = linkedMatch?.player2Id ?? nameToId.get(normName(r.playerB));
  if (!idA || !idB) return;
  if (!leaguePlayerIds.has(idA) || !leaguePlayerIds.has(idB)) return;

  const keyA = `${idA}|${leagueNum}`;
  const keyB = `${idB}|${leagueNum}`;

  if (status === 'walkover') {
    const winId = walkoverWinnerIsPlayerB(r.score) ? idB : idA;
    addAgg(agg, keyA, winId === idA ? { played: 1, wins: 1 } : { played: 1, losses: 1 });
    addAgg(agg, keyB, winId === idB ? { played: 1, wins: 1 } : { played: 1, losses: 1 });
    return;
  }

  if (status === 'played' || status === 'retired') {
    const det = parseKoPlayedScoreDetail(r.score ?? '', status === 'retired');
    if (!det.ok) return;
    const winId = det.winner === 'A' ? idA : idB;
    const swA = det.setsWonA;
    const slA = det.setsWonB;
    addAgg(agg, keyA, {
      played: 1,
      wins: winId === idA ? 1 : 0,
      losses: winId !== idA ? 1 : 0,
      setsWon: swA,
      setsLost: slA,
      gamesWon: det.gamesWonA,
      gamesLost: det.gamesWonB,
    });
    addAgg(agg, keyB, {
      played: 1,
      wins: winId === idB ? 1 : 0,
      losses: winId !== idB ? 1 : 0,
      setsWon: slA,
      setsLost: swA,
      gamesWon: det.gamesWonB,
      gamesLost: det.gamesWonA,
    });
  }
}

export function compareBuiltLeagueRankingRows(a: LeagueRankingRowBuilt, b: LeagueRankingRowBuilt): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.titles !== a.titles) return b.titles - a.titles;
  if (b.finals !== a.finals) return b.finals - a.finals;
  if (b.wins !== a.wins) return b.wins - a.wins;
  const sd = statsJsonSetDiff(b.statsJson) - statsJsonSetDiff(a.statsJson);
  if (sd !== 0) return sd;
  return a.playerName.localeCompare(b.playerName, 'es');
}

export function buildLeagueRankingRows(
  ctx: PhaseMatchContext,
  participationByLeague: Map<number, Set<string>>,
  allowedTournamentIds: Set<string>,
): LeagueRankingRowBuilt[] {
  const {
    players,
    tournaments,
    tournamentLeagues,
    matches,
    matchResults,
    matchById,
    leaguesByTournament,
    tlByTournamentLeague,
    nameToId,
    phaseMap,
    scheduleLeagueByDedupeKey,
    groupRosterByTournament,
  } = ctx;

  const tournamentCatalogById = new Map(
    tournaments.map(
      (t) => [t.id, effectivePrismaTournamentCatalogType({ id: t.id, name: t.name, tournamentType: t.tournamentType })] as const,
    ),
  );
  const playerNameById = new Map(players.map((p) => [p.id, p.name] as const));

  const agg = new Map<string, Agg>();
  const statsDedupe = new Set<string>();

  const groupConfirmedByTournamentLeague = new Map<string, boolean>();
  const allPhaseByKey = new Map<string, TournamentPhaseMatch[]>();
  for (const tl of tournamentLeagues) {
    const k = `${tl.tournamentId}|${tl.leagueNum}`;
    groupConfirmedByTournamentLeague.set(k, tl.groupStageStatus === 'confirmed');
    allPhaseByKey.set(k, phaseMap.get(k) ?? []);
  }

  for (const r of matchResults) {
    if (!allowedTournamentIds.has(r.tournamentId)) continue;
    const ln = resolveLeagueForResult(r, matchById, leaguesByTournament, scheduleLeagueByDedupeKey);
    if (ln == null) continue;
    const tlKey = `${r.tournamentId}|${ln}`;
    const groupConfirmed = groupConfirmedByTournamentLeague.get(tlKey) ?? false;
    const allPm = allPhaseByKey.get(tlKey) ?? [];
    if (!shouldIncludeMatchResultInRankingStats(r, ctx, ln, groupConfirmed, allPm)) continue;

    const dedupe = r.matchId?.trim() || r.dedupeKey;
    const dkey = `${dedupe}|${ln}`;
    if (statsDedupe.has(dkey)) continue;
    statsDedupe.add(dkey);

    const leaguePlayerIds = participationByLeague.get(ln) ?? new Set<string>();
    const linkedMatch = linkedMatchForResult(r, matchById);
    ingestMatchResultStats(r, ln, nameToId, leaguePlayerIds, agg, linkedMatch);
  }

  for (const m of matches) {
    if (!allowedTournamentIds.has(m.tournamentId)) continue;
    if (!m.completed || !m.winnerId) continue;
    const mr = matchResults.find((x) => x.matchId === m.id);
    if (mr && mr.status !== 'pending' && mr.status !== 'suspended') continue;

    const ln = leagueNumForPrismaMatch(m, leaguesByTournament);
    if (ln == null) continue;
    const tlKey = `${m.tournamentId}|${ln}`;
    const groupConfirmed = groupConfirmedByTournamentLeague.get(tlKey) ?? false;
    const allPm = allPhaseByKey.get(tlKey) ?? [];
    if (!shouldIncludePrismaMatchInRankingStats(m, groupConfirmed, allPm)) continue;
    const leaguePlayerIds = participationByLeague.get(ln) ?? new Set<string>();
    const idA = m.player1Id;
    const idB = m.player2Id;
    if (!leaguePlayerIds.has(idA) || !leaguePlayerIds.has(idB)) continue;

    const dkey = `match-only:${m.id}|${ln}`;
    if (statsDedupe.has(dkey)) continue;
    statsDedupe.add(dkey);

    const winId = m.winnerId;
    const scoreLine = (m.score ?? '').trim();
    const det = scoreLine ? parseKoPlayedScoreDetail(scoreLine, false) : null;

    if (det?.ok) {
      const winId2 = det.winner === 'A' ? idA : idB;
      addAgg(agg, `${idA}|${ln}`, {
        played: 1,
        wins: winId2 === idA ? 1 : 0,
        losses: winId2 !== idA ? 1 : 0,
        setsWon: det.setsWonA,
        setsLost: det.setsWonB,
        gamesWon: det.gamesWonA,
        gamesLost: det.gamesWonB,
      });
      addAgg(agg, `${idB}|${ln}`, {
        played: 1,
        wins: winId2 === idB ? 1 : 0,
        losses: winId2 !== idB ? 1 : 0,
        setsWon: det.setsWonB,
        setsLost: det.setsWonA,
        gamesWon: det.gamesWonB,
        gamesLost: det.gamesWonA,
      });
    } else {
      addAgg(agg, `${idA}|${ln}`, {
        played: 1,
        wins: winId === idA ? 1 : 0,
        losses: winId !== idA ? 1 : 0,
      });
      addAgg(agg, `${idB}|${ln}`, {
        played: 1,
        wins: winId === idB ? 1 : 0,
        losses: winId !== idB ? 1 : 0,
      });
    }
  }

  const rowsOut: LeagueRankingRowBuilt[] = [];

  for (let leagueNum = 1; leagueNum <= 6; leagueNum++) {
    const L = leagueNum;
    const leaguePlayers = playersForLeagueRanking(players, L, participationByLeague);
    const leagueTournamentIds = [...tournamentIdsForLeague(tournamentLeagues, L)].filter((tid) =>
      allowedTournamentIds.has(tid),
    );

    const phaseByTournament = new Map<string, TournamentPhaseMatch[]>();
    for (const tid of leagueTournamentIds) {
      phaseByTournament.set(tid, phaseMap.get(phaseKey(tid, L)) ?? []);
    }

    for (const p of leaguePlayers) {
      let points = 0;
      let tournamentsPlayed = 0;
      let titles = 0;
      let finals = 0;

      for (const tid of leagueTournamentIds) {
        const tl = tlByTournamentLeague.get(`${tid}|${L}`);
        const patch = tl?.rulesJson ? parseRankingPointsFromRulesJson(tl.rulesJson) : null;
        const catalog = tournamentCatalogById.get(tid) ?? 'greek500';
        const basePts = defaultRankingPointsForCatalogType(catalog);
        const pointsTable = mergePointsTable(basePts, patch);
        const allPm = phaseMap.get(phaseKey(tid, L)) ?? [];
        const groupConfirmed = tl?.groupStageStatus === 'confirmed';
        const pm = filterPhaseMatchesForPublishedRanking(allPm, groupConfirmed);
        const tp = tournamentPointsFromPhaseMatches(p.id, pm, pointsTable);
        if (playerCountsAsTournamentParticipant(tp.playedInTournament, groupRosterByTournament, tid, p.id)) {
          tournamentsPlayed += 1;
        }
        points += tp.points;

        const participated = pm.some((x) => x.playerA === p.id || x.playerB === p.id);
        const t = tournaments.find((x) => x.id === tid);
        if (t?.status === 'finished' && participated) {
          if (t.winnerId === p.id) titles += 1;
          if (t.finalistId === p.id) finals += 1;
        }
      }

      const semifinals = countSemifinalTournaments(p.id, phaseByTournament);
      const key = `${p.id}|${L}`;
      const a = agg.get(key) ?? {
        played: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      };

      rowsOut.push({
        playerId: p.id,
        playerName: playerNameById.get(p.id) ?? p.name,
        league: L,
        points,
        played: a.played,
        wins: a.wins,
        losses: a.losses,
        titles,
        finals,
        statsJson: {
          setsWon: a.setsWon,
          setsLost: a.setsLost,
          setDiff: a.setsWon - a.setsLost,
          gamesWon: a.gamesWon,
          gamesLost: a.gamesLost,
          gameDiff: a.gamesWon - a.gamesLost,
          tournamentsPlayed,
          semifinals,
          rankingPointsTable: DEFAULT_RANKING_POINTS,
        },
      });
    }
  }

  return rowsOut;
}
