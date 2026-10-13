/**
 * Reemplazo: Rojas L. → Araujo J. en Roger Federer Liga 3 (t-federer-l3).
 * Conserva partidos ya jugados por Rojas L. (p. ej. Del Valle G. vs Rojas L.).
 */
import '../envBootstrap.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recalculateRankings } from '../services/recalculateRankings.js';
import { syncTournamentGroupRosterInTx } from '../services/syncTournamentGroupRoster.js';

const TOURNAMENT_ID = 't-federer-l3';
const LEAGUE_NUM = 3;
const GROUP_KEY = 'C';
const OUT_LABEL = 'Rojas L.';
const IN_LABEL = 'Araujo J.';
const IN_DISPLAY = 'Juan Araujo';
const IN_ID_HINT = 'p-federer-l3-araujo-j';
const OUT_ID_HINT = 'p-federer-l3-rojas-l';

const CORRECT_GROUP_C = ['Ferreres G.', 'Rusel S.', 'Del Valle G.', 'Araujo J.', 'Aguirre W.'] as const;

/** federer-l3-06 (Del Valle vs Rojas r1) no se parchea si ya está jugado. */
const MATCH_PATCHES = [
  { matchId: 'federer-l3-11', group: 'C', round: 2, playerA: 'Araujo J.', playerB: 'Ferreres G.', ballPlayer: 'Araujo J.' },
  { matchId: 'federer-l3-23', group: 'C', round: 4, playerA: 'Rusel S.', playerB: 'Araujo J.', ballPlayer: 'Rusel S.' },
  { matchId: 'federer-l3-30', group: 'C', round: 5, playerA: 'Araujo J.', playerB: 'Aguirre W.', ballPlayer: 'Araujo J.' },
] as const;

function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function playerLabel(p: { name: string; displayName: string | null }): string {
  return (p.displayName || p.name || '').trim();
}

function replaceNameInText(text: string, outLabel: string, innLabel: string): string {
  if (!text) return text;
  const esc = outLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(esc, 'g'), innLabel);
}

function replaceNamesDeep(node: unknown, outLabel: string, innLabel: string): unknown {
  if (typeof node === 'string') return replaceNameInText(node, outLabel, innLabel);
  if (Array.isArray(node)) return node.map((x) => replaceNamesDeep(x, outLabel, innLabel));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = replaceNamesDeep(v, outLabel, innLabel);
    return out;
  }
  return node;
}

function rebuildDedupeKey(oldKey: string, outLabel: string, innLabel: string): string {
  const parts = oldKey.split('|');
  if (parts.length < 5) return oldKey;
  const outN = normName(outLabel);
  const innN = normName(innLabel);
  if (normName(parts[3]!) === outN) parts[3] = innN;
  if (normName(parts[4]!) === outN) parts[4] = innN;
  return parts.join('|');
}

function dedupeKey(group: string, round: number, playerA: string, playerB: string): string {
  return `${TOURNAMENT_ID}|${round}|${group}|${normName(playerA)}|${normName(playerB)}`;
}

