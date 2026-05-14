/**
 * Misma regla que `matchScheduleForResultGuard` en el frontend: resultado jugado normal con marcador
 * numérico exige fila de agenda con fecha y hora (API / Prisma).
 */
import type { MatchResultStatus, Prisma, TournamentScheduleEntry } from '@prisma/client';

export const SCHEDULE_REQUIRED_FOR_PLAYED_MESSAGE =
  'Este partido tiene un resultado jugado, pero no tiene fecha programada. Para guardar el resultado, primero asigná fecha y hora.';

export class ScheduleRequiredForPlayedError extends Error {
  readonly statusCode = 400;
  readonly code = 'SCHEDULE_REQUIRED_FOR_PLAYED';
  constructor(message: string = SCHEDULE_REQUIRED_FOR_PLAYED_MESSAGE) {
    super(message);
    this.name = 'ScheduleRequiredForPlayedError';
  }
}

export function prismaScheduleHasDateTimeForPlayedResult(row: TournamentScheduleEntry | null | undefined): boolean {
  if (!row) return false;
  const d = row.date?.trim() ?? '';
  const t = row.time?.trim() ?? '';
  if (!d || !t) return false;
  if (row.scheduleStatus === 'unscheduled' || row.scheduleStatus === 'cancelled') return false;
  return true;
}

/**
 * Heurística alineada al uso real de la API: jugado/retirado con marcador que parece sets/games.
 * Excluye walkover por status; scores solo "A"/"B"/"WO" no exigen agenda (compat legacy).
 */
export function apiPlayedNormalResultRequiresSchedule(status: MatchResultStatus, score: string | null): boolean {
  if (status === 'walkover') return false;
  if (status === 'suspended' || status === 'pending') return false;
  if (status !== 'played' && status !== 'retired') return false;
  const s = score?.trim() ?? '';
  if (!s) return false;
  const compact = s.replace(/\s+/g, ' ').trim();
  if (/^[AB]$/i.test(compact)) return false;
  if (compact.toUpperCase() === 'WO') return false;
  return /\d/.test(s);
}

export async function assertScheduleAllowsPlayedNormalResult(
  tx: Prisma.TransactionClient,
  dedupeKey: string,
  status: MatchResultStatus,
  score: string | null,
): Promise<void> {
  if (!apiPlayedNormalResultRequiresSchedule(status, score)) return;
  const row = await tx.tournamentScheduleEntry.findUnique({ where: { dedupeKey } });
  if (!prismaScheduleHasDateTimeForPlayedResult(row)) {
    throw new ScheduleRequiredForPlayedError();
  }
}
