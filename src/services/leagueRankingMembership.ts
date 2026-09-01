/**
 * Regla de ranking por liga (ascensos / repetición entre ligas):
 * Un jugador puede figurar en el ranking de cada liga en la que:
 * 1) Su categoría de padrón coincide con la liga, o
 * 2) Está en el plantel (GroupPlayer) de un torneo de esa liga, o
 * 3) Jugó al menos un partido (fase de grupos/KO) en un torneo de esa liga.
 */
import type { Player, TournamentLeague } from '@prisma/client';
import type { TournamentPhaseMatch } from './rankingPhase.js';
import { phaseKey } from './phaseMatchIndex.js';

const CAT_TO_LEAGUE: Record<string, number> = {
  Primera: 1,
  Segunda: 2,
  Tercera: 3,
  Cuarta: 4,
  'Quinta A': 5,
  Sexta: 6,
  'Quinta B': 6,
};

function categoryToLeague(cat: string | null | undefined): number {
  if (!cat) return 3;
  return CAT_TO_LEAGUE[cat] ?? 3;
}

export type GroupPlayerRow = {
  playerId: string;
  group: { tournamentId: string };
};

export function buildLeagueParticipationSets(
  players: Player[],
  _tournamentLeagues: TournamentLeague[],
  phaseMap: Map<string, TournamentPhaseMatch[]>,
  groupPlayers: GroupPlayerRow[],
  leaguesByTournament: Map<string, number[]>,
): Map<number, Set<string>> {
  const byLeague = new Map<number, Set<string>>();
  for (let L = 1; L <= 6; L++) byLeague.set(L, new Set());

  for (const p of players) {
    byLeague.get(categoryToLeague(p.category))!.add(p.id);
  }

  for (const gp of groupPlayers) {
    for (const L of leaguesByTournament.get(gp.group.tournamentId) ?? []) {
      if (L >= 1 && L <= 6) byLeague.get(L)!.add(gp.playerId);
    }
  }

  for (const [key, phases] of phaseMap) {
    const leaguePart = key.split('|')[1];
    const L = Number(leaguePart);
    if (!Number.isFinite(L) || L < 1 || L > 6) continue;
    const set = byLeague.get(L)!;
    for (const pm of phases) {
      set.add(pm.playerA);
      set.add(pm.playerB);
    }
  }

  return byLeague;
}

export function tournamentIdsForLeague(
  tournamentLeagues: TournamentLeague[],
  leagueNum: number,
): Set<string> {
  return new Set(
    tournamentLeagues.filter((tl) => tl.leagueNum === leagueNum).map((tl) => tl.tournamentId),
  );
}

export function playersForLeagueRanking(
  players: Player[],
  leagueNum: number,
  participationByLeague: Map<number, Set<string>>,
): Player[] {
  const ids = participationByLeague.get(leagueNum) ?? new Set<string>();
  return players.filter((p) => ids.has(p.id));
}

export function phaseKeysForLeagueTournaments(
  tournamentIds: Iterable<string>,
  leagueNum: number,
): string[] {
  return [...tournamentIds].map((tid) => phaseKey(tid, leagueNum));
}

/** Jugadores inscriptos en fase de grupos por torneo (GroupPlayer). */
export function buildGroupRosterByTournament(groupPlayers: GroupPlayerRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const gp of groupPlayers) {
    const tid = gp.group.tournamentId;
    const set = map.get(tid) ?? new Set<string>();
    set.add(gp.playerId);
    map.set(tid, set);
  }
  return map;
}

export function playerListedInTournamentGroupRoster(
  rosterByTournament: Map<string, Set<string>>,
  tournamentId: string,
  playerId: string,
): boolean {
  return rosterByTournament.get(tournamentId)?.has(playerId) ?? false;
}

/** Cuenta torneo jugado: resultados publicados o plantel de grupos confirmado en BD. */
export function playerCountsAsTournamentParticipant(
  playedInTournament: boolean,
  rosterByTournament: Map<string, Set<string>>,
  tournamentId: string,
  playerId: string,
): boolean {
  if (playedInTournament) return true;
  return playerListedInTournamentGroupRoster(rosterByTournament, tournamentId, playerId);
}
