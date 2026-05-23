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
 * Ranking público = ranking materializado + jugadores inscriptos en torneos activos.
 * Si todavía no jugaron, aparecen con 0 puntos en vez de desaparecer.
 */
export async function mergeActiveRosterRankingRows(
  prisma: PrismaClient,
  rows: RankingRowWithPlayer[],
  leagueFilter: number | null = null,
): Promise<RankingRowWithPlayer[]> {
  const rowsByKey = new Map<string, RankingRowWithPlayer>();
  for (const row of rows) rowsByKey.set(`${row.playerId}|${row.league}`, row);

  const groupPlayers = await prisma.groupPlayer.findMany({
    where: {
      player: { rosterActive: true, profileVisibility: 'active' },
      group: { tournament: { status: 'upcoming' } },
    },
    include: {
      player: { select: { id: true, name: true, category: true, profileImage: true } },
      group: {
        select: {
          tournament: {
            select: {
              leagues: { select: { leagueNum: true } },
            },
          },
        },
      },
    },
  });

  for (const gp of groupPlayers) {
    const playerLeague = categoryToLeague(gp.player.category);
    const tournamentLeagues = gp.group.tournament.leagues.map((l) => l.leagueNum);
    const league = tournamentLeagues.includes(playerLeague)
      ? playerLeague
      : tournamentLeagues.length === 1
        ? tournamentLeagues[0]!
        : playerLeague;
    addRosterPlayer(rowsByKey, gp.player, league, leagueFilter);
  }

  return Array.from(rowsByKey.values());
}
