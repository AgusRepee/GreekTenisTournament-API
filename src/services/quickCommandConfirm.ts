/**
 * POST /api/admin/quick-command/confirm — confirma acciones del asistente (reutiliza persistencia admin).
 */
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { appendAudit } from './auditAppend.js';
import { maybeRecalculateRankingsAfterMatchResults } from './rankingMilestoneFilter.js';
import { recalculateRankings } from './recalculateRankings.js';
import {
  applyKnockoutAfterMatchResultInTx,
  assertKoPayloadParseableForMatch,
  BadRequestKoError,
  isKnockoutEliminationMatch,
  KnockoutEditBlockedError,
} from './knockoutAdvanceFromMatchResult.js';
import {
  assertScheduleAllowsPlayedNormalResult,
  ScheduleRequiredForPlayedError,
} from './scheduleGuardForMatchResult.js';
import { clearFeaturedForHomeAfterResultInTx } from './clearFeaturedForHomeAfterResult.js';
import { resolveMatchResultMatchId } from './resolveMatchResultMatchId.js';
import { normalizeWalkoverScoreLetter } from './walkoverWinnerSide.js';
import type { MatchResultStatus, ScheduleStatus } from '@prisma/client';

export type QuickConfirmSaveResultBody = {
  action: 'save_result' | 'walkover';
  dedupeKey: string;
  tournamentId: string;
  matchId?: string;
  league?: number;
  playerA: string;
  playerB: string;
  group?: string;
  round?: number;
  score?: string;
  status?: string;
  winnerSide?: 'A' | 'B';
  replaceExisting?: boolean;
  date?: string;
};

export type QuickConfirmScheduleBody = {
  action: 'schedule_match' | 'reschedule_match';
  dedupeKey: string;
  tournamentId: string;
  matchId?: string;
  league: number;
  date: string;
  time: string;
  scheduleStatus?: string;
};

export type QuickConfirmSuspendBody = {
  action: 'suspend_match';
  dedupeKey: string;
  tournamentId: string;
  matchId?: string;
  league: number;
  playerA: string;
  playerB: string;
  group?: string;
  round?: number;
  reason?: string;
  date?: string;
};

function mapScheduleStatus(raw: string | undefined): ScheduleStatus {
  const s = (raw ?? 'scheduled').toLowerCase();
  const map: Record<string, ScheduleStatus> = {
    unscheduled: 'unscheduled',
    scheduled: 'scheduled',
    confirmed: 'confirmed',
    rescheduled: 'rescheduled',
    postponed: 'postponed',
    cancelled: 'cancelled',
    suspended: 'suspended',
  };
  return map[s] ?? 'scheduled';
}

function readRequiredString(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? body[key].trim() : String(body[key] ?? '').trim();
}

function readLeague(body: Record<string, unknown>): number | null {
  if (typeof body.league === 'number' && Number.isFinite(body.league)) return body.league;
  const n = Number(body.league);
  return Number.isFinite(n) ? n : null;
}

function mapResultStatus(raw: string | undefined): MatchResultStatus {
  const s = (raw ?? 'pending').toLowerCase();
  if (s === 'played') return 'played';
  if (s === 'walkover') return 'walkover';
  if (s === 'retired') return 'retired';
  if (s === 'suspended') return 'suspended';
  return 'pending';
}

