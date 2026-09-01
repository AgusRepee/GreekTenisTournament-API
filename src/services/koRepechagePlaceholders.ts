/** Tokens WAIT_RP_n del borrador admin ↔ jugadores sistema en MySQL. */

const WAIT_RP_TOKEN = /^WAIT_RP_(\d+)$/i;

export function repechageWaitPlayerId(index: number): string {
  return `sys-ko-wait-rp-${index}`;
}

export function repechageWaitTokenFromPlayerId(playerId: string): string | null {
  const m = /^sys-ko-wait-rp-(\d+)$/i.exec(String(playerId ?? '').trim());
  if (!m) return null;
  return `WAIT_RP_${m[1]}`;
}

/** Convierte slot del JSON (WAIT_RP_n o id real) al playerId persistido en Match. */
export function resolveBracketSlotPlayerId(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = WAIT_RP_TOKEN.exec(s);
  if (m) return repechageWaitPlayerId(Number(m[1]));
  return s;
}

export function isRepechageWaitPlayerId(playerId: string | null | undefined): boolean {
  return /^sys-ko-wait-rp-\d+$/i.test(String(playerId ?? '').trim());
}

export function repechageIndexFromMatchId(matchId: string, tournamentId: string): number | null {
  const pref = `ko-${tournamentId.trim()}-rp-`;
  if (!matchId.startsWith(pref)) return null;
  const n = Number(matchId.slice(pref.length));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
