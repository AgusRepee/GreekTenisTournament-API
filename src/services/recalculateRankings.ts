import type { MatchResult, Prisma, PrismaClient } from '@prisma/client';
import { parseKoPlayedScoreDetail } from './koScoreParse.js';
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
  leagueNumForPrismaMatch,
  loadPhaseMatchContext,
  normName,
  phaseKey,
  resolveLeagueForResult,
} from './phaseMatchIndex.js';

const CAT_TO_LEAGUE: Record<string, number> = {
  Primera: 1,
  Segunda: 2,
  Tercera: 3,
  Cuarta: 4,
  'Quinta A': 5,
  'Quinta B': 6,
};

export function categoryToLeague(cat: string | null | undefined): number {
  if (!cat) return 3;
  return CAT_TO_LEAGUE[cat] ?? 3;
}

type Agg = {
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
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
): void {
  const status = r.status;
  if (status === 'pending' || status === 'suspended') return;
  const idA = nameToId.get(normName(r.playerA));
  const idB = nameToId.get(normName(r.playerB));
  if (!idA || !idB) return;
  if (!leaguePlayerIds.has(idA) || !leaguePlayerIds.has(idB)) return;

  const keyA = `${idA}|${leagueNum}`;
  const keyB = `${idB}|${leagueNum}`;

  if (status === 'walkover') {
    const s = (r.score ?? '').trim().toUpperCase();
    const winId = s === 'B' ? idB : idA;
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

/** Recalcula filas `LeagueRankingRow` y un `RankingSnapshot` agregado. Idempotente. */
export async function recalculateRankings(prisma: PrismaClient): Promise<{ rowsWritten: number }> {
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
  } = await loadPhaseMatchContext(prisma);

  const tournamentCatalogById = new Map(
    tournaments.map((t) => [t.id, effectivePrismaTournamentCatalogType({ id: t.id, name: t.name, tournamentType: t.tournamentType })] as const),
  );

  const agg = new Map<string, Agg>();
  const statsDedupe = new Set<string>();

  for (const r of matchResults) {
    const ln = resolveLeagueForResult(r, matchById, leaguesByTournament);
    if (ln == null) continue;
    const dedupe = r.matchId?.trim() || r.dedupeKey;
    const dkey = `${dedupe}|${ln}`;
    if (statsDedupe.has(dkey)) continue;
    statsDedupe.add(dkey);

    const leaguePlayerIds = new Set(players.filter((p) => categoryToLeague(p.category) === ln).map((p) => p.id));
    ingestMatchResultStats(r, ln, nameToId, leaguePlayerIds, agg);
  }

  /** Match completado sin `MatchResult` enlazado (legacy): contar PJ/PG/sets desde fila `Match`. */
  for (const m of matches) {
    if (!m.completed || !m.winnerId) continue;
    const mr = matchResults.find((x) => x.matchId === m.id);
    if (mr && mr.status !== 'pending' && mr.status !== 'suspended') continue;

    const ln = leagueNumForPrismaMatch(m, leaguesByTournament);
    if (ln == null) continue;
    const leaguePlayerIds = new Set(players.filter((p) => categoryToLeague(p.category) === ln).map((p) => p.id));
    const idA = m.player1Id;
    const idB = m.player2Id;
    if (!leaguePlayerIds.has(idA) || !leaguePlayerIds.has(idB)) continue;

    const dkey = `match-only:${m.id}|${ln}`;
    if (statsDedupe.has(dkey)) continue;
    statsDedupe.add(dkey);

    const keyA = `${idA}|${ln}`;
    const keyB = `${idB}|${ln}`;
    const winId = m.winnerId;
    const scoreLine = (m.score ?? '').trim();
    const det = scoreLine ? parseKoPlayedScoreDetail(scoreLine, false) : null;

    if (det?.ok) {
      const winId2 = det.winner === 'A' ? idA : idB;
      addAgg(agg, keyA, {
        played: 1,
        wins: winId2 === idA ? 1 : 0,
        losses: winId2 !== idA ? 1 : 0,
        setsWon: det.setsWonA,
        setsLost: det.setsWonB,
        gamesWon: det.gamesWonA,
        gamesLost: det.gamesWonB,
      });
      addAgg(agg, keyB, {
        played: 1,
        wins: winId2 === idB ? 1 : 0,
        losses: winId2 !== idB ? 1 : 0,
        setsWon: det.setsWonB,
        setsLost: det.setsWonA,
        gamesWon: det.gamesWonB,
        gamesLost: det.gamesWonA,
      });
    } else {
      addAgg(agg, keyA, {
        played: 1,
        wins: winId === idA ? 1 : 0,
        losses: winId !== idA ? 1 : 0,
      });
      addAgg(agg, keyB, {
        played: 1,
        wins: winId === idB ? 1 : 0,
        losses: winId !== idB ? 1 : 0,
      });
    }
  }

  const rowsOut: Array<{
    playerId: string;
    league: number;
    points: number;
    played: number;
    wins: number;
    losses: number;
    titles: number;
    finals: number;
    statsJson: Record<string, unknown>;
  }> = [];

  for (let leagueNum = 1; leagueNum <= 6; leagueNum++) {
    const L = leagueNum;
    const leaguePlayers = players.filter((p) => categoryToLeague(p.category) === L);
    const tournamentIdsForLeague = new Set(tournamentLeagues.filter((tl) => tl.leagueNum === L).map((tl) => tl.tournamentId));

    const phaseByTournament = new Map<string, TournamentPhaseMatch[]>();
    for (const tid of tournamentIdsForLeague) {
      phaseByTournament.set(tid, phaseMap.get(phaseKey(tid, L)) ?? []);
    }

    for (const p of leaguePlayers) {
      let points = 0;
      let tournamentsPlayed = 0;
      let titles = 0;
      let finals = 0;

      for (const tid of tournamentIdsForLeague) {
        const tl = tlByTournamentLeague.get(`${tid}|${L}`);
        const patch = tl?.rulesJson ? parseRankingPointsFromRulesJson(tl.rulesJson) : null;
        const catalog = tournamentCatalogById.get(tid) ?? 'greek500';
        const basePts = defaultRankingPointsForCatalogType(catalog);
        const pointsTable = mergePointsTable(basePts, patch);
        const pm = phaseMap.get(phaseKey(tid, L)) ?? [];
        const tp = tournamentPointsFromPhaseMatches(p.id, pm, pointsTable);
        if (tp.playedInTournament) tournamentsPlayed += 1;
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

  await prisma.$transaction(async (tx) => {
    await tx.leagueRankingRow.deleteMany({});
    if (rowsOut.length) {
      await tx.leagueRankingRow.createMany({
        data: rowsOut.map((r) => ({
          playerId: r.playerId,
          league: r.league,
          points: r.points,
          played: r.played,
          wins: r.wins,
          losses: r.losses,
          titles: r.titles,
          finals: r.finals,
          statsJson: r.statsJson as Prisma.InputJsonValue,
        })),
      });
    }
    await tx.rankingSnapshot.create({
      data: {
        leagueNum: 0,
        payload: {
          version: 1,
          computedAt: new Date().toISOString(),
          rowCount: rowsOut.length,
        },
      },
    });
  });

  return { rowsWritten: rowsOut.length };
}
