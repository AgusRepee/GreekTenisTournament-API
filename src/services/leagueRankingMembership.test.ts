import { describe, expect, it } from 'vitest';
import { buildLeagueParticipationSets } from './leagueRankingMembership.js';
import { phaseKey } from './phaseMatchIndex.js';

describe('buildLeagueParticipationSets', () => {
  it('incluye jugadores por categoría y por plantel en otra liga (ascenso)', () => {
    const players = [
      { id: 'p-l6', name: 'Ascendido', category: 'Sexta' },
      { id: 'p-l5', name: 'Solo L5', category: 'Quinta A' },
    ] as const;

    const tournamentLeagues = [
      { tournamentId: 't-novak-l6', leagueNum: 6 },
      { tournamentId: 't-novak-l5', leagueNum: 5 },
    ] as const;

    const leaguesByTournament = new Map([
      ['t-novak-l6', [6]],
      ['t-novak-l5', [5]],
    ]);

    const groupPlayers = [
      { playerId: 'p-l6', group: { tournamentId: 't-novak-l6' } },
      { playerId: 'p-l6', group: { tournamentId: 't-novak-l5' } },
      { playerId: 'p-l5', group: { tournamentId: 't-novak-l5' } },
    ];

    const phaseMap = new Map<string, { playerA: string; playerB: string }[]>();

    const sets = buildLeagueParticipationSets(
      [...players],
      [...tournamentLeagues],
      phaseMap as never,
      groupPlayers,
      leaguesByTournament,
    );

    expect(sets.get(6)?.has('p-l6')).toBe(true);
    expect(sets.get(5)?.has('p-l6')).toBe(true);
    expect(sets.get(5)?.has('p-l5')).toBe(true);
    expect(sets.get(6)?.has('p-l5')).toBe(false);
  });

  it('incluye jugadores por partidos en fase aunque no estén en el padrón de esa liga', () => {
    const players = [{ id: 'p-x', name: 'X', category: 'Sexta' }] as const;
    const phaseMap = new Map([
      [
        phaseKey('t-novak-l4', 4),
        [{ playerA: 'p-x', playerB: 'p-y', winnerId: 'p-x', completed: true }],
      ],
    ]);

    const sets = buildLeagueParticipationSets(
      [...players],
      [{ tournamentId: 't-novak-l4', leagueNum: 4 }],
      phaseMap as never,
      [],
      new Map([['t-novak-l4', [4]]]),
    );

    expect(sets.get(4)?.has('p-x')).toBe(true);
    expect(sets.get(4)?.has('p-y')).toBe(true);
  });
});
