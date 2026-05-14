/**
 * Rutas `/api/admin/*` protegidas con JWT (`requireAdminJwt` antes de montar este router).
 * Cubren persistencia confirmada según especificación backend MySQL + Prisma.
 */
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import type { MatchResult, MatchResultStatus, ScheduleStatus, TournamentCatalogType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { appendAudit } from '../services/auditAppend.js';
import { validateGroupPhaseConfirm, loadEliminationWarningForReopen } from '../services/groupPhaseConfirm.js';
import { replaceEliminationMatchesFromBracket } from '../services/createEliminationKnockoutMatches.js';
import {
  applyKnockoutAfterMatchResultInTx,
  assertKoPayloadParseableForMatch,
  BadRequestKoError,
  isKnockoutEliminationMatch,
  KnockoutEditBlockedError,
} from '../services/knockoutAdvanceFromMatchResult.js';
import { recalculateRankings } from '../services/recalculateRankings.js';
import { assertPreclasificacionForWrite } from '../services/tournamentPreclasificacionJson.js';
import {
  assertScheduleAllowsPlayedNormalResult,
  ScheduleRequiredForPlayedError,
} from '../services/scheduleGuardForMatchResult.js';

export const adminApiRouter = Router();

/** GET /match-results — lista para hidratar la UI (opcional ?tournamentId=). */
adminApiRouter.get('/match-results', async (req, res, next) => {
  try {
    const tid = typeof req.query.tournamentId === 'string' ? req.query.tournamentId.trim() : '';
    const rows = await prisma.matchResult.findMany({
      where: tid ? { tournamentId: tid } : undefined,
      orderBy: [{ tournamentId: 'asc' }, { updatedAt: 'desc' }],
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** POST /match-results/delete — body `{ dedupeKey }`. */
adminApiRouter.post('/match-results/delete', async (req, res, next) => {
  try {
    const dedupeKey = String((req.body as { dedupeKey?: string }).dedupeKey ?? '').trim();
    if (!dedupeKey) {
      res.status(400).json({ error: 'dedupeKey requerido' });
      return;
    }
    const r = await prisma.matchResult.deleteMany({ where: { dedupeKey } });
    await appendAudit(prisma, {
      action: 'match_result_delete',
      entityType: 'MatchResult',
      entityId: dedupeKey,
      payload: { deleted: r.count },
    });
    await recalculateRankings(prisma);
    res.json({ ok: true, deleted: r.count });
  } catch (e) {
    next(e);
  }
});

function mapResultStatus(raw: string | undefined): MatchResultStatus {
  const s = (raw ?? 'pending').toLowerCase();
  if (s === 'played') return 'played';
  if (s === 'walkover') return 'walkover';
  if (s === 'retired') return 'retired';
  if (s === 'suspended') return 'suspended';
  return 'pending';
}

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

/** GET /tournaments/:id/matches */
adminApiRouter.get('/tournaments/:id/matches', async (req, res, next) => {
  try {
    const rows = await prisma.match.findMany({
      where: { tournamentId: req.params.id },
      orderBy: [{ scheduledDate: 'asc' }, { roundLabel: 'asc' }],
      include: { player1: true, player2: true, winner: true, loser: true },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** GET /tournaments/:id — metadatos del torneo (preclasificación JSON, plantilla, etc.). */
adminApiRouter.get('/tournaments/:id', async (req, res, next) => {
  try {
    const row = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        slug: true,
        name: true,
        tournamentType: true,
        status: true,
        startDate: true,
        endDate: true,
        location: true,
        coverImage: true,
        slotsTotal: true,
        slotsTaken: true,
        ligaDoc: true,
        preclasificacionJson: true,
        winnerId: true,
        finalistId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) {
      res.status(404).json({ error: 'Torneo no encontrado' });
      return;
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

/** GET /tournaments/:id/leagues — ligas del torneo (estado de fase + eliminación + bracket). */
adminApiRouter.get('/tournaments/:id/leagues', async (req, res, next) => {
  try {
    const rows = await prisma.tournamentLeague.findMany({
      where: { tournamentId: req.params.id },
      orderBy: { leagueNum: 'asc' },
      include: { elimination: true },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** POST | PUT /matches/:id/result — carga resultado confirmado (+ MatchResult dedupe opcional desde body). */
async function upsertMatchResultEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, unknown>;
    const dedupeKey = typeof body.dedupeKey === 'string' ? body.dedupeKey : '';
    const tournamentId = typeof body.tournamentId === 'string' ? body.tournamentId : '';
    if (!dedupeKey.trim() || !tournamentId.trim()) {
      res.status(400).json({ error: 'dedupeKey y tournamentId son obligatorios' });
      return;
    }

    const status = mapResultStatus(typeof body.status === 'string' ? body.status : undefined);
    const payload = {
      dedupeKey: dedupeKey.trim(),
      tournamentId: tournamentId.trim(),
      matchId: typeof body.matchId === 'string' ? body.matchId : undefined,
      groupKey: typeof body.group === 'string' ? body.group : (body.groupKey as string | undefined),
      roundNum: typeof body.round === 'number' ? body.round : (body.roundNum as number | undefined),
      playerA: String(body.playerA ?? ''),
      playerB: String(body.playerB ?? ''),
      score: body.score != null ? String(body.score) : null,
      setsJson: body.setsJson !== undefined ? (body.setsJson as object) : undefined,
      status,
      playedAt:
        typeof body.date === 'string' && body.date.trim()
          ? new Date(body.date.trim().slice(0, 10))
          : null,
    };

    const mid = payload.matchId?.trim();
    const row = await prisma.$transaction(async (tx) => {
      await assertScheduleAllowsPlayedNormalResult(tx, payload.dedupeKey, payload.status, payload.score);
      if (mid) {
        const m = await tx.match.findUnique({
          where: { id: mid },
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
          matchId: payload.matchId,
          groupKey: payload.groupKey ?? null,
          roundNum: payload.roundNum ?? null,
          playerA: payload.playerA,
          playerB: payload.playerB,
          score: payload.score,
          setsJson: payload.setsJson,
          status: payload.status,
          playedAt: payload.playedAt,
        },
        update: {
          matchId: payload.matchId,
          groupKey: payload.groupKey ?? null,
          roundNum: payload.roundNum ?? null,
          playerA: payload.playerA,
          playerB: payload.playerB,
          score: payload.score,
          setsJson: payload.setsJson ?? undefined,
          status: payload.status,
          playedAt: payload.playedAt,
        },
      });
      await applyKnockoutAfterMatchResultInTx(tx, {
        matchResult: r,
        payload: {
          tournamentId: payload.tournamentId,
          matchId: payload.matchId,
          status: payload.status,
          score: payload.score,
          playerA: payload.playerA,
          playerB: payload.playerB,
        },
      });
      return r;
    });

    await appendAudit(prisma, {
      action: 'match_result_upsert',
      entityType: 'MatchResult',
      entityId: row.id,
      tournamentId: payload.tournamentId,
      afterJson: row,
    });

    await recalculateRankings(prisma);

    res.json(row);
  } catch (e) {
    if (e instanceof ScheduleRequiredForPlayedError) {
      res.status(e.statusCode).json({ error: e.message, code: e.code });
      return;
    }
    if (e instanceof KnockoutEditBlockedError) {
      res.status(e.statusCode).json({ error: e.message, code: e.code });
      return;
    }
    if (e instanceof BadRequestKoError) {
      res.status(e.statusCode).json({ error: e.message, code: 'KO_BAD_REQUEST' });
      return;
    }
    next(e);
  }
}

adminApiRouter.post('/matches/:id/result', upsertMatchResultEndpoint);
adminApiRouter.put('/matches/:id/result', upsertMatchResultEndpoint);

function koBulkOrder(body: Record<string, unknown>): number {
  const mid = typeof body.matchId === 'string' ? body.matchId : '';
  const rp = /-rp-(\d+)$/.exec(mid);
  if (rp) return 10 + Number(rp[1]);
  const qf = /-qf-(\d+)$/.exec(mid);
  if (qf) return 100 + Number(qf[1]);
  const sf = /-sf-(\d+)$/.exec(mid);
  if (sf) return 200 + Number(sf[1]);
  if (/-fn-\d+$/.test(mid)) return 300;
  return 1000;
}

/** POST /results/bulk-save */
adminApiRouter.post('/results/bulk-save', async (req, res, next) => {
  try {
    const list = req.body as { results?: Record<string, unknown>[] };
    if (!Array.isArray(list.results) || list.results.length === 0) {
      res.status(400).json({ error: 'results[] requerido' });
      return;
    }
    const sorted = [...list.results].sort((a, b) => koBulkOrder(a) - koBulkOrder(b));
    const out = await prisma.$transaction(async (tx) => {
      const rows: MatchResult[] = [];
      for (const body of sorted) {
        const dedupeKey = String(body.dedupeKey ?? '');
        const tournamentId = String(body.tournamentId ?? '');
        const status = mapResultStatus(typeof body.status === 'string' ? body.status : undefined);
        const mid = typeof body.matchId === 'string' ? body.matchId.trim() : '';
        const scoreStr = body.score != null ? String(body.score) : null;
        await assertScheduleAllowsPlayedNormalResult(tx, dedupeKey, status, scoreStr);
        if (mid) {
          const m = await tx.match.findUnique({
            where: { id: mid },
            include: { player1: true, player2: true },
          });
          if (m && isKnockoutEliminationMatch(m)) {
            assertKoPayloadParseableForMatch(m, {
              status,
              score: scoreStr,
            });
          }
        }
        const r = await tx.matchResult.upsert({
          where: { dedupeKey },
          create: {
            dedupeKey,
            tournamentId,
            matchId: typeof body.matchId === 'string' ? body.matchId : undefined,
            groupKey: typeof body.group === 'string' ? body.group : undefined,
            roundNum: typeof body.round === 'number' ? body.round : undefined,
            playerA: String(body.playerA ?? ''),
            playerB: String(body.playerB ?? ''),
            score: scoreStr,
            setsJson: body.setsJson !== undefined ? (body.setsJson as object) : undefined,
            status,
            playedAt:
              typeof body.date === 'string' && body.date.trim()
                ? new Date(body.date.trim().slice(0, 10))
                : null,
          },
          update: {
            matchId: typeof body.matchId === 'string' ? body.matchId : undefined,
            groupKey: typeof body.group === 'string' ? body.group : undefined,
            roundNum: typeof body.round === 'number' ? body.round : undefined,
            playerA: String(body.playerA ?? ''),
            playerB: String(body.playerB ?? ''),
            score: scoreStr,
            setsJson: body.setsJson !== undefined ? (body.setsJson as object) : undefined,
            status,
            playedAt:
              typeof body.date === 'string' && body.date.trim()
                ? new Date(body.date.trim().slice(0, 10))
                : null,
          },
        });
        await applyKnockoutAfterMatchResultInTx(tx, {
          matchResult: r,
          payload: {
            tournamentId,
            matchId: typeof body.matchId === 'string' ? body.matchId : undefined,
            status,
            score: scoreStr,
            playerA: String(body.playerA ?? ''),
            playerB: String(body.playerB ?? ''),
          },
        });
        rows.push(r);
      }
      return rows;
    });
    await appendAudit(prisma, {
      action: 'bulk_save_results',
      entityType: 'MatchResult',
      tournamentId:
        typeof list.results[0]?.tournamentId === 'string' ? String(list.results[0].tournamentId) : undefined,
      payload: { count: out.length },
    });
    await recalculateRankings(prisma);
    res.json({ ok: true, count: out.length, ids: out.map((r) => r.id) });
  } catch (e) {
    if (e instanceof ScheduleRequiredForPlayedError) {
      res.status(e.statusCode).json({ error: e.message, code: e.code });
      return;
    }
    if (e instanceof KnockoutEditBlockedError) {
      res.status(e.statusCode).json({ error: e.message, code: e.code });
      return;
    }
    if (e instanceof BadRequestKoError) {
      res.status(e.statusCode).json({ error: e.message, code: 'KO_BAD_REQUEST' });
      return;
    }
    next(e);
  }
});

/** GET /schedules — todas las filas o `?tournamentId=` (mismo patrón que `/match-results`). */
adminApiRouter.get('/schedules', async (req, res, next) => {
  try {
    const tid = typeof req.query.tournamentId === 'string' ? req.query.tournamentId.trim() : '';
    const rows = await prisma.tournamentScheduleEntry.findMany({
      where: tid ? { tournamentId: tid } : undefined,
      orderBy: [{ tournamentId: 'asc' }, { updatedAt: 'desc' }],
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** GET /tournaments/:id/schedules — filas `TournamentScheduleEntry` (fixture / dedupeKey). */
adminApiRouter.get('/tournaments/:id/schedules', async (req, res, next) => {
  try {
    const tid = req.params.id;
    const rows = await prisma.tournamentScheduleEntry.findMany({
      where: { tournamentId: tid },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

function dedupeFromReq(req: Request): string {
  return decodeURIComponent(req.params.id ?? '');
}

/** POST /matches/:id/schedule/postpone — `id` = dedupeKey URL-encoded. */
adminApiRouter.post('/matches/:id/schedule/postpone', async (req, res, next) => {
  try {
    const dedupeKey = dedupeFromReq(req);
    const body = req.body as { note?: string; venue?: string };
    const cur = await prisma.tournamentScheduleEntry.findUnique({ where: { dedupeKey } });
    if (!cur) {
      res.status(404).json({ error: 'Programación no encontrada' });
      return;
    }
    const row = await prisma.tournamentScheduleEntry.update({
      where: { dedupeKey },
      data: {
        scheduleStatus: 'postponed',
        note: body.note ?? cur.note,
        venue: body.venue ?? cur.venue,
      },
    });
    await appendAudit(prisma, {
      action: 'schedule_postponed',
      entityType: 'TournamentScheduleEntry',
      entityId: dedupeKey,
      tournamentId: row.tournamentId,
      afterJson: row,
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

/** POST /matches/:id/schedule/cancel */
adminApiRouter.post('/matches/:id/schedule/cancel', async (req, res, next) => {
  try {
    const dedupeKey = dedupeFromReq(req);
    const cur = await prisma.tournamentScheduleEntry.findUnique({ where: { dedupeKey } });
    if (!cur) {
      res.status(404).json({ error: 'Programación no encontrada' });
      return;
    }
    const row = await prisma.tournamentScheduleEntry.update({
      where: { dedupeKey },
      data: { scheduleStatus: 'cancelled' },
    });
    await appendAudit(prisma, {
      action: 'schedule_cancelled',
      entityType: 'TournamentScheduleEntry',
      entityId: dedupeKey,
      tournamentId: row.tournamentId,
      afterJson: row,
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

/** POST | PUT /matches/:id/schedule — `id` = dedupeKey; body incluye `tournamentId`, `leagueNum`. */
async function saveSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const dedupeKey = dedupeFromReq(req);
    const body = req.body as Record<string, unknown>;
    const tournamentId = String(body.tournamentId ?? '');
    const leagueNum = Number(body.leagueNum);
    if (!dedupeKey || !tournamentId || !Number.isFinite(leagueNum)) {
      res.status(400).json({ error: 'dedupeKey (en URL), tournamentId y leagueNum son obligatorios' });
      return;
    }
    const scheduleStatus = mapScheduleStatus(typeof body.scheduleStatus === 'string' ? body.scheduleStatus : undefined);
    const date = typeof body.date === 'string' ? body.date.slice(0, 32) : null;
    const time = typeof body.time === 'string' ? body.time.slice(0, 32) : null;
    const venue =
      typeof body.venue === 'string'
        ? body.venue.slice(0, 256)
        : typeof body.scheduledCourt === 'string'
          ? String(body.scheduledCourt).slice(0, 256)
          : null;
    const note = typeof body.note === 'string' ? body.note : null;
    const confirmedAt = typeof body.confirmedAt === 'number' ? Math.floor(body.confirmedAt) : null;

    const row = await prisma.tournamentScheduleEntry.upsert({
      where: { dedupeKey },
      create: {
        dedupeKey,
        tournamentId,
        leagueNum,
        scheduleStatus,
        date,
        time,
        venue,
        note,
        confirmedAt,
      },
      update: {
        scheduleStatus,
        date,
        time,
        venue,
        note,
        ...(confirmedAt != null ? { confirmedAt } : {}),
      },
    });
    await appendAudit(prisma, {
      action: 'match_schedule_save',
      entityType: 'TournamentScheduleEntry',
      entityId: dedupeKey,
      tournamentId: row.tournamentId,
      afterJson: row,
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
}

adminApiRouter.post('/matches/:id/schedule', saveSchedule);
adminApiRouter.put('/matches/:id/schedule', saveSchedule);

/** DELETE /matches/:id/schedule — `id` = dedupeKey; elimina la fila de agenda. */
adminApiRouter.delete('/matches/:id/schedule', async (req, res, next) => {
  try {
    const dedupeKey = dedupeFromReq(req);
    const r = await prisma.tournamentScheduleEntry.deleteMany({ where: { dedupeKey } });
    await appendAudit(prisma, {
      action: 'schedule_deleted',
      entityType: 'TournamentScheduleEntry',
      entityId: dedupeKey,
      payload: { deleted: r.count },
    });
    res.json({ ok: true, deleted: r.count });
  } catch (e) {
    next(e);
  }
});

/** POST /tournaments/:id/schedules/confirm — body opcional `{ keys?: string[] }` (dedupeKeys). */
adminApiRouter.post('/tournaments/:id/schedules/confirm', async (req, res, next) => {
  try {
    const tid = req.params.id;
    const body = (req.body ?? {}) as { keys?: string[] };
    const now = Date.now();
    let total = 0;
    async function confirmOneRow(dedupeKey: string): Promise<boolean> {
      const cur = await prisma.tournamentScheduleEntry.findUnique({ where: { dedupeKey } });
      if (!cur || cur.tournamentId !== tid) return false;
      if (cur.scheduleStatus !== 'scheduled') return false;
      const d = cur.date?.trim() ?? '';
      const t = cur.time?.trim() ?? '';
      if (!d || !t) return false;
      const hadPublicConfirmation = cur.confirmedAt != null;
      const nextStatus = hadPublicConfirmation ? 'rescheduled' : 'confirmed';
      await prisma.tournamentScheduleEntry.update({
        where: { dedupeKey },
        data: { scheduleStatus: nextStatus, confirmedAt: now },
      });
      return true;
    }
    if (Array.isArray(body.keys)) {
      for (const k of body.keys) {
        if (await confirmOneRow(k)) total += 1;
      }
    } else {
      const pending = await prisma.tournamentScheduleEntry.findMany({
        where: {
          tournamentId: tid,
          scheduleStatus: 'scheduled',
        },
      });
      for (const row of pending) {
        const d = row.date?.trim() ?? '';
        const t = row.time?.trim() ?? '';
        if (!d || !t) continue;
        if (await confirmOneRow(row.dedupeKey)) total += 1;
      }
    }
    await appendAudit(prisma, {
      action: 'schedules_confirmed',
      entityType: 'Tournament',
      entityId: tid,
      tournamentId: tid,
      payload: { count: total },
    });
    res.json({ ok: true, updatedCount: total });
  } catch (e) {
    next(e);
  }
});

/** Confirmar resultados grupos — valida pendientes, marca liga y habilita eliminación (`ready`). */
adminApiRouter.post('/tournament-leagues/:lid/confirm-results', async (req, res, next) => {
  try {
    const lid = req.params.lid;
    const league = await prisma.tournamentLeague.findUnique({ where: { id: lid } });
    if (!league) {
      res.status(404).json({ error: 'Liga no encontrada' });
      return;
    }
    const val = await validateGroupPhaseConfirm(prisma, league.tournamentId);
    if (!val.ok) {
      res.status(400).json({ error: val.error });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const elimWas =
      league.eliminationStatus == null ||
      league.eliminationStatus === '' ||
      league.eliminationStatus === 'unavailable';
    const nextElim = elimWas ? 'ready' : league.eliminationStatus;
    const updated = await prisma.tournamentLeague.update({
      where: { id: lid },
      data: { groupStageStatus: 'confirmed', eliminationStatus: nextElim },
    });
    await appendAudit(prisma, {
      action: 'confirm_group_results',
      entityType: 'TournamentLeague',
      entityId: lid,
      tournamentId: league.tournamentId,
      league: String(league.leagueNum),
      afterJson: updated,
      payload: {
        summary: {
          directCount: body.directCount,
          repechajeCount: body.repechajeCount,
          eliminatedCount: body.eliminatedCount,
          groupCount: body.groupCount,
          played: body.played,
        },
        note: 'Tabla/clasificados materializados en cliente; servidor valida pendientes y estado de liga.',
      },
    });
    await recalculateRankings(prisma);
    res.json({ ok: true, league: updated });
  } catch (e) {
    next(e);
  }
});

adminApiRouter.post('/tournament-leagues/:lid/reopen-results', async (req, res, next) => {
  try {
    const lid = req.params.lid;
    const league = await prisma.tournamentLeague.findUnique({ where: { id: lid } });
    if (!league) {
      res.status(404).json({ error: 'Liga no encontrada' });
      return;
    }
    const warning = await loadEliminationWarningForReopen(prisma, lid);
    const updated = await prisma.tournamentLeague.update({
      where: { id: lid },
      data: { groupStageStatus: 'reopened' },
    });
    await appendAudit(prisma, {
      action: 'reopen_group_results',
      entityType: 'TournamentLeague',
      entityId: lid,
      tournamentId: league.tournamentId,
      league: String(league.leagueNum),
      afterJson: updated,
      payload: warning ? { warning } : undefined,
    });
    await recalculateRankings(prisma);
    res.json({ ok: true, league: updated, warning });
  } catch (e) {
    next(e);
  }
});

/** PUT /tournament-leagues/:id/elimination-status — actualizar máquina de estados KO (admin avanzado / jobs). */
adminApiRouter.put('/tournament-leagues/:lid/elimination-status', async (req, res, next) => {
  try {
    const lid = req.params.lid;
    const status = String((req.body as { status?: string }).status ?? '').trim();
    if (!status) {
      res.status(400).json({ error: 'status requerido' });
      return;
    }
    const league = await prisma.tournamentLeague.findUnique({ where: { id: lid } });
    if (!league) {
      res.status(404).json({ error: 'Liga no encontrada' });
      return;
    }
    const updated = await prisma.tournamentLeague.update({
      where: { id: lid },
      data: { eliminationStatus: status },
    });
    await appendAudit(prisma, {
      action: 'elimination_status_update',
      entityType: 'TournamentLeague',
      entityId: lid,
      tournamentId: league.tournamentId,
      league: String(league.leagueNum),
      afterJson: updated,
      payload: { status },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/** GET /tournament-leagues/:id/elimination — bracket + liga. */
adminApiRouter.get('/tournament-leagues/:lid/elimination', async (req, res, next) => {
  try {
    const lid = req.params.lid;
    const league = await prisma.tournamentLeague.findUnique({
      where: { id: lid },
      include: { elimination: true },
    });
    if (!league) {
      res.status(404).json({ error: 'Liga no encontrada' });
      return;
    }
    res.json({ league, bracket: league.elimination });
  } catch (e) {
    next(e);
  }
});

/** Eliminación */
adminApiRouter.post('/tournament-leagues/:lid/elimination/generate', async (req, res, next) => {
  try {
    const bracketJson = (req.body as { bracket?: unknown }).bracket ?? {};
    const lid = req.params.lid;
    const league = await prisma.tournamentLeague.findUnique({ where: { id: lid } });
    if (!league) {
      res.status(404).json({ error: 'Liga no encontrada' });
      return;
    }
    if (league.groupStageStatus !== 'confirmed') {
      res.status(400).json({ error: 'Confirmá primero los resultados de fase de grupos.' });
      return;
    }
    const row = await prisma.eliminationBracket.upsert({
      where: { tournamentLeagueId: lid },
      create: {
        tournamentLeagueId: lid,
        status: 'draft',
        bracketJson: bracketJson as object,
      },
      update: { bracketJson: bracketJson as object, status: 'draft' },
    });
    await prisma.tournamentLeague.update({
      where: { id: lid },
      data: { eliminationStatus: 'draft' },
    });
    await appendAudit(prisma, {
      action: 'elimination_generate',
      entityType: 'EliminationBracket',
      entityId: row.id,
      tournamentId: league.tournamentId,
      league: String(league.leagueNum),
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

adminApiRouter.put('/tournament-leagues/:lid/elimination', async (req, res, next) => {
  try {
    const lid = req.params.lid;
    const bracketJson = (req.body as { bracket?: unknown }).bracket ?? {};
    const league = await prisma.tournamentLeague.findUnique({ where: { id: lid } });
    if (!league) {
      res.status(404).json({ error: 'Liga no encontrada' });
      return;
    }
    const row = await prisma.eliminationBracket.upsert({
      where: { tournamentLeagueId: lid },
      create: { tournamentLeagueId: lid, status: 'draft', bracketJson: bracketJson as object },
      update: { bracketJson: bracketJson as object },
    });
    await prisma.tournamentLeague.update({
      where: { id: lid },
      data: { eliminationStatus: 'draft' },
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

adminApiRouter.post('/tournament-leagues/:lid/elimination/confirm', async (req, res, next) => {
  try {
    const lid = req.params.lid;
    const league = await prisma.tournamentLeague.findUnique({
      where: { id: lid },
      include: { elimination: true },
    });
    if (!league?.elimination) {
      res.status(400).json({ error: 'No hay cuadro de eliminación en borrador para confirmar.' });
      return;
    }
    const created = await replaceEliminationMatchesFromBracket(prisma, lid, league.elimination.bracketJson);
    if (!created.ok) {
      res.status(400).json({ error: created.error });
      return;
    }
    await prisma.eliminationBracket.update({
      where: { tournamentLeagueId: lid },
      data: { status: 'confirmed' },
    });
    const updatedLeague = await prisma.tournamentLeague.update({
      where: { id: lid },
      data: { eliminationStatus: 'confirmed' },
    });
    await appendAudit(prisma, {
      action: 'elimination_confirmed',
      entityType: 'TournamentLeague',
      entityId: lid,
      tournamentId: league.tournamentId,
      league: String(league.leagueNum),
      payload: { matchesCreated: created.created },
    });
    await recalculateRankings(prisma);
    res.json({ ok: true, league: updatedLeague, matchesCreated: created.created });
  } catch (e) {
    next(e);
  }
});

/** PATCH /tournaments/:id — metadata: `tournamentType` y/o `preclasificacion` (snapshot JSON o `null` para borrar). */
adminApiRouter.patch('/tournaments/:id', async (req, res, next) => {
  try {
    const tid = req.params.id;
    const body = req.body as { tournamentType?: string; preclasificacion?: unknown | null };
    const data: Prisma.TournamentUpdateInput = {};

    if (body.tournamentType !== undefined) {
      const tt = body.tournamentType;
      if (tt !== 'greek500' && tt !== 'masters1000') {
        res.status(400).json({ error: 'tournamentType debe ser greek500 o masters1000' });
        return;
      }
      data.tournamentType = tt as TournamentCatalogType;
    }

    if ('preclasificacion' in body) {
      const p = body.preclasificacion;
      if (p === null) {
        data.preclasificacionJson = Prisma.DbNull;
      } else {
        try {
          data.preclasificacionJson = assertPreclasificacionForWrite(p);
        } catch (err) {
          res.status(400).json({ error: err instanceof Error ? err.message : 'preclasificacion inválida' });
          return;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'Enviá tournamentType y/o preclasificacion' });
      return;
    }

    const row = await prisma.tournament.update({
      where: { id: tid },
      data,
    });
    await appendAudit(prisma, {
      action: 'tournament_patch',
      entityType: 'Tournament',
      entityId: tid,
      tournamentId: tid,
      afterJson: row as unknown as Record<string, unknown>,
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

/** POST /tournaments/:id/finalize */
adminApiRouter.post('/tournaments/:id/finalize', async (req, res, next) => {
  try {
    const tid = req.params.id;
    const body = req.body as { championId?: string; finalistId?: string };
    const row = await prisma.tournament.update({
      where: { id: tid },
      data: {
        status: 'finished',
        winnerId: typeof body.championId === 'string' ? body.championId : undefined,
        finalistId: typeof body.finalistId === 'string' ? body.finalistId : undefined,
      },
    });
    await appendAudit(prisma, {
      action: 'finalize_tournament',
      entityType: 'Tournament',
      entityId: tid,
      tournamentId: tid,
      afterJson: row,
    });
    await recalculateRankings(prisma);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

/** POST /tournaments/:id/recalculate — recalcula ranking global (`LeagueRankingRow` + snapshot). */
adminApiRouter.post('/tournaments/:id/recalculate', async (req, res, next) => {
  try {
    const tid = req.params.id;
    const t = await prisma.tournament.findUnique({
      where: { id: tid },
      include: { leagues: true },
    });
    if (!t) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    const rk = await recalculateRankings(prisma);
    await appendAudit(prisma, {
      action: 'recalculate',
      entityType: 'Tournament',
      entityId: tid,
      tournamentId: tid,
      payload: rk,
    });
    res.json({
      ok: true,
      ...rk,
      note: 'Ranking de ligas recalculado desde MySQL (partidos + resultados).',
    });
  } catch (e) {
    next(e);
  }
});

/** GET /tournaments/:id/audit */
adminApiRouter.get('/tournaments/:id/audit', async (req, res, next) => {
  try {
    const tid = req.params.id;
    const take = Math.min(Number(req.query.limit) || 100, 500);
    const rows = await prisma.auditLog.findMany({
      where: { tournamentId: tid },
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});
