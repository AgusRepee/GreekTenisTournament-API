import { describe, expect, it } from 'vitest';
import { getPlayerReachedPhase } from './rankingPhase.js';

describe('getPlayerReachedPhase', () => {
  it('campeón si ganó la final', () => {
    const matches = [
      {
        playerA: 'p1',
        playerB: 'p2',
        winnerId: 'p1',
        round: 'Final',
      },
    ];
    expect(getPlayerReachedPhase('p1', matches)).toBe('champion');
    expect(getPlayerReachedPhase('p2', matches)).toBe('finalist');
  });

  it('semifinalista si perdió en semis', () => {
    const matches = [
      {
        playerA: 'p1',
        playerB: 'p2',
        winnerId: 'p1',
        round: 'Semifinales',
      },
    ];
    expect(getPlayerReachedPhase('p2', matches)).toBe('semifinalist');
  });

  it('group_stage con partido de grupo completado', () => {
    const matches = [
      {
        playerA: 'p1',
        playerB: 'p2',
        winnerId: 'p1',
        group: 'A',
        completed: true,
      },
    ];
    expect(getPlayerReachedPhase('p1', matches)).toBe('group_stage');
  });
});