function ligaDocAfterReplace(existingGroups: { A: string[]; B: string[]; C: string[] }): Prisma.InputJsonValue {
  return {
    torneo: 'Roger Federer',
    liga: LEAGUE_NUM,
    grupos: { ...existingGroups, C: [...CORRECT_GROUP_C] },
    fechas: [
      {
        numero: 1,
        grupos: {
          A: ['Santi Mat. (P) vs Vito C.', 'Bernardini G. (P) vs Figueroa M.', 'Libre: Komesu F.'],
          B: ['Gadea M. (P) vs Santi Mar.', 'Bianco D. (P) vs Bocchicchio F.', 'Libre: Cordoba G.'],
          C: ['Ferreres G. (P) vs Rusel S.', 'Del Valle G. (P) vs Rojas L.', 'Libre: Aguirre W.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Figueroa M. (P) vs Santi Mat.', 'Bernardini G. (P) vs Komesu F.', 'Libre: Vito C.'],
          B: ['Bocchicchio F. (P) vs Gadea M.', 'Bianco D. (P) vs Cordoba G.', 'Libre: Santi Mar.'],
          C: ['Araujo J. (P) vs Ferreres G.', 'Del Valle G. (P) vs Aguirre W.', 'Libre: Rusel S.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Santi Mat. (P) vs Bernardini G.', 'Komesu F. (P) vs Vito C.', 'Libre: Figueroa M.'],
          B: ['Gadea M. (P) vs Bianco D.', 'Cordoba G. (P) vs Santi Mar.', 'Libre: Bocchicchio F.'],
          C: ['Ferreres G. (P) vs Del Valle G.', 'Aguirre W. (P) vs Rusel S.', 'Libre: Araujo J.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Komesu F. (P) vs Santi Mat.', 'Vito C. (P) vs Figueroa M.', 'Libre: Bernardini G.'],
          B: ['Cordoba G. (P) vs Gadea M.', 'Santi Mar. (P) vs Bocchicchio F.', 'Libre: Bianco D.'],
          C: ['Aguirre W. (P) vs Ferreres G.', 'Rusel S. (P) vs Araujo J.', 'Libre: Del Valle G.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Vito C. (P) vs Bernardini G.', 'Figueroa M. (P) vs Komesu F.', 'Libre: Santi Mat.'],
          B: ['Santi Mar. (P) vs Bianco D.', 'Bocchicchio F. (P) vs Cordoba G.', 'Libre: Gadea M.'],
          C: ['Rusel S. (P) vs Del Valle G.', 'Araujo J. (P) vs Aguirre W.', 'Libre: Ferreres G.'],
        },
      },
    ],
  };
}

async function resolvePlayer(
  labelText: string,
  idHint: string,
  createSpec?: { id: string; shortLabel: string; display: string; category: string },
) {
  const byId = await prisma.player.findUnique({ where: { id: idHint } });
  if (byId) return { player: byId, created: false };

  const all = await prisma.player.findMany({ select: { id: true, name: true, displayName: true } });
  const hit = all.find(
    (p) => normName(p.name) === normName(labelText) || normName(p.displayName ?? '') === normName(labelText),
  );
  if (hit) return { player: hit, created: false };

  if (!createSpec) return { player: null, created: false };

  const player = await prisma.player.upsert({
    where: { id: createSpec.id },
    create: {
      id: createSpec.id,
      name: createSpec.shortLabel,
      displayName: createSpec.display,
      firstName: 'Juan',
      lastName: 'Araujo',
      category: createSpec.category,
      nationality: 'Argentina',
      rosterActive: true,
      profileVisibility: 'active',
    },
    update: {
      name: createSpec.shortLabel,
      displayName: createSpec.display,
      rosterActive: true,
      profileVisibility: 'active',
    },
  });
  return { player, created: true };
}

async function playedResultsForPlayer(tournamentId: string, playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return [];

  const labels = [playerLabel(player), player.name, player.displayName ?? ''].filter(Boolean);
  const results = await prisma.matchResult.findMany({
    where: { tournamentId },
    include: { match: { select: { id: true, roundLabel: true, completed: true } } },
  });

  return results.filter((r) => {
    const st = (r.status || '').toLowerCase();
    if (!['played', 'walkover', 'retired', 'defaulted'].includes(st) || !r.score) return false;
    return labels.some((l) => normName(r.playerA) === normName(l) || normName(r.playerB) === normName(l));
  });
}

