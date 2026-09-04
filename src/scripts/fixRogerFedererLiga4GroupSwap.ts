/**
 * Corrige asignación Vidigt F. ↔ Murchio M. en Roger Federer Liga 4 (t-federer-l4).
 * Solo mueve plantel + partidos afectados; no borra jugadores, resultados ni duplica partidos.
 */
import '../envBootstrap.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TOURNAMENT_ID = 't-federer-l4';
const LEAGUE_NUM = 4;

const CORRECT_GROUPS = {
  A: ['Rios J.', 'Garcia J.', 'Oviedo M.', 'Gonzalez Días F.', 'Cardozo M.'],
  B: ['Anetta D.', 'Repecka J.', 'Vidigt F.', 'Miletta J.', 'Gonzalez Días C.'],
  C: ['Maza S.', 'Blanco J.', 'Bauerkamper G.', 'Chantada M.', 'Murchio M.'],
} as const;

type FixturePatch = {
  matchId: string;
  group: 'B' | 'C';
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

const FIXTURE_PATCHES: FixturePatch[] = [
  { matchId: 'federer-l4-04', group: 'B', round: 1, playerA: 'Vidigt F.', playerB: 'Miletta J.', ballPlayer: 'Vidigt F.' },
  { matchId: 'federer-l4-10', group: 'B', round: 2, playerA: 'Vidigt F.', playerB: 'Gonzalez Días C.', ballPlayer: 'Vidigt F.' },
  { matchId: 'federer-l4-15', group: 'B', round: 3, playerA: 'Repecka J.', playerB: 'Vidigt F.', ballPlayer: 'Repecka J.' },
  { matchId: 'federer-l4-27', group: 'B', round: 5, playerA: 'Anetta D.', playerB: 'Vidigt F.', ballPlayer: 'Anetta D.' },
  { matchId: 'federer-l4-12', group: 'C', round: 2, playerA: 'Chantada M.', playerB: 'Murchio M.', ballPlayer: 'Chantada M.' },
  { matchId: 'federer-l4-18', group: 'C', round: 3, playerA: 'Murchio M.', playerB: 'Maza S.', ballPlayer: 'Murchio M.' },
  { matchId: 'federer-l4-23', group: 'C', round: 4, playerA: 'Murchio M.', playerB: 'Blanco J.', ballPlayer: 'Murchio M.' },
  { matchId: 'federer-l4-30', group: 'C', round: 5, playerA: 'Bauerkamper G.', playerB: 'Murchio M.', ballPlayer: 'Bauerkamper G.' },
];

function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function dedupeKey(group: string, round: number, playerA: string, playerB: string): string {
  return `${TOURNAMENT_ID}|${round}|${group}|${normName(playerA)}|${normName(playerB)}`;
}

function ligaDoc(): Prisma.InputJsonValue {
  return {
    torneo: 'Roger Federer',
    liga: LEAGUE_NUM,
    grupos: CORRECT_GROUPS,
    fechas: [
      {
        numero: 1,
        grupos: {
          A: ['Cardozo M. (P) vs Rios J.', 'Oviedo M. (P) vs Garcia J.', 'Libre: Gonzalez Días F.'],
          B: ['Repecka J. (P) vs Anetta D.', 'Vidigt F. (P) vs Miletta J.', 'Libre: Gonzalez Días C.'],
          C: ['Blanco J. (P) vs Maza S.', 'Chantada M. (P) vs Bauerkamper G.', 'Libre: Murchio M.'],
        },
      },
      {
        numero: 2,
        grupos: {
          A: ['Garcia J. (P) vs Cardozo M.', 'Oviedo M. (P) vs Gonzalez Días F.', 'Libre: Rios J.'],
          B: ['Miletta J. (P) vs Repecka J.', 'Vidigt F. (P) vs Gonzalez Días C.', 'Libre: Anetta D.'],
          C: ['Bauerkamper G. (P) vs Blanco J.', 'Chantada M. (P) vs Murchio M.', 'Libre: Maza S.'],
        },
      },
      {
        numero: 3,
        grupos: {
          A: ['Cardozo M. (P) vs Oviedo M.', 'Gonzalez Días F. (P) vs Rios J.', 'Libre: Garcia J.'],
          B: ['Repecka J. (P) vs Vidigt F.', 'Gonzalez Días C. (P) vs Anetta D.', 'Libre: Miletta J.'],
          C: ['Blanco J. (P) vs Chantada M.', 'Murchio M. (P) vs Maza S.', 'Libre: Bauerkamper G.'],
        },
      },
      {
        numero: 4,
        grupos: {
          A: ['Gonzalez Días F. (P) vs Cardozo M.', 'Rios J. (P) vs Garcia J.', 'Libre: Oviedo M.'],
          B: ['Gonzalez Días C. (P) vs Repecka J.', 'Anetta D. (P) vs Miletta J.', 'Libre: Vidigt F.'],
          C: ['Murchio M. (P) vs Blanco J.', 'Maza S. (P) vs Bauerkamper G.', 'Libre: Chantada M.'],
        },
      },
      {
        numero: 5,
        grupos: {
          A: ['Rios J. (P) vs Oviedo M.', 'Garcia J. (P) vs Gonzalez Días F.', 'Libre: Cardozo M.'],
          B: ['Anetta D. (P) vs Vidigt F.', 'Miletta J. (P) vs Gonzalez Días C.', 'Libre: Repecka J.'],
          C: ['Maza S. (P) vs Chantada M.', 'Bauerkamper G. (P) vs Murchio M.', 'Libre: Blanco J.'],
        },
      },
    ],
  };
}

const playerIdCache = new Map<string, string>();

async function resolvePlayerId(name: string): Promise<string> {
  const key = normName(name);
  const cached = playerIdCache.get(key);
  if (cached) return cached;

  const all = await prisma.player.findMany({ select: { id: true, name: true, displayName: true } });
  const hit = all.find((p) => normName(p.name) === key || normName(p.displayName ?? '') === key);
  if (!hit) throw new Error(`Jugador no encontrado: ${name}`);
  playerIdCache.set(key, hit.id);
  return hit.id;
}

async function migrateScheduleEntry(
  tx: Prisma.TransactionClient,
  oldKey: string,
  patch: FixturePatch,
): Promise<void> {
  const newKey = dedupeKey(patch.group, patch.round, patch.playerA, patch.playerB);
  if (oldKey === newKey) return;

  const row = await tx.tournamentScheduleEntry.findUnique({ where: { dedupeKey: oldKey } });
  if (!row) return;

  const note = `Jugador con pelotas: ${patch.ballPlayer}.`;
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
}

async function migrateMatchResultDedupe(
  tx: Prisma.TransactionClient,
  oldKey: string,
  patch: FixturePatch,
): Promise<{ hadResult: boolean; score: string | null }> {
  const newKey = dedupeKey(patch.group, patch.round, patch.playerA, patch.playerB);
  const row = await tx.matchResult.findUnique({ where: { dedupeKey: oldKey } });
  if (!row) return { hadResult: false, score: null };

  await tx.matchResult.update({
    where: { dedupeKey: oldKey },
    data: {
      dedupeKey: newKey,
      groupKey: patch.group,
      roundNum: patch.round,
      playerA: patch.playerA,
      playerB: patch.playerB,
      matchId: patch.matchId,
    },
  });
  return { hadResult: true, score: row.score };
}

async function main() {
  const conflicts: string[] = [];
  let chantadaMurchioScore: string | null = null;
  let chantadaMurchioHadResult = false;

  await resolvePlayerId('Vidigt F.');
  await resolvePlayerId('Murchio M.');

  await prisma.$transaction(async (tx) => {
    const groups = await tx.group.findMany({
      where: { tournamentId: TOURNAMENT_ID, key: { in: ['B', 'C'] } },
    });
    const groupB = groups.find((g) => g.key === 'B');
    const groupC = groups.find((g) => g.key === 'C');
    if (!groupB || !groupC) throw new Error('Grupos B/C no encontrados en t-federer-l4');

    for (const [key, names] of Object.entries(CORRECT_GROUPS)) {
      const group = key === 'B' ? groupB : key === 'C' ? groupC : null;
      if (!group) continue;
      for (const [index, name] of names.entries()) {
        const pid = await resolvePlayerId(name);
        await tx.groupPlayer.upsert({
          where: { groupId_playerId: { groupId: group.id, playerId: pid } },
          create: { groupId: group.id, playerId: pid, seed: index + 1 },
          update: { seed: index + 1 },
        });
      }
      const allowed = names.map((n) => playerIdCache.get(normName(n))!).filter(Boolean);
      await tx.groupPlayer.deleteMany({
        where: { groupId: group.id, playerId: { notIn: allowed } },
      });
    }

    await tx.tournament.update({
      where: { id: TOURNAMENT_ID },
      data: { ligaDoc: ligaDoc() },
    });

    for (const patch of FIXTURE_PATCHES) {
      const existing = await tx.match.findUnique({
        where: { id: patch.matchId },
        include: {
          player1: { select: { name: true } },
          player2: { select: { name: true } },
        },
      });
      if (!existing) {
        conflicts.push(`Partido ${patch.matchId} no encontrado`);
        continue;
      }
      if (existing.tournamentId !== TOURNAMENT_ID) {
        conflicts.push(`Partido ${patch.matchId} pertenece a otro torneo`);
        continue;
      }

      const oldA = existing.player1.name;
      const oldB = existing.player2.name;
      const oldKey = dedupeKey(
        existing.groupId === groupB.id ? 'B' : existing.groupId === groupC.id ? 'C' : patch.group,
        patch.round,
        oldA,
        oldB,
      );

      const p1 = await resolvePlayerId(patch.playerA);
      const p2 = await resolvePlayerId(patch.playerB);
      const groupId = patch.group === 'B' ? groupB.id : groupC.id;

      await tx.match.update({
        where: { id: patch.matchId },
        data: {
          groupId,
          roundLabel: `Grupo ${patch.group} - Fecha ${patch.round}`,
          player1Id: p1,
          player2Id: p2,
        },
      });

      await migrateScheduleEntry(tx, oldKey, patch);

      const resultInfo = await migrateMatchResultDedupe(tx, oldKey, patch);
      if (patch.matchId === 'federer-l4-12') {
        chantadaMurchioHadResult = resultInfo.hadResult;
        chantadaMurchioScore = resultInfo.score;
      }

      const linked = await tx.matchResult.findMany({ where: { matchId: patch.matchId } });
      for (const r of linked) {
        await tx.matchResult.update({
          where: { id: r.id },
          data: {
            groupKey: patch.group,
            roundNum: patch.round,
            playerA: patch.playerA,
            playerB: patch.playerB,
            dedupeKey: dedupeKey(patch.group, patch.round, patch.playerA, patch.playerB),
          },
        });
        if (patch.matchId === 'federer-l4-12') {
          chantadaMurchioHadResult = true;
          chantadaMurchioScore = r.score;
        }
      }
    }
  });

  const groupBPlayers = await prisma.groupPlayer.findMany({
    where: { group: { tournamentId: TOURNAMENT_ID, key: 'B' } },
    include: { player: { select: { name: true } } },
    orderBy: { seed: 'asc' },
  });
  const groupCPlayers = await prisma.groupPlayer.findMany({
    where: { group: { tournamentId: TOURNAMENT_ID, key: 'C' } },
    include: { player: { select: { name: true } } },
    orderBy: { seed: 'asc' },
  });

  const chantadaMatch = await prisma.match.findUnique({
    where: { id: 'federer-l4-12' },
    include: {
      player1: { select: { name: true } },
      player2: { select: { name: true } },
      group: { select: { key: true } },
    },
  });

  const vidigtInB = groupBPlayers.some((gp) => gp.player.name.includes('Vidigt'));
  const murchioInC = groupCPlayers.some((gp) => gp.player.name.includes('Murchio'));
  const chantadaVsMurchio =
    chantadaMatch != null &&
    chantadaMatch.group?.key === 'C' &&
    normName(chantadaMatch.player1.name).includes('chantada') &&
    normName(chantadaMatch.player2.name).includes('murchio') &&
    chantadaMatch.roundLabel === 'Grupo C - Fecha 2';

  const report = {
    vidigtEnGrupoB: vidigtInB,
    murchioEnGrupoC: murchioInC,
    partidoChantadaMurchioConservado: chantadaVsMurchio,
    resultadoConservado: chantadaMurchioHadResult,
    resultadoChantadaMurchio: chantadaMurchioScore,
    conflictos: conflicts,
    fixtureGrupoB: groupBPlayers.map((gp) => gp.player.name),
    fixtureGrupoC: groupCPlayers.map((gp) => gp.player.name),
    partidosGrupoB: await prisma.match.findMany({
      where: { tournamentId: TOURNAMENT_ID, group: { key: 'B' } },
      orderBy: { id: 'asc' },
      select: { id: true, roundLabel: true, player1: { select: { name: true } }, player2: { select: { name: true } } },
    }),
    partidosGrupoC: await prisma.match.findMany({
      where: { tournamentId: TOURNAMENT_ID, group: { key: 'C' } },
      orderBy: { id: 'asc' },
      select: { id: true, roundLabel: true, player1: { select: { name: true } }, player2: { select: { name: true } } },
    }),
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
