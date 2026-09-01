import '../envBootstrap.js';
import type { Player } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { normPlayerCatalogKey, PLAYER_PROFILE_CATALOG } from '../lib/playerProfileCatalog.js';
import { playersAreSamePerson } from '../services/playerTournamentDisplay.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

type PlayerLite = Pick<
  Player,
  'id' | 'name' | 'displayName' | 'firstName' | 'lastName' | 'category' | 'profileImage' | 'rosterActive'
>;

function normName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function canonicalScore(p: PlayerLite, rankingPoints: number): number {
  let score = rankingPoints * 1000;
  if (p.profileImage?.trim()) score += 500;
  if (p.firstName?.trim() && p.lastName?.trim()) score += 100;
  if (/\.[A-Za-zÀ-ÿ]\.?\s*$/.test(p.name.trim())) score += 50;
  if (p.rosterActive) score += 10;
  return score;
}

function chooseCanonical(players: PlayerLite[], pointsById: Map<string, number>): PlayerLite {
  return [...players].sort(
    (a, b) => canonicalScore(b, pointsById.get(b.id) ?? 0) - canonicalScore(a, pointsById.get(a.id) ?? 0),
  )[0]!;
}

function buildClusters(players: PlayerLite[]): PlayerLite[][] {
  const clusters: PlayerLite[][] = [];

  for (const row of PLAYER_PROFILE_CATALOG) {
    const fullName = `${row.firstName} ${row.lastName}`.trim();
    const refShort: PlayerLite = {
      id: '',
      name: row.tournamentKey,
      displayName: null,
      firstName: null,
      lastName: null,
      category: '',
      profileImage: null,
      rosterActive: true,
    };
    const refFull: PlayerLite = {
      ...refShort,
      name: fullName,
      displayName: fullName,
    };
    const hits = players.filter(
      (p) =>
        playersAreSamePerson(p, refShort) ||
        playersAreSamePerson(p, refFull) ||
        normPlayerCatalogKey(p.name) === normPlayerCatalogKey(row.tournamentKey) ||
        normName(p.displayName ?? '') === normName(fullName),
    );
    if (hits.length <= 1) continue;
    const byCategory = new Map<string, PlayerLite[]>();
    for (const hit of hits) {
      const list = byCategory.get(hit.category) ?? [];
      list.push(hit);
      byCategory.set(hit.category, list);
    }
    for (const list of byCategory.values()) {
      if (list.length <= 1) continue;
      clusters.push(list);
    }
  }

  const assigned = new Set(clusters.flat().map((p) => p.id));
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!;
      const b = players[j]!;
      if (a.category !== b.category) continue;
      if (assigned.has(a.id) && assigned.has(b.id)) continue;
      if (!playersAreSamePerson(a, b)) continue;
      let cluster = clusters.find((c) => c.some((p) => p.id === a.id || p.id === b.id));
      if (!cluster) {
        cluster = [];
        clusters.push(cluster);
      }
      if (!cluster.some((p) => p.id === a.id)) cluster.push(a);
      if (!cluster.some((p) => p.id === b.id)) cluster.push(b);
      assigned.add(a.id);
      assigned.add(b.id);
    }
  }

  return clusters.filter((c) => c.length > 1);
}

async function mergePlayerIntoCanonical(fromId: string, toId: string): Promise<void> {
  if (fromId === toId) return;

  const groupRows = await prisma.groupPlayer.findMany({ where: { playerId: fromId } });
  for (const gp of groupRows) {
    const conflict = await prisma.groupPlayer.findUnique({
      where: { groupId_playerId: { groupId: gp.groupId, playerId: toId } },
    });
    if (conflict) {
      await prisma.groupPlayer.delete({
        where: { groupId_playerId: { groupId: gp.groupId, playerId: fromId } },
      });
    } else {
      await prisma.groupPlayer.update({
        where: { groupId_playerId: { groupId: gp.groupId, playerId: fromId } },
        data: { playerId: toId },
      });
    }
  }

  await prisma.match.updateMany({ where: { player1Id: fromId }, data: { player1Id: toId } });
  await prisma.match.updateMany({ where: { player2Id: fromId }, data: { player2Id: toId } });
  await prisma.match.updateMany({ where: { winnerId: fromId }, data: { winnerId: toId } });
  await prisma.match.updateMany({ where: { loserId: fromId }, data: { loserId: toId } });

  const rankingRows = await prisma.leagueRankingRow.findMany({ where: { playerId: fromId } });
  for (const row of rankingRows) {
    const conflict = await prisma.leagueRankingRow.findUnique({
      where: { playerId_league: { playerId: toId, league: row.league } },
    });
    if (conflict) {
      await prisma.leagueRankingRow.delete({ where: { id: row.id } });
    } else {
      await prisma.leagueRankingRow.update({ where: { id: row.id }, data: { playerId: toId } });
    }
  }

  const from = await prisma.player.findUnique({ where: { id: fromId } });
  const to = await prisma.player.findUnique({ where: { id: toId } });
  if (from && to) {
    await prisma.player.update({
      where: { id: toId },
      data: {
        firstName: to.firstName ?? from.firstName,
        lastName: to.lastName ?? from.lastName,
        displayName: to.displayName ?? from.displayName,
        profileImage: to.profileImage ?? from.profileImage,
        nationality: to.nationality ?? from.nationality,
        playingHand: to.playingHand ?? from.playingHand,
        birthDate: to.birthDate ?? from.birthDate,
      },
    });
  }

  await prisma.player.update({
    where: { id: fromId },
    data: {
      rosterActive: false,
      profileVisibility: 'hidden',
    },
  });
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const players = await prisma.player.findMany({
    where: { rosterActive: true },
    select: {
      id: true,
      name: true,
      displayName: true,
      firstName: true,
      lastName: true,
      category: true,
      profileImage: true,
      rosterActive: true,
    },
  });

  const rankingRows = await prisma.leagueRankingRow.findMany({
    select: { playerId: true, points: true },
  });
  const pointsById = new Map<string, number>();
  for (const row of rankingRows) {
    pointsById.set(row.playerId, (pointsById.get(row.playerId) ?? 0) + row.points);
  }

  const clusters = buildClusters(players);
  if (clusters.length === 0) {
    console.log('[merge-players] No se encontraron duplicados activos.');
    return;
  }

  console.log(`[merge-players] ${clusters.length} grupo(s) duplicados${dryRun ? ' (dry-run)' : ''}:`);
  for (const cluster of clusters) {
    const canonical = chooseCanonical(cluster, pointsById);
    const dupes = cluster.filter((p) => p.id !== canonical.id);
    console.log(
      `  canonical ${canonical.id} (${canonical.name} / ${canonical.displayName ?? '—'}) <- ${dupes.map((d) => d.id).join(', ')}`,
    );
    if (dryRun) continue;
    for (const dupe of dupes) {
      await mergePlayerIntoCanonical(dupe.id, canonical.id);
    }
  }

  if (!dryRun) {
    await recalculateRankings(prisma);
    console.log('[merge-players] Rankings recalculados.');
  }
  console.log('[merge-players] OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
