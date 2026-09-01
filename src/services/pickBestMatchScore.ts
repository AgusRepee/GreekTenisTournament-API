export function countScoreSets(score: string | null | undefined): number {
  if (!score?.trim()) return 0;
  return score.trim().match(/\d+\s*-\s*\d+/g)?.length ?? 0;
}

/** Prefiere el marcador con más sets (p. ej. MatchResult completo vs Match.score truncado). */
export function pickBestMatchScore(...candidates: (string | null | undefined)[]): string {
  let best = '';
  let bestCount = 0;
  for (const candidate of candidates) {
    const trimmed = (candidate ?? '').trim();
    if (!trimmed) continue;
    const count = countScoreSets(trimmed);
    if (count > bestCount) {
      bestCount = count;
      best = trimmed;
    }
  }
  return best;
}
