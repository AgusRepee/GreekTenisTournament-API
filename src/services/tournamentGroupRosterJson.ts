/** Valida plantel `{ A: ['p1', ...], B: [...] }` desde admin. */
export function assertGroupRosterOverrideForWrite(raw: unknown): Record<string, string[]> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('groupRosterOverride debe ser un objeto por clave de grupo.');
  }
  const out: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const k = key.trim();
    if (!k) continue;
    if (!Array.isArray(val)) {
      throw new Error(`Grupo "${k}": el valor debe ser un array de ids.`);
    }
    out[k] = val.map((x) => String(x).trim()).filter(Boolean);
  }
  return out;
}

export function groupRosterOverrideFromJson(raw: unknown): Record<string, string[]> | undefined {
  try {
    const parsed = assertGroupRosterOverrideForWrite(raw);
    return Object.keys(parsed).length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}
