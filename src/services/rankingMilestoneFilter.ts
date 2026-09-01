/**
 * Ranking público: solo cuenta partidos / fases ya «publicadas» por hito.
 * - Grupos: tras `groupStageStatus === 'confirmed'`.
 * - KO: cuando todos los partidos de una ronda tienen ganador.
 */

import type { MatchResult, PrismaClient } from '@prisma/client';
import type { MatchWithLeagueGroup, PhaseMatchContext } from './phaseMatchIndex.js';
import {
  leagueNumForPrismaMatch,
  linkedMatchForResult,
  loadPhaseMatchContext,
  matchResultToPhaseMatch,
  phaseKey,
  prismaMatchToPhase,
  resolveLeagueForResult,
} from './phaseMatchIndex.js';
import {
  isGroupPhaseMatch,
  octavosRound,
  rankingMatchRoundKind,
  repechageRound,
  koRoundKind,
  type RankingMatchRoundKind,
  type TournamentPhaseMatch,
} from './rankingPhase.js';

export type { RankingMatchRoundKind };

const KO_ROUND_ORDER: RankingMatchRoundKind[] = ['repechage', 'octavos', 'quarter', 'semi', 'final'];

export function isKnockoutRoundComplete(
  allMatches: ReadonlyArray<TournamentPhaseMatch>,
  round: RankingMatchRoundKind,
): boolean {
  const inRound = allMatches.filter((m) => rankingMatchRoundKind(m) === round);
  if (inRound.length === 0) return false;
  return inRound.every((m) => m.winnerId != null && String(m.winnerId).trim() !== '');
}

export function publishedKnockoutRounds(
  allMatches: ReadonlyArray<TournamentPhaseMatch>,
): Set<RankingMatchRoundKind> {
  const published = new Set<RankingMatchRoundKind>();
  for (const r of KO_ROUND_ORDER) {
    if (isKnockoutRoundComplete(allMatches, r)) published.add(r);
  }
  return published;
}

export function filterPhaseMatchesForPublishedRanking(
  allMatches: ReadonlyArray<TournamentPhaseMatch>,
  groupStageConfirmed: boolean,
): TournamentPhaseMatch[] {
  const pubKo = publishedKnockoutRounds(allMatches);
  /** Cuartos cerrados: los cuatro semifinalistas ya están definidos. */
  const semifinalistsKnown = pubKo.has('quarter');
  /** Semis cerradas: los finalistas ya están definidos aunque la final no tenga ganador. */
  const finalistsKnown = pubKo.has('semi');
  return allMatches.filter((m) => {
    const kind = rankingMatchRoundKind(m);
    if (kind === 'group') return groupStageConfirmed && isGroupPhaseMatch(m);
    if (kind == null) return false;
    if (kind === 'semi' && semifinalistsKnown) return true;
    if (kind === 'final' && finalistsKnown) return true;
    return pubKo.has(kind);
  });
}

function isPrismaKoMatch(m: MatchWithLeagueGroup): boolean {
  if (m.stage === 'quarterfinal' || m.stage === 'semifinal' || m.stage === 'final' || m.stage === 'repechage') {
    return true;
  }
  const label = m.roundLabel ?? '';
  return repechageRound(label) || octavosRound(label) || koRoundKind(label) != null;
}

function isGroupMatchResult(r: MatchResult): boolean {
  const g = (r.groupKey ?? '').trim();
  if (!g || /^interzonal$/i.test(g) || /^KO-/i.test(g)) return false;
  return true;
}

export function shouldIncludeMatchResultInRankingStats(
  r: MatchResult,
  ctx: PhaseMatchContext,
  _leagueNum: number,
  groupStageConfirmed: boolean,
  allPhaseMatches: ReadonlyArray<TournamentPhaseMatch>,
): boolean {
  if (isGroupMatchResult(r)) return groupStageConfirmed;

  const m = linkedMatchForResult(r, ctx.matchById);
  if (m && isPrismaKoMatch(m)) {
    const pm = prismaMatchToPhase(m, r);
    if (!pm) return false;
    const kind = rankingMatchRoundKind(pm);
    if (!kind || kind === 'group') return false;
    return publishedKnockoutRounds(allPhaseMatches).has(kind);
  }

  const pm = matchResultToPhaseMatch(r, ctx.nameToId);
  if (pm && isGroupPhaseMatch(pm)) return groupStageConfirmed;
  return false;
}

export function shouldIncludePrismaMatchInRankingStats(
  m: MatchWithLeagueGroup,
  groupStageConfirmed: boolean,
  allPhaseMatches: ReadonlyArray<TournamentPhaseMatch>,
): boolean {
  if (m.stage === 'group') return groupStageConfirmed;
  if (!isPrismaKoMatch(m)) return false;
  const pm = prismaMatchToPhase(m);
  if (!pm) return false;
  const kind = rankingMatchRoundKind(pm);
  if (!kind || kind === 'group') return false;
  return publishedKnockoutRounds(allPhaseMatches).has(kind);
}

export function shouldRecalculateRankingsAfterMatchResult(
  result: MatchResult,
  ctx: PhaseMatchContext,
): boolean {
  const ln = resolveLeagueForResult(
    result,
    ctx.matchById,
    ctx.leaguesByTournament,
    ctx.scheduleLeagueByDedupeKey,
  );
  if (ln == null) return false;

  const tl = ctx.tlByTournamentLeague.get(`${result.tournamentId}|${ln}`);
  const groupConfirmed = tl?.groupStageStatus === 'confirmed';
  const allPm = ctx.phaseMap.get(phaseKey(result.tournamentId, ln)) ?? [];

  if (isGroupMatchResult(result)) {
    return groupConfirmed;
  }

  const m = linkedMatchForResult(result, ctx.matchById);
  if (m && isPrismaKoMatch(m)) {
    const pm = prismaMatchToPhase(m, result);
    const kind = pm ? rankingMatchRoundKind(pm) : null;
    if (kind && kind !== 'group') {
      return isKnockoutRoundComplete(allPm, kind);
    }
  }

  const pm = matchResultToPhaseMatch(result, ctx.nameToId);
  if (pm && isGroupPhaseMatch(pm)) return groupConfirmed;

  return false;
}

export async function maybeRecalculateRankingsAfterMatchResults(
  prisma: PrismaClient,
  results: MatchResult[],
  recalculate: (p: PrismaClient) => Promise<unknown>,
): Promise<void> {
  if (!results.length) return;
  const ctx = await loadPhaseMatchContext(prisma);
  const should = results.some((r) => shouldRecalculateRankingsAfterMatchResult(r, ctx));
  if (should) await recalculate(prisma);
}

export function leagueNumForMatchResult(
  r: MatchResult,
  ctx: PhaseMatchContext,
): number | null {
  return resolveLeagueForResult(r, ctx.matchById, ctx.leaguesByTournament, ctx.scheduleLeagueByDedupeKey);
}

export function leagueNumForPrismaMatchRow(
  m: MatchWithLeagueGroup,
  ctx: PhaseMatchContext,
): number | null {
  return leagueNumForPrismaMatch(m, ctx.leaguesByTournament);
}
