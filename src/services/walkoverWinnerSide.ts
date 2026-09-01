import { parseKoPlayedScoreDetail } from './koScoreParse.js';

/** true si el walkover lo ganó playerB (score `B` o marcador numérico a favor de B). */
export function walkoverWinnerIsPlayerB(score: string | null | undefined): boolean {
  const s = (score ?? '').trim();
  if (!s) return false;
  if (/^B$/i.test(s)) return true;
  if (/^A$/i.test(s)) return false;
  const det = parseKoPlayedScoreDetail(s, false);
  if (det.ok) return det.winner === 'B';
  return false;
}

/** Normaliza score de walkover al formato canónico `A` | `B`. */
export function normalizeWalkoverScoreLetter(score: string | null | undefined): 'A' | 'B' {
  return walkoverWinnerIsPlayerB(score) ? 'B' : 'A';
}

/** Marcador estadístico canónico de walkover (2 sets a favor del ganador). */
export const WALKOVER_WINNER_SETS = 2;
export const WALKOVER_WINNER_GAMES = 12;

export function walkoverAggForWinner(_winIsB: boolean): {
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
} {
  return {
    setsWon: WALKOVER_WINNER_SETS,
    setsLost: 0,
    gamesWon: WALKOVER_WINNER_GAMES,
    gamesLost: 0,
  };
}

export function walkoverAggForLoser(): {
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
} {
  return { setsWon: 0, setsLost: WALKOVER_WINNER_SETS, gamesWon: 0, gamesLost: WALKOVER_WINNER_GAMES };
}
