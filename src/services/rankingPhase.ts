/**
 * Detección de fase KO alcanzada (port de `playerReachedPhase.ts` del frontend).
 * Entrada mínima: ids de jugador en playerA/playerB/winnerId + round textual o grupo.
 */

export type PlayerReachedPhase =
  | 'champion'
  | 'finalist'
  | 'semifinalist'
  | 'quarterfinalist'
  | 'repechage'
  | 'group_stage'
  | 'none';

export type TournamentPhaseMatch = {
  playerA: string;
  playerB: string;
  winnerId?: string | null;
  round?: string;
  group?: string | null;
  completed?: boolean;
  /** Fase grupos: distingue WO vs jugado para puntos ranking por partido. */
  groupResultStatus?: 'played' | 'walkover' | 'retired';
};

export function koRoundKind(round?: string): 'final' | 'semi' | 'quarter' | null {
  const r = (round ?? '').toLowerCase();
  if (r.includes('cuart')) return 'quarter';
  if (r.includes('semi')) return 'semi';
  if (r.includes('final')) return 'final';
  return null;
}

export function repechageRound(round?: string): boolean {
  const r = (round ?? '').toLowerCase();
  return r.includes('repech');
}

export function isKnockoutRound(round?: string): boolean {
  return koRoundKind(round) != null;
}

function inMatch(playerId: string, m: TournamentPhaseMatch): boolean {
  return m.playerA === playerId || m.playerB === playerId;
}

export function isGroupPhaseMatch(m: TournamentPhaseMatch): boolean {
  if (repechageRound(m.round) || koRoundKind(m.round)) return false;
  const g = m.group != null ? String(m.group).trim() : '';
  if (!g || /^interzonal$/i.test(g)) return false;
  const played = m.winnerId != null && String(m.winnerId).length > 0;
  const completed = m.completed === true;
  return played || completed;
}

function collectKoByKind(matches: ReadonlyArray<TournamentPhaseMatch>) {
  const ko = matches.filter((m) => isKnockoutRound(m.round));
  return {
    finals: ko.filter((m) => koRoundKind(m.round) === 'final'),
    semis: ko.filter((m) => koRoundKind(m.round) === 'semi'),
    quarters: ko.filter((m) => koRoundKind(m.round) === 'quarter'),
  };
}

function resolvePlayerReachedPhase(playerId: string, tournamentMatches: ReadonlyArray<TournamentPhaseMatch>): PlayerReachedPhase {
  const { finals, semis, quarters } = collectKoByKind(tournamentMatches);
  const reps = tournamentMatches.filter((m) => repechageRound(m.round));

  const final = finals[0];
  if (final && inMatch(playerId, final)) {
    if (final.winnerId) {
      return final.winnerId === playerId ? 'champion' : 'finalist';
    }
    return 'finalist';
  }

  for (const m of semis) {
    if (!m.winnerId || !inMatch(playerId, m)) continue;
    if (m.winnerId !== playerId) return 'semifinalist';
  }

  for (const m of quarters) {
    if (!m.winnerId || !inMatch(playerId, m)) continue;
    if (m.winnerId !== playerId) return 'quarterfinalist';
  }

  const inMainKo = [...quarters, ...semis, ...finals].some((m) => inMatch(playerId, m));
  if (!inMainKo && reps.some((m) => inMatch(playerId, m))) {
    return 'repechage';
  }

  if (tournamentMatches.some((m) => isGroupPhaseMatch(m) && inMatch(playerId, m))) {
    return 'group_stage';
  }

  return 'none';
}

export function getPlayerReachedPhase(
  playerId: string,
  tournamentMatches: ReadonlyArray<TournamentPhaseMatch>,
): PlayerReachedPhase {
  if (tournamentMatches.length === 0) return 'none';
  return resolvePlayerReachedPhase(playerId, tournamentMatches);
}
