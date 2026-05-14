import type { Prisma } from '@prisma/client';

/** Formato alineado a `TournamentPreclasificacion` del frontend. */
export type PreclasificacionPayload = {
  capturedAt: string;
  sourceLabel?: string;
  orderedPlayerIds: string[];
};

export function parsePreclasificacionJson(value: unknown): PreclasificacionPayload | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const capturedAt = typeof o.capturedAt === 'string' ? o.capturedAt.trim() : '';
  const orderedPlayerIds = Array.isArray(o.orderedPlayerIds)
    ? o.orderedPlayerIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
    : [];
  const sourceLabel =
    typeof o.sourceLabel === 'string' && o.sourceLabel.trim().length > 0 ? o.sourceLabel.trim() : undefined;
  if (!capturedAt || orderedPlayerIds.length === 0) return null;
  return sourceLabel ? { capturedAt, orderedPlayerIds, sourceLabel } : { capturedAt, orderedPlayerIds };
}

/** Body PATCH / JSON persistido: valida y devuelve valor para Prisma (o lanza). */
export function assertPreclasificacionForWrite(raw: unknown): Prisma.InputJsonValue {
  const parsed = parsePreclasificacionJson(raw);
  if (!parsed) {
    throw new Error('preclasificacion inválida: se requiere capturedAt (ISO) y orderedPlayerIds (array de ids no vacío)');
  }
  return parsed as Prisma.InputJsonValue;
}
