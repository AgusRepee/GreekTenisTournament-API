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

  it('solo el eliminado de repechaje recibe esa instancia', () => {
    const matches = [
      { playerA: 'p1', playerB: 'p2', winnerId: 'p1', round: 'Repechaje' },
      { playerA: 'p1', playerB: 'p3', winnerId: null, group: 'A', completed: true },
    ];
    expect(getPlayerReachedPhase('p2', matches)).toBe('repechage');
    expect(getPlayerReachedPhase('p1', matches)).toBe('group_stage');
  });

  it('semifinalista cuando ganó cuartos aunque la semi siga pendiente', () => {
    const matches = [
      { playerA: 'p1', playerB: 'p2', winnerId: 'p1', round: 'Cuartos de final' },
      { playerA: 'p3', playerB: 'p4', winnerId: 'p3', round: 'Cuartos de final' },
      { playerA: 'p1', playerB: 'p3', winnerId: null, round: 'Semifinales' },
    ];
    expect(getPlayerReachedPhase('p1', matches)).toBe('semifinalist');
    expect(getPlayerReachedPhase('p3', matches)).toBe('semifinalist');
    expect(getPlayerReachedPhase('p2', matches)).toBe('quarterfinalist');
  });

  it('finalista si ganó semis y la final está pendiente', () => {
    const matches = [
      { playerA: 'p1', playerB: 'p3', winnerId: 'p1', round: 'Semifinales' },
      { playerA: 'p2', playerB: 'p4', winnerId: 'p2', round: 'Semifinales' },
      { playerA: 'p1', playerB: 'p2', winnerId: null, round: 'Final' },
    ];
    expect(getPlayerReachedPhase('p1', matches)).toBe('finalist');
    expect(getPlayerReachedPhase('p2', matches)).toBe('finalist');
    expect(getPlayerReachedPhase('p3', matches)).toBe('semifinalist');
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
