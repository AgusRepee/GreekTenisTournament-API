import { describe, expect, it } from 'vitest';
import { normName } from './phaseMatchIndex.js';
import {
  buildMergedGroupRoster,
  fullNameMatchesShortTournamentName,
  playersAreSamePerson,
  tournamentShortName,
  uniqueRosterEntries,
} from './playerTournamentDisplay.js';

describe('playerTournamentDisplay', () => {
  it('usa name corto para torneos, no displayName', () => {
    expect(
      tournamentShortName({ name: 'Repecka J.', displayName: 'Javier Repecka' }),
    ).toBe('Repecka J.');
  });

  it('relaciona nombre completo con formato corto', () => {
    expect(fullNameMatchesShortTournamentName('Javier Repecka', 'Repecka J.')).toBe(true);
    expect(fullNameMatchesShortTournamentName('Fernando Vera', 'Vera F.')).toBe(true);
    expect(fullNameMatchesShortTournamentName('Jose Blanco', 'Blanco J.')).toBe(true);
  });

  it('fusiona dos registros del mismo jugador en un solo roster', () => {
    const nameToId = buildMergedGroupRoster(
      [{ id: 'p-16', name: 'Javier Repecka', displayName: 'Javier Repecka' }],
      ['Repecka J.'],
      [{ id: 'p-12', name: 'Repecka J.', displayName: 'Javier Repecka' }],
    );
    const unique = uniqueRosterEntries(nameToId);
    expect(unique.size).toBe(1);
    expect(unique.get('p-12')?.tournamentName).toBe('Repecka J.');
    expect(nameToId.get(normName('Javier Repecka'))?.id).toBe('p-12');
    expect(nameToId.get(normName('Repecka J.'))?.id).toBe('p-12');
  });

  it('detecta misma persona por heuristica apellido + inicial', () => {
    expect(
      playersAreSamePerson(
        { id: 'a', name: 'Repecka J.', displayName: null },
        { id: 'b', name: 'Javier Repecka', displayName: 'Javier Repecka' },
      ),
    ).toBe(true);
  });
});