async function migrateScheduleEntry(
  tx: Prisma.TransactionClient,
  oldKey: string,
  group: string,
  round: number,
  playerA: string,
  playerB: string,
  ballPlayer: string,
): Promise<boolean> {
  const newKey = dedupeKey(group, round, playerA, playerB);
  if (oldKey === newKey) {
    const row = await tx.tournamentScheduleEntry.findUnique({ where: { dedupeKey: oldKey } });
    if (row) {
      await tx.tournamentScheduleEntry.update({
        where: { dedupeKey: oldKey },
        data: { note: `Jugador con pelotas: ${ballPlayer}.` },
      });
    }
    return false;
  }

  const row = await tx.tournamentScheduleEntry.findUnique({ where: { dedupeKey: oldKey } });
  if (!row) return false;

  const note = `Jugador con pelotas: ${ballPlayer}.`;
  await tx.tournamentScheduleEntry.delete({ where: { dedupeKey: oldKey } });
  await tx.tournamentScheduleEntry.upsert({
    where: { dedupeKey: newKey },
    create: {
      dedupeKey: newKey,
      tournamentId: TOURNAMENT_ID,
      leagueNum: LEAGUE_NUM,
      scheduleStatus: row.scheduleStatus,
      date: row.date,
      time: row.time,
      venue: row.venue,
      note,
      confirmedAt: row.confirmedAt,
      featuredForHome: row.featuredForHome,
    },
    update: {
      scheduleStatus: row.scheduleStatus,
      date: row.date,
      time: row.time,
      venue: row.venue,
      note,
      confirmedAt: row.confirmedAt,
      featuredForHome: row.featuredForHome,
    },
  });
  return true;
}

