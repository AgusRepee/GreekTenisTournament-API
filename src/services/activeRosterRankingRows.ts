import type { Player, PrismaClient } from '@prisma/client';
import { categoryToLeague } from './recalculateRankings.js';
import type { RankingRowWithPlayer } from './rankingPublicSort.js';

type RankingPlayer = Pick<Player, 'id' | 'name' | 'category' | 'profileImage'>;

function emptyRankingRow(player: RankingPlayer, league: number): RankingRowWithPlayer {
  return {
    id: `active-roster:${player.id}:${league}`,
    playerId: player.id,
    league,
    points: 0,
    played: 0,
    wins: 0,
    losses: 0,
    titles: 0,
    finals: 0,
    statsJson: {
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      tournamentsPlayed: 0,
      semifinals: 0,
      activeRosterOnly: true,
    },
    updatedAt: new Date(0),
    player,
  };
}

function addRosterPlayer(
  rowsByKey: Map<string, RankingRowWithPlayer>,
  player: RankingPlayer,
  league: number,
  leagueFilter: number | null,
): void {
  if (league < 1 || league > 6) return;
  if (leagueFilter != null && league !== leagueFilter) return;
  const key = `${player.id}|${league}`;
  // Nunca reemplazar una fila materializada: si ya hay ranking real, conserva puntos/estadísticas.
  if (rowsByKey.has(key)) return;
  rowsByKey.set(key, emptyRankingRow(player, league));
}

/**
 * Ranking público = ranking materializado + padrón activo de jugadores.
 * Si todavía no jugaron, aparecen con 0 puntos en vez de desaparecer.
 */
export async function mergeActiveRosterRankingRows(
  prisma: PrismaClient,
  rows: RankingRowWithPlayer[],
  leagueFilter: number | null = null,
): Promise<RankingRowWithPlayer[]> {
  const rowsByKey = new Map<string, RankingRowWithPlayer>();
  for (const row of rows) rowsByKey.set(`${row.playerId}|${row.league}`, row);

  const players = await prisma.player.findMany({
    where: {
      rosterActive: true,
      profileVisibility: 'active',
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      displayName: true,
      category: true,
      profileImage: true,
      nationality: true,
    },
  });

  const activePlayerIds = players.map((p) => p.id);
  const [groupPlayers, tournamentLeagues] = await Promise.all([
    activePlayerIds.length > 0
      ? prisma.groupPlayer.findMany({
          where: { playerId: { in: activePlayerIds } },
          include: { group: { select: { tournamentId: true } } },
        })
      : Promise.resolve([]),
    prisma.tournamentLeague.findMany({ select: { tournamentId: true, leagueNum: true } }),
  ]);

  const playersById = new Map(players.map((p) => [p.id, p]));
  const leaguesByTournament = new Map<string, number[]>();
  for (const tl of tournamentLeagues) {
    const arr = leaguesByTournament.get(tl.tournamentId) ?? [];
    arr.push(tl.leagueNum);
    leaguesByTournament.set(tl.tournamentId, arr);
  }

  for (const player of players) {
    addRosterPlayer(rowsByKey, player, categoryToLeague(player.category), leagueFilter);
  }

  for (const gp of groupPlayers) {
    const player = playersById.get(gp.playerId);
    if (!player) continue;
    for (const L of leaguesByTournament.get(gp.group.tournamentId) ?? []) {
      addRosterPlayer(rowsByKey, player, L, leagueFilter);
    }
  }

  return Array.from(rowsByKey.values());
}
