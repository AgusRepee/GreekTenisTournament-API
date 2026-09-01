import { describe, expect, it } from 'vitest';
import { sortPublicGroupStandingRows, type PublicGroupStandingRow } from './buildPublicGroupStandings.js';

function row(playerName: string, gamesWon: number, gamesLost: number): PublicGroupStandingRow {
  return {
    position: 0,
    playerId: playerName.toLowerCase(),
    playerName,
    PJ: 4,
    PG: 2,
    PP: 2,
    setsWon: 5,
    setsLost: 5,
    gamesWon,
    gamesLost,
    setDiff: 0,
  };
}

describe('sortPublicGroupStandingRows', () => {
  it('desempata por diferencia de games antes que por nombre', () => {
    const standings = sortPublicGroupStandingRows([
      row('Aguirre W.', 57, 60),
      row('Del Valle G.', 58, 50),
    ]);

    expect(standings.map((entry) => entry.playerName)).toEqual(['Del Valle G.', 'Aguirre W.']);
    expect(standings.map((entry) => entry.position)).toEqual([1, 2]);
  });
});
