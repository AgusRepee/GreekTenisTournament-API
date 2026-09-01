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

export type RankingMatchRoundKind = 'repechage' | 'octavos' | 'quarter' | 'semi' | 'final';

export function octavosRound(round?: string): boolean {
  const r = (round ?? '').toLowerCase();
  return /\boctavos?\b|dieciseis|round\s*(of\s*)?16|\br16\b|\bof\s*16\b|16avos?|8vos?|\beighth\b/i.test(r);
}

export function koRoundKind(round?: string): RankingMatchRoundKind | null {
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
  return koRoundKind(round) != null || octavosRound(round);
}

/** Ronda de un partido para puntos de ranking (grupos o KO). */
export function rankingMatchRoundKind(m: TournamentPhaseMatch): 'group' | RankingMatchRoundKind | null {
  if (repechageRound(m.round)) return 'repechage';
  if (octavosRound(m.round)) return 'octavos';
  const ko = koRoundKind(m.round);
  if (ko) return ko;
  if (isGroupPhaseMatch(m)) return 'group';
  return null;
}

export function isRankingPointsMatch(m: TournamentPhaseMatch): boolean {
  const kind = rankingMatchRoundKind(m);
  return kind != null && kind !== 'group' ? true : isGroupPhaseMatch(m);
}

function inMatch(playerId: string, m: TournamentPhaseMatch): boolean {
  return m.playerA === playerId || m.playerB === playerId;
}

export function isGroupPhaseMatch(m: TournamentPhaseMatch): boolean {
  if (repechageRound(m.round) || koRoundKind(m.round) || octavosRound(m.round)) return false;
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
    if (!inMatch(playerId, m)) continue;
    // Al cerrarse los cuartos, los participantes de una semi pendiente ya
    // alcanzaron esta instancia. La final se resuelve antes en esta función,
    // por lo que un ganador de semifinal recibirá su categoría de finalista.
    if (!m.winnerId || m.winnerId !== playerId) return 'semifinalist';
  }

  let wonQuarterfinal = false;
  for (const m of quarters) {
    if (!m.winnerId || !inMatch(playerId, m)) continue;
    if (m.winnerId !== playerId) return 'quarterfinalist';
    wonQuarterfinal = true;
  }
  // Cubre cuadros donde las semifinales aún no se materializaron al cerrar
  // cuartos: el ganador igualmente ya es semifinalista.
  if (wonQuarterfinal) return 'semifinalist';

  const inMainKo = [...quarters, ...semis, ...finals].some((m) => inMatch(playerId, m));
  if (!inMainKo) {
    for (const m of reps) {
      if (!m.winnerId || !inMatch(playerId, m)) continue;
      // El bonus de repechaje es exclusivamente para quien queda eliminado.
      // Si gana, espera a que su siguiente instancia quede materializada.
      if (m.winnerId !== playerId) return 'repechage';
    }
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
