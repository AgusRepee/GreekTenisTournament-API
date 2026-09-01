/** Claves de grupo usadas para fecha interzonal (docs, admin, API). */
export function isInterzonalGroupKey(group: string | undefined | null): boolean {
  const g = (group ?? '').trim();
  if (!g) return false;
  if (/^interzonal$/i.test(g)) return true;
  return /^fecha\s+\d+\s*\(\s*interzonal\s*\)$/i.test(g);
}