export async function confirmQuickCommandSaveResult(
  db: PrismaClient,
  body: QuickConfirmSaveResultBody,
): Promise<{ ok: true; dedupeKey: string } | { ok: false; error: string; code?: string; status: number }> {
  const dedupeKey = body.dedupeKey.trim();
  const tournamentId = body.tournamentId.trim();
  if (!dedupeKey || !tournamentId) {
    return { ok: false, error: 'dedupeKey y tournamentId son obligatorios', status: 400 };
  }

  const existing = await db.matchResult.findUnique({ where: { dedupeKey } });
  if (existing && existing.status === 'played' && existing.score?.trim() && body.replaceExisting !== true) {
    return {
      ok: false,
      error: 'Ya existe un resultado cargado para este partido. Confirmá reemplazo explícito.',
      code: 'RESULT_EXISTS',
      status: 409,
    };
  }

  const status = mapResultStatus(body.status);
  let score = body.score != null ? String(body.score) : null;
  if (status === 'walkover') {
    if (body.winnerSide === 'B') score = 'B';
    else if (body.winnerSide === 'A') score = 'A';
    if (score) score = normalizeWalkoverScoreLetter(score);
    else score = 'A';
  }

  const payload = {
    dedupeKey,
    tournamentId,
    matchId: body.matchId?.trim() || undefined,
    groupKey: body.group?.trim() || null,
    roundNum: typeof body.round === 'number' ? body.round : null,
    playerA: String(body.playerA ?? '').trim(),
    playerB: String(body.playerB ?? '').trim(),
    score,
    status,
    playedAt:
      typeof body.date === 'string' && body.date.trim() ? new Date(body.date.trim().slice(0, 10)) : null,
  };

  if (!payload.playerA || !payload.playerB) {
    return { ok: false, error: 'playerA y playerB son obligatorios', status: 400 };
  }

  try {
    const row = await db.$transaction(async (tx) => {
      await assertScheduleAllowsPlayedNormalResult(tx, payload.dedupeKey, payload.status, payload.score);
      const linkedMatchId = await resolveMatchResultMatchId(tx, payload.matchId, payload.dedupeKey);
      if (linkedMatchId) {
        const m = await tx.match.findUnique({
          where: { id: linkedMatchId },
          include: { player1: true, player2: true },
        });
        if (m && isKnockoutEliminationMatch(m)) {
          assertKoPayloadParseableForMatch(m, { status: payload.status, score: payload.score });
        }
      }
      const r = await tx.matchResult.upsert({
        where: { dedupeKey: payload.dedupeKey },
        create: {
          dedupeKey: payload.dedupeKey,
          tournamentId: payload.tournamentId,
          matchId: linkedMatchId,
          groupKey: payload.groupKey,
          roundNum: payload.roundNum,
          playerA: payload.playerA,
          playerB: payload.playerB,
          score: payload.score,
          status: payload.status,
          playedAt: payload.playedAt,
        },
        update: {
          matchId: linkedMatchId,
          groupKey: payload.groupKey,
          roundNum: payload.roundNum,
          playerA: payload.playerA,
          playerB: payload.playerB,
          score: payload.score,
          status: payload.status,
          playedAt: payload.playedAt,
        },
      });
      await applyKnockoutAfterMatchResultInTx(tx, {
        matchResult: r,
        payload: {
          tournamentId: payload.tournamentId,
          matchId: linkedMatchId ?? undefined,
          status: payload.status,
          score: payload.score,
          playerA: payload.playerA,
          playerB: payload.playerB,
        },
      });
      await clearFeaturedForHomeAfterResultInTx(tx, payload.dedupeKey, payload.status, payload.score);
      return r;
    });

    await appendAudit(db, {
      action: 'quick_command_save_result',
      entityType: 'MatchResult',
      entityId: row.id,
      tournamentId: payload.tournamentId,
      afterJson: row,
    });
    await maybeRecalculateRankingsAfterMatchResults(db, [row], recalculateRankings);
    return { ok: true, dedupeKey };
  } catch (e) {
    if (e instanceof ScheduleRequiredForPlayedError) {
      return { ok: false, error: e.message, code: e.code, status: e.statusCode };
    }
    if (e instanceof KnockoutEditBlockedError) {
      return { ok: false, error: e.message, code: 'KO_EDIT_BLOCKED', status: e.statusCode };
    }
    if (e instanceof BadRequestKoError) {
      return { ok: false, error: e.message, code: 'KO_BAD_REQUEST', status: e.statusCode };
    }
    throw e;
  }
}

export async function confirmQuickCommandScheduleMatch(
  db: PrismaClient,
  body: QuickConfirmScheduleBody,
): Promise<{ ok: true; dedupeKey: string } | { ok: false; error: string; status: number }> {
  const dedupeKey = body.dedupeKey.trim();
  const tournamentId = body.tournamentId.trim();
  const leagueNum = body.league;
  const date = body.date.trim();
  const time = body.time.trim();
  if (!dedupeKey || !tournamentId || !Number.isFinite(leagueNum)) {
    return { ok: false, error: 'dedupeKey, tournamentId y league son obligatorios', status: 400 };
  }
  if (!date || !time) {
    return { ok: false, error: 'date y time son obligatorios', status: 400 };
  }

  const scheduleStatus = mapScheduleStatus(
    body.scheduleStatus ?? (body.action === 'reschedule_match' ? 'rescheduled' : 'scheduled'),
  );

  const row = await db.tournamentScheduleEntry.upsert({
    where: { dedupeKey },
    create: {
      dedupeKey,
      tournamentId,
      leagueNum,
      scheduleStatus,
      date,
      time,
    },
    update: {
      scheduleStatus,
      date,
      time,
    },
  });

  await appendAudit(db, {
    action: body.action === 'reschedule_match' ? 'quick_command_reschedule' : 'quick_command_schedule',
    entityType: 'TournamentScheduleEntry',
    entityId: dedupeKey,
    tournamentId: row.tournamentId,
    afterJson: row,
  });

  return { ok: true, dedupeKey };
}

