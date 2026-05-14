import type { MatchStage, PrismaClient } from '@prisma/client';

const WAIT_RP = /^WAIT_RP_\d+$/i;

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
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return { ok: false, error: 'No hay jugadores en los cruces.' };
  const found = await prisma.player.count({ where: { id: { in: uniq } } });
  if (found !== uniq.length) {
    return { ok: false, error: 'Algún id de jugador en el cuadro no existe en la base (verificá el roster).' };
  }
  return { ok: true };
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

  const tid = league.tournamentId;
  const prefix = `ko-${tid}-`;

  const toValidate: string[] = [];
  for (const c of preliminary) {
    if (c.slotA) toValidate.push(String(c.slotA));
    if (c.slotB) toValidate.push(String(c.slotB));
  }
  for (const c of quarter) {
    const a = c.slotA != null ? String(c.slotA) : '';
    const b = c.slotB != null ? String(c.slotB) : '';
    if (!a || !b) return { ok: false, error: 'Completá los 4 cruces de cuartos antes de confirmar.' };
    if (WAIT_RP.test(a) || WAIT_RP.test(b)) {
      return {
        ok: false,
        error:
          'Hay slots pendientes de repechaje (WAIT_RP_*) en cuartos. Resolvé el repechaje en la UI antes de confirmar en servidor.',
      };
    }
    toValidate.push(a, b);
  }

  const v = await assertPlayerIds(prisma, toValidate);
  if (!v.ok) return v;

  const rows: Array<{
    id: string;
    tournamentId: string;
    tournamentLeagueId: string;
    stage: MatchStage;
    roundLabel: string;
    player1Id: string;
    player2Id: string;
  }> = [];

  preliminary.forEach((c, i) => {
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

  quarter.forEach((c, i) => {
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
    await tx.match.deleteMany({ where: { tournamentLeagueId } });
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