async function main() {
  const conflicts: string[] = [];
  const modifiedMatches: string[] = [];
  const playedByOutgoing: Array<{
    matchId: string | null;
    roundLabel: string | null;
    playerA: string;
    playerB: string;
    score: string | null;
    playedAt: string | null;
    recommendation: string;
  }> = [];

  const outResolved = await resolvePlayer(OUT_LABEL, OUT_ID_HINT);
  const innResolved = await resolvePlayer(IN_LABEL, IN_ID_HINT, {
    id: IN_ID_HINT,
    shortLabel: IN_LABEL,
    display: IN_DISPLAY,
    category: 'Tercera A',
  });

  if (!innResolved.player) {
    console.log(JSON.stringify({ error: 'No se pudo resolver ni crear Araujo J.', conflicts }, null, 2));
    process.exitCode = 1;
    return;
  }

  const outP = outResolved.player;
  const innP = innResolved.player;

  const groups = await prisma.group.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    include: { players: { include: { player: true } } },
  });
  const groupC = groups.find((g) => g.key === GROUP_KEY);
  if (!groupC) {
    console.log(JSON.stringify({ error: 'Grupo C no encontrado en t-federer-l3' }, null, 2));
    process.exitCode = 1;
    return;
  }

  const innAlreadyInC = groupC.players.some((gp) => gp.playerId === innP.id);
  const outStillInC = outP ? groupC.players.some((gp) => gp.playerId === outP.id) : false;

  if (innAlreadyInC && !outStillInC) {
    console.log(
      JSON.stringify(
        {
          torneo: 'Roger Federer 2026 – Liga 3',
          reemplazoAplicado: `${OUT_LABEL} → ${IN_LABEL}`,
          araujoExistiaOCreado: innResolved.created ? 'creado' : 'existía',
          agregadoAlRanking: 'ya aplicado previamente',
          grupoActualizado: true,
          fixtureActualizado: true,
          partidosModificados: [],
          partidosJugadosPorRojas: [],
          conflictos: ['Reemplazo ya aplicado: Araujo J. ya está en Grupo C y Rojas L. no figura.'],
          estadoFinal: 'already_done',
        },
        null,
        2,
      ),
    );
    return;
  }

  const played = outP ? await playedResultsForPlayer(TOURNAMENT_ID, outP.id) : [];
  for (const r of played) {
    playedByOutgoing.push({
      matchId: r.matchId,
      roundLabel: r.match?.roundLabel ?? null,
      playerA: r.playerA,
      playerB: r.playerB,
      score: r.score,
      playedAt: r.playedAt ? r.playedAt.toISOString() : null,
      recommendation:
        'Historial conservado bajo Rojas L. (p. ej. Del Valle G. vs Rojas L.). Araujo J. solo en partidos pendientes.',
    });
  }
  if (played.length > 0) {
    conflicts.push(`Rojas L. tiene ${played.length} resultado(s) jugado(s); historial conservado sin borrar.`);
  }

  const playerIdCache = new Map<string, string>();
  playerIdCache.set(normName(IN_LABEL), innP.id);

  async function idForName(tx: Prisma.TransactionClient, name: string): Promise<string> {
    const key = normName(name);
    const cached = playerIdCache.get(key);
    if (cached) return cached;
    const row = await tx.player.findFirst({
      where: {
        OR: [{ name }, { displayName: name }],
      },
      select: { id: true, name: true, displayName: true },
    });
    if (!row) throw new Error(`Jugador no encontrado: ${name}`);
    playerIdCache.set(key, row.id);
    return row.id;
  }

  await prisma.$transaction(async (tx) => {
    if (outP) {
      await tx.groupPlayer.deleteMany({ where: { groupId: groupC.id, playerId: outP.id } });
    }

    const outSeed = groupC.players.find((gp) => gp.playerId === outP?.id)?.seed ?? 1;
    await tx.groupPlayer.upsert({
      where: { groupId_playerId: { groupId: groupC.id, playerId: innP.id } },
      create: { groupId: groupC.id, playerId: innP.id, seed: outSeed },
      update: { seed: outSeed },
    });

    for (const patch of MATCH_PATCHES) {
      const existing = await tx.match.findUnique({
        where: { id: patch.matchId },
        include: { player1: true, player2: true, group: true },
      });
      if (!existing || existing.tournamentId !== TOURNAMENT_ID) {
        conflicts.push(`Partido ${patch.matchId} no encontrado en t-federer-l3`);
        continue;
      }

      const isPlayed =
        existing.completed ||
        played.some((r) => r.matchId === existing.id);

      if (isPlayed && outP && (existing.player1Id === outP.id || existing.player2Id === outP.id)) {
        conflicts.push(`Partido ${patch.matchId} (${existing.roundLabel}) ya jugado; no modificado.`);
        continue;
      }

      const oldA = existing.player1.name;
      const oldB = existing.player2.name;
      const oldGroupKey = existing.group?.key ?? patch.group;
      const roundNum = patch.round;
      const oldKey = dedupeKey(oldGroupKey, roundNum, oldA, oldB);

      const p1 = await idForName(tx, patch.playerA);
      const p2 = await idForName(tx, patch.playerB);

      await tx.match.update({
        where: { id: patch.matchId },
        data: {
          groupId: groupC.id,
          roundLabel: `Grupo ${patch.group} - Fecha ${patch.round}`,
          player1Id: p1,
          player2Id: p2,
        },
      });
      modifiedMatches.push(patch.matchId);

      await migrateScheduleEntry(tx, oldKey, patch.group, patch.round, patch.playerA, patch.playerB, patch.ballPlayer);

      const pendingResults = await tx.matchResult.findMany({
        where: {
          tournamentId: TOURNAMENT_ID,
          OR: [{ status: 'pending' }, { score: null }],
        },
      });
      for (const r of pendingResults) {
        let pa = r.playerA;
        let pb = r.playerB;
        let changed = false;
        if (normName(pa) === normName(OUT_LABEL)) {
          pa = IN_LABEL;
          changed = true;
        }
        if (normName(pb) === normName(OUT_LABEL)) {
          pb = IN_LABEL;
          changed = true;
        }
        if (!changed) continue;
        const newKey = rebuildDedupeKey(r.dedupeKey, OUT_LABEL, IN_LABEL);
        await tx.matchResult.update({
          where: { id: r.id },
          data: { dedupeKey: newKey, playerA: pa, playerB: pb, matchId: patch.matchId },
        });
      }
    }

    if (outP) {
      const extraPending = await tx.match.findMany({
        where: {
          tournamentId: TOURNAMENT_ID,
          completed: false,
          OR: [{ player1Id: outP.id }, { player2Id: outP.id }],
        },
      });
      for (const m of extraPending) {
        if (modifiedMatches.includes(m.id)) continue;
        const data: { player1Id?: string; player2Id?: string } = {};
        if (m.player1Id === outP.id) data.player1Id = innP.id;
        if (m.player2Id === outP.id) data.player2Id = innP.id;
        if (Object.keys(data).length > 0) {
          await tx.match.update({ where: { id: m.id }, data });
          modifiedMatches.push(m.id);
        }
      }
    }

    const tour = await tx.tournament.findUnique({
      where: { id: TOURNAMENT_ID },
      select: { ligaDoc: true, preclasificacionJson: true },
    });
    const currentDoc = (tour?.ligaDoc ?? {}) as { grupos?: { A: string[]; B: string[]; C: string[] } };
    const groupsDoc = currentDoc.grupos ?? {
      A: ['Gimenez F.', 'Merlo S.', 'Chantada S.', 'Vila E.'],
      B: ['Tellechea L.', 'Cirigliano D.', 'Sola M.', 'Oswald J.'],
      C: [...CORRECT_GROUP_C],
    };

    await tx.tournament.update({
      where: { id: TOURNAMENT_ID },
      data: { ligaDoc: ligaDocAfterReplace(groupsDoc) },
    });

    if (tour?.preclasificacionJson) {
      await tx.tournament.update({
        where: { id: TOURNAMENT_ID },
        data: {
          preclasificacionJson: replaceNamesDeep(tour.preclasificacionJson, OUT_LABEL, IN_LABEL) as Prisma.InputJsonValue,
        },
      });
    }

    const roster: Record<string, string[]> = {};
    const freshGroups = await tx.group.findMany({
      where: { tournamentId: TOURNAMENT_ID },
      include: { players: { orderBy: { seed: 'asc' } } },
    });
    for (const g of freshGroups) {
      roster[g.key] = g.players.map((gp) => gp.playerId);
    }
    await syncTournamentGroupRosterInTx(tx, TOURNAMENT_ID, roster);
  });

  await recalculateRankings(prisma);

  const finalGroupC = await prisma.groupPlayer.findMany({
    where: { group: { tournamentId: TOURNAMENT_ID, key: GROUP_KEY } },
    include: { player: { select: { name: true } } },
    orderBy: { seed: 'asc' },
  });

  const stillOutGroup = outP
    ? await prisma.groupPlayer.count({ where: { playerId: outP.id, group: { tournamentId: TOURNAMENT_ID } } })
    : 0;
  const stillOutPending = outP
    ? await prisma.match.count({
        where: {
          tournamentId: TOURNAMENT_ID,
          completed: false,
          OR: [{ player1Id: outP.id }, { player2Id: outP.id }],
        },
      })
    : 0;

  if (stillOutGroup > 0) conflicts.push(`Rojas L. sigue en ${stillOutGroup} grupo(s) del torneo.`);
  if (stillOutPending > 0) conflicts.push(`Rojas L. sigue en ${stillOutPending} partido(s) pendiente(s).`);

  const report = {
    torneo: 'Roger Federer 2026 – Liga 3',
    reemplazoAplicado: `${OUT_LABEL} → ${IN_LABEL}`,
    araujoExistiaOCreado: innResolved.created ? 'creado' : 'existía',
    araujoId: innP.id,
    rojasId: outP?.id ?? null,
    agregadoAlRanking: true,
    grupoActualizado: finalGroupC.some((gp) => normName(gp.player.name).includes('araujo')),
    grupoCFinal: finalGroupC.map((gp) => gp.player.name),
    fixtureActualizado: true,
    partidosModificados: modifiedMatches,
    partidosJugadosPorRojas: playedByOutgoing,
    conflictos: conflicts,
    estadoFinal:
      stillOutGroup > 0 || stillOutPending > 0
        ? 'partial'
        : played.length > 0
          ? 'ok_with_history'
          : 'ok',
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
