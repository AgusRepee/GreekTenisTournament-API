/**
 * Subconjunto del motor de marcadores (alineado a `matchStatsEngine.parseMatchScore`)
 * para resolver ganador A/B en servidor sin dependencias del frontend.
 */

export type ParsedSetLite = {
  gamesA: number;
  gamesB: number;
  tiebreak?: number;
  isMatchTiebreak: boolean;
};

export type ParseKoScoreOk = { ok: true; winner: 'A' | 'B'; isRetired: boolean };
export type ParseKoScoreErr = { ok: false; error: string };
export type ParseKoScoreResult = ParseKoScoreOk | ParseKoScoreErr;

function looksLikeMatchTiebreak(a: number, b: number): boolean {
  const max = Math.max(a, b);
  return max >= 10 && max <= 99;
}

function validateMatchTiebreak(a: number, b: number): string | null {
  if (a < 0 || b < 0) return 'No se permiten valores negativos.';
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  if (a === b) return 'No puede haber empate en el Super Tie-Break.';
  if (max < 10) return 'El ganador del Super Tie-Break debe tener al menos 10 puntos.';
  if (max - min < 2) return 'El Super Tie-Break debe ganarse por diferencia de 2.';
  return null;
}

function validateRegularSet(a: number, b: number, hasTiebreakInfo: boolean): string | null {
  if (a < 0 || b < 0) return 'No se permiten valores negativos.';
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  if (a === b) return 'No puede haber empate en un set.';
  if (max !== 6 && max !== 7) return 'El ganador del set debe cerrar con 6 o con 7 games.';
  if (max === 6) {
    if (min > 4) return 'Con 6 games el máximo rival es 4 (diferencia mínima de 2 games).';
    return null;
  }
  const validWithoutTb = min === 5;
  const validWithTb = min === 6;
  if (!validWithoutTb && !validWithTb) return 'Solo son válidos 7-5 o 7-6 en un set decidido por tie-break.';
  if (min === 6 && !hasTiebreakInfo) return null;
  return null;
}

function parseScoreSegment(segmentRaw: string): ParsedSetLite | null {
  const segment = segmentRaw.trim().toUpperCase();
  const tbMatch = segment.match(/^(\d+)-(\d+)\((\d+)\)$/);
  if (tbMatch) {
    const gamesA = Number(tbMatch[1]);
    const gamesB = Number(tbMatch[2]);
    const tiebreak = Number(tbMatch[3]);
    const err = validateRegularSet(gamesA, gamesB, true);
    if (err) return null;
    return { gamesA, gamesB, tiebreak, isMatchTiebreak: false };
  }
  const plainMatch = segment.match(/^(\d+)-(\d+)$/);
  if (!plainMatch) return null;
  const gamesA = Number(plainMatch[1]);
  const gamesB = Number(plainMatch[2]);
  if (looksLikeMatchTiebreak(gamesA, gamesB)) {
    const err = validateMatchTiebreak(gamesA, gamesB);
    if (err) return null;
    return { gamesA, gamesB, isMatchTiebreak: true };
  }
  const err = validateRegularSet(gamesA, gamesB, false);
  if (err) return null;
  return { gamesA, gamesB, isMatchTiebreak: false };
}

function validateSetSequence(sets: ParsedSetLite[], isRetired: boolean): string | null {
  let matchTiebreakCount = 0;
  for (const [index, set] of sets.entries()) {
    if (set.isMatchTiebreak) {
      matchTiebreakCount += 1;
      if (index !== sets.length - 1) return 'El Super Tie-Break solo puede ir al final del marcador.';
      if (index < 2 && !isRetired && sets.length < 3) {
        return 'El Super Tie-Break debe ser el tercer set cuando jugás al mejor de tres.';
      }
    }
  }
  if (matchTiebreakCount > 1) return 'No puede haber más de un Super Tie-Break en un partido.';
  return null;
}

export type ParseKoDetailOk = {
  ok: true;
  winner: 'A' | 'B';
  isRetired: boolean;
  setsWonA: number;
  setsWonB: number;
  gamesWonA: number;
  gamesWonB: number;
};
export type ParseKoDetailResult = ParseKoDetailOk | ParseKoScoreErr;

/** Igual que `parseKoPlayedScoreWinner` pero expone conteos de sets y games por lado (para estadísticas). */
export function parseKoPlayedScoreDetail(scoreRaw: string, isRetired: boolean): ParseKoDetailResult {
  const score = scoreRaw.replace(/\s+/g, ' ').trim().toUpperCase();
  if (!score) return { ok: false, error: 'El marcador está vacío.' };

  const cleaned = score.replace(/\bRET\.?\b/g, '').trim();
  const rawSegments = cleaned
    .split(/[;,]|\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (rawSegments.length === 0) return { ok: false, error: 'No se encontraron sets válidos en el marcador.' };
  if (rawSegments.length > 3) return { ok: false, error: 'El marcador tiene demasiados segmentos para un partido al mejor de tres.' };

  const sets: ParsedSetLite[] = [];
  for (const seg of rawSegments) {
    const p = parseScoreSegment(seg);
    if (!p) return { ok: false, error: `Segmento inválido: "${seg}".` };
    sets.push(p);
  }
  const seqErr = validateSetSequence(sets, isRetired);
  if (seqErr) return { ok: false, error: seqErr };

  let setsWonA = 0;
  let setsWonB = 0;
  let gamesWonA = 0;
  let gamesWonB = 0;
  for (const set of sets) {
    gamesWonA += set.gamesA;
    gamesWonB += set.gamesB;
    if (set.gamesA > set.gamesB) setsWonA += 1;
    else if (set.gamesB > set.gamesA) setsWonB += 1;
  }

  if (!isRetired) {
    if (setsWonA === setsWonB) return { ok: false, error: 'El resultado todavía no define un ganador.' };
    if (setsWonA < 2 && setsWonB < 2 && sets.length < 2) {
      return { ok: false, error: 'Faltan sets para cerrar el partido (se necesitan 2 sets ganados o un tercer super tie-break).' };
    }
  }

  const winner: 'A' | 'B' = setsWonA > setsWonB ? 'A' : 'B';
  return { ok: true, winner, isRetired, setsWonA, setsWonB, gamesWonA, gamesWonB };
}

/** Parsea marcador jugado/retiro y devuelve el lado ganador A = player1, B = player2. */
export function parseKoPlayedScoreWinner(scoreRaw: string, isRetired: boolean): ParseKoScoreResult {
  const d = parseKoPlayedScoreDetail(scoreRaw, isRetired);
  if (!d.ok) return d;
  return { ok: true, winner: d.winner, isRetired: d.isRetired };
}
