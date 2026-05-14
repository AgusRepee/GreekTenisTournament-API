import type { Match, MatchResult, MatchResultStatus, MatchStage, Prisma } from '@prisma/client';
import { parseKoPlayedScoreWinner } from './koScoreParse.js';

const KO_STAGES: MatchStage[] = ['quarterfinal', 'semifinal', 'final', 'repechage'];

const TERMINAL: MatchResultStatus[] = ['played', 'walkover', 'retired'];

export class KnockoutEditBlockedError extends Error {
  readonly statusCode = 409;
  readonly code = 'KO_EDIT_BLOCKED';
  constructor() {
    super(
      'Este resultado tiene rondas posteriores cargadas. Reabrí la eliminación o eliminá resultados posteriores antes de modificarlo.',
    );
    this.name = 'KnockoutEditBlockedError';
  }
}

export class BadRequestKoError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestKoError';
  }
}

export type KoOutcome =
  | { kind: 'non_terminal' }
  | {
      kind: 'terminal';
      winnerId: string;
      loserId: string;
      scoreLine: string;
      status: MatchResultStatus;
    };

export function isKnockoutEliminationMatch(m: {
  tournamentLeagueId: string | null;
  stage: MatchStage;
  roundLabel: string | null;
}): boolean {
  if (!m.tournamentLeagueId) return false;
  if (KO_STAGES.includes(m.stage)) return true;
  const rl = (m.roundLabel ?? '').toLowerCase();
  return /\b(repechaje|octavos|cuartos|semifinal|final)\b/i.test(rl);
}

export function koAdvanceTarget(
  matchId: string,
  tournamentId: string,
): { nextMatchId: string; playerField: 'player1Id' | 'player2Id' } | null {
  const pref = `ko-${tournamentId}-`;
  if (!matchId.startsWith(pref)) return null;
  const rest = matchId.slice(pref.length);
  if (rest.startsWith('qf-')) {
    const i = Number(rest.slice(3));
    if (!Number.isFinite(i) || i < 0 || i > 3) return null;
    if (i <= 1) return { nextMatchId: `${pref}sf-0`, playerField: i === 0 ? 'player1Id' : 'player2Id' };
    return { nextMatchId: `${pref}sf-1`, playerField: i === 2 ? 'player1Id' : 'player2Id' };
  }
  if (rest.startsWith('sf-')) {
    const i = Number(rest.slice(3));
    if (i !== 0 && i !== 1) return null;
    return { nextMatchId: `${pref}fn-0`, playerField: i === 0 ? 'player1Id' : 'player2Id' };
  }
  return null;
}

/** Partidos KO que pueden verse afectados al editar `matchId` (para bloqueo de dependencias). */
export function koDownstreamMatchIds(matchId: string, tournamentId: string): string[] {
  const pref = `ko-${tournamentId}-`;
  if (!matchId.startsWith(pref)) return [];
  const rest = matchId.slice(pref.length);
  const s = new Set<string>();
  if (rest.startsWith('qf-')) {
    const i = Number(rest.slice(3));
    if (i <= 1) s.add(`${pref}sf-0`);
    else if (i >= 2 && i <= 3) s.add(`${pref}sf-1`);
    s.add(`${pref}fn-0`);
  } else if (rest.startsWith('sf-')) {
    s.add(`${pref}fn-0`);
  }
  return [...s];
}

async function downstreamHasTerminalKoResult(
  tx: Prisma.TransactionClient,
  downstreamIds: string[],
): Promise<boolean> {
  if (downstreamIds.length === 0) return false;
  const matches = await tx.match.findMany({
    where: { id: { in: downstreamIds } },
    select: { id: true, winnerId: true, completed: true },
  });
  for (const m of matches) {
    if (m.winnerId || m.completed) return true;
  }
  const results = await tx.matchResult.findMany({
    where: { matchId: { in: downstreamIds }, status: { in: TERMINAL } },
    select: { id: true },
    take: 1,
  });
  return results.length > 0;
}