export async function confirmQuickCommandSuspendMatch(
  db: PrismaClient,
  body: QuickConfirmSuspendBody,
): Promise<{ ok: true; dedupeKey: string } | { ok: false; error: string; status: number }> {
  const dedupeKey = body.dedupeKey.trim();
  const tournamentId = body.tournamentId.trim();
  const leagueNum = body.league;
  const playerA = body.playerA.trim();
  const playerB = body.playerB.trim();
  if (!dedupeKey || !tournamentId || !Number.isFinite(leagueNum)) {
    return { ok: false, error: 'dedupeKey, tournamentId y league son obligatorios', status: 400 };
  }
  if (!playerA || !playerB) {
    return { ok: false, error: 'playerA y playerB son obligatorios', status: 400 };
  }

  const today =
    typeof body.date === 'string' && body.date.trim()
      ? body.date.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  try {
    const row = await db.$transaction(async (tx) => {
      await tx.tournamentScheduleEntry.upsert({
        where: { dedupeKey },
        create: {
          dedupeKey,
          tournamentId,
          leagueNum,
          scheduleStatus: 'suspended',
          date: today,
          time: '',
          note: body.reason?.trim() || null,
        },
        update: {
          scheduleStatus: 'suspended',
          date: today,
          time: '',
          note: body.reason?.trim() || null,
        },
      });

      const linkedMatchId = await resolveMatchResultMatchId(tx, body.matchId, dedupeKey);
      return tx.matchResult.upsert({
        where: { dedupeKey },
        create: {
          dedupeKey,
          tournamentId,
          matchId: linkedMatchId,
          groupKey: body.group?.trim() || null,
          roundNum: typeof body.round === 'number' ? body.round : null,
          playerA,
          playerB,
          score: '',
          status: 'suspended',
          playedAt: new Date(today),
        },
        update: {
          matchId: linkedMatchId,
          groupKey: body.group?.trim() || null,
          roundNum: typeof body.round === 'number' ? body.round : null,
          playerA,
          playerB,
          score: '',
          status: 'suspended',
          playedAt: new Date(today),
        },
      });
    });

    await appendAudit(db, {
      action: 'quick_command_suspend',
      entityType: 'MatchResult',
      entityId: row.id,
      tournamentId,
      afterJson: row,
    });
    await maybeRecalculateRankingsAfterMatchResults(db, [row], recalculateRankings);
    return { ok: true, dedupeKey };
  } catch (e) {
    if (e instanceof KnockoutEditBlockedError) {
      return { ok: false, error: e.message, status: e.statusCode };
    }
    throw e;
  }
}

export async function handleQuickCommandConfirm(body: Record<string, unknown>) {
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (action === 'save_result' || action === 'walkover') {
    return confirmQuickCommandSaveResult(prisma, {
      action: action === 'walkover' ? 'walkover' : 'save_result',
      dedupeKey: readRequiredString(body, 'dedupeKey'),
      tournamentId: readRequiredString(body, 'tournamentId'),
      matchId: typeof body.matchId === 'string' ? body.matchId : undefined,
      league: readLeague(body) ?? undefined,
      playerA: readRequiredString(body, 'playerA'),
      playerB: readRequiredString(body, 'playerB'),
      group: typeof body.group === 'string' ? body.group : undefined,
      round: typeof body.round === 'number' ? body.round : Number(body.round) || undefined,
      score: body.score != null ? String(body.score) : undefined,
      status: action === 'walkover' ? 'walkover' : typeof body.status === 'string' ? body.status : undefined,
      winnerSide: body.winnerSide === 'A' || body.winnerSide === 'B' ? body.winnerSide : undefined,
      replaceExisting: body.replaceExisting === true,
      date: typeof body.date === 'string' ? body.date : undefined,
    });
  }
  if (action === 'schedule_match' || action === 'reschedule_match') {
    const league = readLeague(body);
    if (league == null) {
      return { ok: false as const, error: 'league es obligatoria', status: 400 };
    }
    return confirmQuickCommandScheduleMatch(prisma, {
      action,
      dedupeKey: readRequiredString(body, 'dedupeKey'),
      tournamentId: readRequiredString(body, 'tournamentId'),
      matchId: typeof body.matchId === 'string' ? body.matchId : undefined,
      league,
      date: readRequiredString(body, 'date'),
      time: readRequiredString(body, 'time'),
      scheduleStatus: typeof body.scheduleStatus === 'string' ? body.scheduleStatus : undefined,
    });
  }
  if (action === 'suspend_match') {
    const league = readLeague(body);
    if (league == null) {
      return { ok: false as const, error: 'league es obligatoria', status: 400 };
    }
    return confirmQuickCommandSuspendMatch(prisma, {
      action: 'suspend_match',
      dedupeKey: readRequiredString(body, 'dedupeKey'),
      tournamentId: readRequiredString(body, 'tournamentId'),
      matchId: typeof body.matchId === 'string' ? body.matchId : undefined,
      league,
      playerA: readRequiredString(body, 'playerA'),
      playerB: readRequiredString(body, 'playerB'),
      group: typeof body.group === 'string' ? body.group : undefined,
      round: typeof body.round === 'number' ? body.round : Number(body.round) || undefined,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
      date: typeof body.date === 'string' ? body.date : undefined,
    });
  }
  return { ok: false as const, error: 'Acción no soportada', status: 400 };
}
