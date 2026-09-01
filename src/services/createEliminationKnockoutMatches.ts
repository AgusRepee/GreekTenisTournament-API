import type { MatchStage, PrismaClient } from '@prisma/client';
import { isRepechageWaitPlayerId, repechageWaitPlayerId } from './koRepechagePlaceholders.js';
import { resolveEliminationPlayerId } from './resolveEliminationPlayerId.js';

type Cross = { id?: string; slotA?: string | null; slotB?: string | null };

function parseBracketJson(raw: unknown): { preliminary: Cross[]; quarter: Cross[] } {
  if (!raw || typeof raw !== 'object') return { preliminary: [], quarter: [] };
  const o = raw as Record<string, unknown>;
  const pre = Array.isArray(o.preliminary) ? (o.preliminary as Cross[]) : [];
  const q = Array.isArray(o.quarter) ? (o.quarter as Cross[]) : [];
  return { preliminary: pre, quarter: q };
}

async function assertPlayerIds(
  prisma: PrismaClient,
  ids: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const uniq = [...new Set(ids.filter(Boolean))].filter((id) => !isRepechageWaitPlayerId(id) && !id.startsWith('sys-ko-'));
  if (uniq.length === 0) return { ok: true };
  const found = await prisma.player.findMany({ where: { id: { in: uniq } }, select: { id: true } });
  const foundSet = new Set(found.map((p) => p.id));
  const missing = uniq.filter((id) => !foundSet.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Algún id de jugador en el cuadro no existe en la base (verificá el roster): ${missing.join(', ')}`,
    };
  }
  return { ok: true };
}

/** Cupos WAIT_RP_n requieren filas `sys-ko-wait-rp-*` (migración 20260602120000). */
async function assertRepechageWaitPlaceholders(
  prisma: PrismaClient,
  crosses: Cross[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tokens = new Set<number>();
  for (const c of crosses) {
    for (const raw of [c.slotA, c.slotB]) {
      const s = String(raw ?? '').trim();
      const m = /^WAIT_RP_(\d+)$/i.exec(s);
      if (m) tokens.add(Number(m[1]));
    }
  }
  if (tokens.size === 0) return { ok: true };
  const waitIds = [...tokens].map((i) => repechageWaitPlayerId(i));
  const found = await prisma.player.count({ where: { id: { in: waitIds } } });
  if (found !== waitIds.length) {
    return {
      ok: false,
      error:
        'Faltan cupos de repechaje en la base (sys-ko-wait-rp-*). Aplicá migraciones Prisma en el servidor e intentá de nuevo.',
    };
  }
  return { ok: true };
}

async function assertKoShellPlaceholders(prisma: PrismaClient): Promise<{ ok: true } | { ok: false; error: string }> {
  const shellIds = ['sys-ko-sf1a', 'sys-ko-sf1b', 'sys-ko-sf2a', 'sys-ko-sf2b', 'sys-ko-fa', 'sys-ko-fb'];
  const found = await prisma.player.count({ where: { id: { in: shellIds } } });
  if (found !== shellIds.length) {
    return {
      ok: false,
      error: 'Faltan jugadores TBD del cuadro KO (sys-ko-sf*, sys-ko-f*). Aplicá migraciones Prisma en el servidor.',
    };
  }
  return { ok: true };
}

async function resolveCrosses(
  prisma: PrismaClient,
  crosses: Cross[],
): Promise<{ ok: true; crosses: Cross[] } | { ok: false; error: string }> {
  const out: Cross[] = [];
  for (const c of crosses) {
    let slotA: string | null = c.slotA != null ? String(c.slotA) : null;
    let slotB: string | null = c.slotB != null ? String(c.slotB) : null;
    if (slotA) {
      const resolved = await resolveEliminationPlayerId(prisma, slotA);
      if (!resolved) {
        return { ok: false, error: `Jugador no encontrado en la base (verificá el roster): ${slotA}` };
      }
      slotA = resolved;
    }
    if (slotB) {
      const resolved = await resolveEliminationPlayerId(prisma, slotB);
      if (!resolved) {
        return { ok: false, error: `Jugador no encontrado en la base (verificá el roster): ${slotB}` };
      }
      slotB = resolved;
    }
    out.push({ ...c, slotA, slotB });
  }
  return { ok: true, crosses: out };
}

/**
 * Crea filas `Match` de eliminación (repechaje + cuartos + semis + final) a partir del JSON guardado en `EliminationBracket`.
 * Requiere jugadores placeholder `sys-ko-*` (migración `20260510120000_ko_placeholder_players`).
 */
export async function replaceEliminationMatchesFromBracket(
  prisma: PrismaClient,
  tournamentLeagueId: string,
  bracketJson: unknown,
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const league = await prisma.tournamentLeague.findUnique({ where: { id: tournamentLeagueId } });
  if (!league) return { ok: false, error: 'Liga no encontrada.' };

  const { preliminary, quarter } = parseBracketJson(bracketJson);
  if (quarter.length !== 4) {
    return { ok: false, error: 'Se esperaban exactamente 4 cruces de cuartos.' };
  }

  const waitCheck = await assertRepechageWaitPlaceholders(prisma, [...preliminary, ...quarter]);
  if (!waitCheck.ok) return waitCheck;

  const preResolved = await resolveCrosses(prisma, preliminary);
  if (!preResolved.ok) return preResolved;
  const quarterResolved = await resolveCrosses(prisma, quarter);
  if (!quarterResolved.ok) return quarterResolved;

  const preliminaryResolved = preResolved.crosses;
  const quarterFinal = quarterResolved.crosses;

  const tid = league.tournamentId;
  const prefix = `ko-${tid}-`;

  const toValidate: string[] = [];
  for (const c of preliminaryResolved) {
    if (c.slotA) toValidate.push(String(c.slotA));
    if (c.slotB) toValidate.push(String(c.slotB));
  }
  for (const c of quarterFinal) {
    const a = c.slotA != null ? String(c.slotA) : '';
    const b = c.slotB != null ? String(c.slotB) : '';
    if (!a || !b) return { ok: false, error: 'Completá los 4 cruces de cuartos antes de confirmar.' };
    toValidate.push(a, b);
  }

  const v = await assertPlayerIds(prisma, toValidate);
  if (!v.ok) return v;

  const shellCheck = await assertKoShellPlaceholders(prisma);
  if (!shellCheck.ok) return shellCheck;

  const rows: Array<{
    id: string;
    tournamentId: string;
    tournamentLeagueId: string;
    stage: MatchStage;
    roundLabel: string;
    player1Id: string;
    player2Id: string;
  }> = [];

  preliminaryResolved.forEach((c, i) => {
    const a = c.slotA != null ? String(c.slotA) : '';
    const b = c.slotB != null ? String(c.slotB) : '';
    if (!a || !b) return;
    rows.push({
      id: `${prefix}rp-${i}`,
      tournamentId: tid,
      tournamentLeagueId,
      stage: 'repechage',
      roundLabel: 'Repechaje',
      player1Id: a,
      player2Id: b,
    });
  });

  quarterFinal.forEach((c, i) => {
    rows.push({
      id: `${prefix}qf-${i}`,
      tournamentId: tid,
      tournamentLeagueId,
      stage: 'quarterfinal',
      roundLabel: 'Cuartos de final',
      player1Id: String(c.slotA),
      player2Id: String(c.slotB),
    });
  });

  rows.push(
    {
      id: `${prefix}sf-0`,
      tournamentId: tid,
      tournamentLeagueId,
      stage: 'semifinal',
      roundLabel: 'Semifinales',
      player1Id: 'sys-ko-sf1a',
      player2Id: 'sys-ko-sf1b',
    },
    {
      id: `${prefix}sf-1`,
      tournamentId: tid,
      tournamentLeagueId,
      stage: 'semifinal',
      roundLabel: 'Semifinales',
      player1Id: 'sys-ko-sf2a',
      player2Id: 'sys-ko-sf2b',
    },
    {
      id: `${prefix}fn-0`,
      tournamentId: tid,
      tournamentLeagueId,
      stage: 'final',
      roundLabel: 'Final',
      player1Id: 'sys-ko-fa',
      player2Id: 'sys-ko-fb',
    },
  );

  await prisma.$transaction(async (tx) => {
    // Solo partidos KO de este torneo (prefijo ko-{tid}-). No tocar fixture de grupos.
    await tx.match.deleteMany({ where: { id: { startsWith: prefix } } });
    for (const r of rows) {
      await tx.match.create({
        data: {
          id: r.id,
          tournamentId: r.tournamentId,
          tournamentLeagueId: r.tournamentLeagueId,
          groupId: null,
          stage: r.stage,
          roundLabel: r.roundLabel,
          player1Id: r.player1Id,
          player2Id: r.player2Id,
          score: '',
          scheduleStatus: 'unscheduled',
          completed: false,
        },
      });
    }
  });

  return { ok: true, created: rows.length };
}