export function computeKoOutcome(
  match: Match & { player1: { id: string; name: string }; player2: { id: string; name: string } },
  payload: { status: MatchResultStatus; score: string | null },
): KoOutcome {
  if (payload.status === 'pending') return { kind: 'non_terminal' };
  if (payload.status === 'suspended') return { kind: 'non_terminal' };

  if (payload.status === 'walkover') {
    const s = (payload.score ?? '').trim().toUpperCase();
    const winnerId = s === 'B' ? match.player2.id : match.player1.id;
    const loserId = winnerId === match.player1.id ? match.player2.id : match.player1.id;
    return {
      kind: 'terminal',
      winnerId,
      loserId,
      scoreLine: (payload.score ?? '').trim(),
      status: 'walkover',
    };
  }

  if (payload.status === 'played') {
    const parsed = parseKoPlayedScoreWinner(payload.score ?? '', false);
    if (!parsed.ok) throw new BadRequestKoError(parsed.error);
    const winnerId = parsed.winner === 'A' ? match.player1.id : match.player2.id;
    const loserId = parsed.winner === 'A' ? match.player2.id : match.player1.id;
    return {
      kind: 'terminal',
      winnerId,
      loserId,
      scoreLine: (payload.score ?? '').trim(),
      status: 'played',
    };
  }

  if (payload.status === 'retired') {
    const parsed = parseKoPlayedScoreWinner(payload.score ?? '', true);
    if (!parsed.ok) throw new BadRequestKoError(parsed.error);
    const winnerId = parsed.winner === 'A' ? match.player1.id : match.player2.id;
    const loserId = parsed.winner === 'A' ? match.player2.id : match.player1.id;
    return {
      kind: 'terminal',
      winnerId,
      loserId,
      scoreLine: (payload.score ?? '').trim(),
      status: 'retired',
    };
  }

  return { kind: 'non_terminal' };
}

/** Expuesto para tests: edición que altera ganador o anula resultado en un partido ya cerrado. */
export function isMaterialKoEdit(match: Match, preview: KoOutcome): boolean {
  const had = Boolean(match.completed && match.winnerId);
  if (!had) return false;
  if (preview.kind === 'non_terminal') return true;
  if (preview.kind !== 'terminal') return false;
  return preview.winnerId !== match.winnerId;
}

type AuditDb = { auditLog: Prisma.TransactionClient['auditLog'] };

async function auditKo(db: AuditDb, e: {
  action: string;
  entityType: string;
  entityId?: string | null;
  tournamentId?: string | null;
  league?: string | null;
  payload?: unknown;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      action: e.action,
      entity: e.entityType,
      entityId: e.entityId ?? undefined,
      tournamentId: e.tournamentId ?? undefined,
      league: e.league ?? undefined,
      payload: e.payload === undefined ? undefined : (e.payload as Prisma.InputJsonValue),
    },
  });
}

/**
 * Tras persistir `MatchResult`, actualiza `Match`, avance a siguiente ronda, estado de eliminación,
 * campeón/finalista en final y espejo mínimo en `bracketJson`. Ejecutar dentro de `prisma.$transaction`.
 */
