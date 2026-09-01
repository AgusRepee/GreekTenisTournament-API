import { describe, expect, it } from 'vitest';
import {
  filterPhaseMatchesForPublishedRanking,
  isKnockoutRoundComplete,
  publishedKnockoutRounds,
  shouldRecalculateRankingsAfterMatchResult,
} from './rankingMilestoneFilter.js';
import type { TournamentPhaseMatch } from './rankingPhase.js';
import { matchRankingPointsForPlayer, DEFAULT_RANKING_POINTS } from './rankingPointsConfig.js';

describe('matchRankingPointsForPlayer', () => {
  it('suma puntos solo por partidos de grupos (sin KO ni repechaje)', () => {
    const matches: TournamentPhaseMatch[] = [
      { playerA: 'p1', playerB: 'p2', winnerId: 'p1', group: 'A', completed: true },
      { playerA: 'p1', playerB: 'p3', winnerId: 'p3', round: 'Cuartos de final', completed: true },
    ];
    expect(matchRankingPointsForPlayer('p1', matches, DEFAULT_RANKING_POINTS.groupMatches)).toBe(25);
    expect(matchRankingPointsForPlayer('p2', matches, DEFAULT_RANKING_POINTS.groupMatches)).toBe(10);
  });

  it('ignora repechaje y octavos', () => {
    const matches: TournamentPhaseMatch[] = [
      { playerA: 'a', playerB: 'b', winnerId: 'a', round: 'Repechaje', completed: true },
      { playerA: 'a', playerB: 'c', winnerId: 'c', round: 'Octavos de final', completed: true },
    ];
    expect(matchRankingPointsForPlayer('a', matches, DEFAULT_RANKING_POINTS.groupMatches)).toBe(0);
    expect(matchRankingPointsForPlayer('b', matches, DEFAULT_RANKING_POINTS.groupMatches)).toBe(0);
  });
});

describe('filterPhaseMatchesForPublishedRanking', () => {
  const groupMatch: TournamentPhaseMatch = {
    playerA: 'p1',
    playerB: 'p2',
    winnerId: 'p1',
    group: 'A',
    completed: true,
  };
  const qf1: TournamentPhaseMatch = {
    playerA: 'p1',
    playerB: 'p3',
    winnerId: 'p1',
    round: 'Cuartos de final',
    completed: true,
  };
  const qf2: TournamentPhaseMatch = {
    playerA: 'p4',
    playerB: 'p5',
    winnerId: null,
    round: 'Cuartos de final',
    completed: false,
  };

  it('sin confirmar grupos: excluye partidos de grupos', () => {
    expect(filterPhaseMatchesForPublishedRanking([groupMatch], false)).toEqual([]);
    expect(filterPhaseMatchesForPublishedRanking([groupMatch, qf1, qf2], false)).toEqual([]);
  });

  it('grupos confirmados: incluye grupos; KO solo rondas completas', () => {
    expect(filterPhaseMatchesForPublishedRanking([groupMatch, qf1, qf2], true)).toEqual([groupMatch]);
    expect(filterPhaseMatchesForPublishedRanking([groupMatch, qf1, { ...qf2, winnerId: 'p4' }], true)).toEqual([
      groupMatch,
      qf1,
      { ...qf2, winnerId: 'p4' },
    ]);
  });

  it('semis completas: incluye final pendiente para puntos de finalista', () => {
    const sf1: TournamentPhaseMatch = {
      playerA: 'p1',
      playerB: 'p3',
      winnerId: 'p1',
      round: 'Semifinales',
      completed: true,
    };
    const sf2: TournamentPhaseMatch = {
      playerA: 'p2',
      playerB: 'p4',
      winnerId: 'p2',
      round: 'Semifinales',
      completed: true,
    };
    const pendingFinal: TournamentPhaseMatch = {
      playerA: 'p1',
      playerB: 'p2',
      winnerId: null,
      round: 'Final',
      completed: false,
    };
    const filtered = filterPhaseMatchesForPublishedRanking([sf1, sf2, pendingFinal], true);
    expect(filtered).toEqual([sf1, sf2, pendingFinal]);
  });

  it('cuartos completos: incluye semis pendientes para publicar a los semifinalistas', () => {
    const completedQf1: TournamentPhaseMatch = {
      playerA: 'p1',
      playerB: 'p3',
      winnerId: 'p1',
      round: 'Cuartos de final',
      completed: true,
    };
    const completedQf2: TournamentPhaseMatch = {
      playerA: 'p2',
      playerB: 'p4',
      winnerId: 'p2',
      round: 'Cuartos de final',
      completed: true,
    };
    const pendingSemi: TournamentPhaseMatch = {
      playerA: 'p1',
      playerB: 'p2',
      winnerId: null,
      round: 'Semifinales',
      completed: false,
    };
    expect(filterPhaseMatchesForPublishedRanking([completedQf1, completedQf2, pendingSemi], true)).toEqual([
      completedQf1,
      completedQf2,
      pendingSemi,
    ]);
  });
});

describe('isKnockoutRoundComplete', () => {
  it('requiere ganador en todos los partidos de la ronda', () => {
    const all: TournamentPhaseMatch[] = [
      { playerA: 'a', playerB: 'b', winnerId: 'a', round: 'Semifinales' },
      { playerA: 'c', playerB: 'd', winnerId: null, round: 'Semifinales' },
    ];
    expect(isKnockoutRoundComplete(all, 'semi')).toBe(false);
    expect(
      isKnockoutRoundComplete(
        [
          { playerA: 'a', playerB: 'b', winnerId: 'a', round: 'Semifinales' },
          { playerA: 'c', playerB: 'd', winnerId: 'c', round: 'Semifinales' },
        ],
        'semi',
      ),
    ).toBe(true);
  });
});

describe('publishedKnockoutRounds', () => {
  it('publica repechaje antes que cuartos incompletos', () => {
    const all: TournamentPhaseMatch[] = [
      { playerA: 'a', playerB: 'b', winnerId: 'a', round: 'Repechaje' },
      { playerA: 'c', playerB: 'd', winnerId: 'c', round: 'Cuartos de final' },
      { playerA: 'e', playerB: 'f', winnerId: null, round: 'Cuartos de final' },
    ];
    const pub = publishedKnockoutRounds(all);
    expect(pub.has('repechage')).toBe(true);
    expect(pub.has('quarter')).toBe(false);
  });
});

describe('shouldRecalculateRankingsAfterMatchResult', () => {
  it('grupo sin confirmar: no recalcular', () => {
    expect(
      shouldRecalculateRankingsAfterMatchResult(
        {
          id: '1',
          dedupeKey: 'k',
          tournamentId: 't',
          matchId: null,
          groupKey: 'A',
          roundNum: 1,
          playerA: 'A',
          playerB: 'B',
          score: '6-0 6-0',
          setsJson: null,
          status: 'played',
          playedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          matchById: new Map(),
          leaguesByTournament: new Map([['t', [4]]]),
          scheduleLeagueByDedupeKey: new Map(),
          tlByTournamentLeague: new Map([['t|4', { groupStageStatus: null } as never]]),
          phaseMap: new Map(),
          nameToId: new Map(),
        } as never,
      ),
    ).toBe(false);
  });
});