export async function applyKnockoutAfterMatchResultInTx(
  tx: Prisma.TransactionClient,
  opts: {
    matchResult: MatchResult;
    payload: {
      tournamentId: string;
      matchId?: string;
      status: MatchResultStatus;
      score: string | null;
      playerA: string;
      playerB: string;
    };
  },
): Promise<void> {
  const matchId = opts.matchResult.matchId ?? opts.payload.matchId;
  if (!matchId?.trim()) return;

  const match = await tx.match.findUnique({
    where: { id: matchId },
    include: {
      player1: true,
      player2: true,
      tournamentLeague: true,
    },
  });
  if (!match || !match.tournamentLeagueId || !isKnockoutEliminationMatch(match)) return;

  const leagueNumStr = match.tournamentLeague ? String(match.tournamentLeague.leagueNum) : undefined;

  let preview: KoOutcome;
  try {
    preview = computeKoOutcome(match, opts.payload);
  } catch (e) {
    if (e instanceof BadRequestKoError) throw e;
    throw e;
  }

  const downstream = koDownstreamMatchIds(match.id, match.tournamentId);
  if (isMaterialKoEdit(match, preview)) {
    if (await downstreamHasTerminalKoResult(tx, downstream)) {
      await auditKo(tx, {
        action: 'ko_edit_blocked_downstream',
        entityType: 'Match',
        entityId: match.id,
        tournamentId: match.tournamentId,
        league: leagueNumStr,
        payload: { reason: 'downstream_terminal', downstream },
      });
      throw new KnockoutEditBlockedError();
    }
  }

  if (preview.kind === 'non_terminal') {
    await tx.match.update({
      where: { id: match.id },
      data: {
        winnerId: null,
        loserId: null,
        completed: false,
        score: '',
      },
    });
    await auditKo(tx, {
      action: 'ko_result_cleared',
      entityType: 'Match',
      entityId: match.id,
      tournamentId: match.tournamentId,
      league: leagueNumStr,
      payload: { status: opts.payload.status },
    });
    return;
  }

  await tx.match.update({
    where: { id: match.id },
    data: {
      winnerId: preview.winnerId,
      loserId: preview.loserId,
      score: preview.scoreLine.slice(0, 255),
      completed: true,
    },
  });

  await auditKo(tx, {
    action: 'ko_result_applied',
    entityType: 'Match',
    entityId: match.id,
    tournamentId: match.tournamentId,
    league: leagueNumStr,
    payload: {
      winnerId: preview.winnerId,
      status: preview.status,
      dedupeKey: opts.matchResult.dedupeKey,
    },
  });

  const target = koAdvanceTarget(match.id, match.tournamentId);
  if (target) {
    const next = await tx.match.findUnique({ where: { id: target.nextMatchId } });
    if (next) {
      await tx.match.update({
        where: { id: next.id },
        data: { [target.playerField]: preview.winnerId },
      });
      await auditKo(tx, {
        action: 'ko_winner_advanced',
        entityType: 'Match',
        entityId: next.id,
        tournamentId: match.tournamentId,
        league: leagueNumStr,
        payload: {
          fromMatchId: match.id,
          slot: target.playerField,
          winnerId: preview.winnerId,
        },
      });
    }
  }

  const league = match.tournamentLeague;
  const isFinal = match.stage === 'final' || /\bfinal\b/i.test(match.roundLabel ?? '');
  if (league && !isFinal) {
    const st = league.eliminationStatus ?? '';
    if (st === 'confirmed') {
      await tx.tournamentLeague.update({
        where: { id: league.id },
        data: { eliminationStatus: 'in_progress' },
      });
      await auditKo(tx, {
        action: 'elimination_status_auto',
        entityType: 'TournamentLeague',
        entityId: league.id,
        tournamentId: match.tournamentId,
        league: leagueNumStr,
        payload: { eliminationStatus: 'in_progress', reason: 'first_ko_result' },
      });
    }
  }

  if (isFinal) {
    await tx.tournament.update({
      where: { id: match.tournamentId },
      data: {
        winnerId: preview.winnerId,
        finalistId: preview.loserId,
      },
    });
    if (match.tournamentLeagueId) {
      await tx.tournamentLeague.update({
        where: { id: match.tournamentLeagueId },
        data: { eliminationStatus: 'finished' },
      });
    }
    await auditKo(tx, {
      action: 'ko_champion_defined',
      entityType: 'Tournament',
      entityId: match.tournamentId,
      tournamentId: match.tournamentId,
      league: leagueNumStr,
      payload: { winnerId: preview.winnerId, finalistId: preview.loserId },
    });
    await auditKo(tx, {
      action: 'elimination_status_auto',
      entityType: 'TournamentLeague',
      entityId: match.tournamentLeagueId!,
      tournamentId: match.tournamentId,
      league: leagueNumStr,
      payload: { eliminationStatus: 'finished', reason: 'final_result' },
    });
  } else if (match.stage === 'semifinal') {
    await auditKo(tx, {
      action: 'ko_semifinal_completed',
      entityType: 'Match',
      entityId: match.id,
      tournamentId: match.tournamentId,
      league: leagueNumStr,
      payload: { winnerId: preview.winnerId },
    });
  }

  const eb = await tx.eliminationBracket.findUnique({ where: { tournamentLeagueId: match.tournamentLeagueId } });
  if (eb) {
    const raw = eb.bracketJson;
    const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
    const mirror = (typeof base.serverKoMirror === 'object' && base.serverKoMirror && !Array.isArray(base.serverKoMirror)
      ? { ...(base.serverKoMirror as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    mirror[match.id] = {
      winnerId: preview.winnerId,
      loserId: preview.loserId,
      completed: true,
      updatedAt: new Date().toISOString(),
    };
    base.serverKoMirror = mirror;
    await tx.eliminationBracket.update({
      where: { tournamentLeagueId: match.tournamentLeagueId },
      data: { bracketJson: base as Prisma.InputJsonValue },
    });
  }
}

export function assertKoPayloadParseableForMatch(
  match: Match & { player1: { id: string; name: string }; player2: { id: string; name: string } },
  payload: { status: MatchResultStatus; score: string | null },
): void {
  if (!isKnockoutEliminationMatch(match)) return;
  computeKoOutcome(match, payload);
}
