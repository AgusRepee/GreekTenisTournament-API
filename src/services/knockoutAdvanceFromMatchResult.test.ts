import { describe, expect, it } from 'vitest';
import type { Match } from '@prisma/client';
import {
  BadRequestKoError,
  computeKoOutcome,
  isKnockoutEliminationMatch,
  isMaterialKoEdit,
  koAdvanceTarget,
  koDownstreamMatchIds,
} from './knockoutAdvanceFromMatchResult.js';

const tid = 't-demo';

function qfMatch(i: number) {
  return {
    id: `ko-${tid}-qf-${i}`,
    tournamentId: tid,
    tournamentLeagueId: 'league-1',
    stage: 'quarterfinal' as const,
    roundLabel: 'Cuartos de final',
    player1: { id: 'p1', name: 'Uno' },
    player2: { id: 'p2', name: 'Dos' },
  };
}

describe('koAdvanceTarget', () => {
  it('Cuartos 1 → Semifinal 1 slot A (player1Id)', () => {
    expect(koAdvanceTarget(`ko-${tid}-qf-0`, tid)).toEqual({
      nextMatchId: `ko-${tid}-sf-0`,
      playerField: 'player1Id',
    });
  });
  it('Cuartos 2 → Semifinal 1 slot B (player2Id)', () => {
    expect(koAdvanceTarget(`ko-${tid}-qf-1`, tid)).toEqual({
      nextMatchId: `ko-${tid}-sf-0`,
      playerField: 'player2Id',
    });
  });
  it('Cuartos 3 y 4 → Semifinal 2', () => {
    expect(koAdvanceTarget(`ko-${tid}-qf-2`, tid)).toEqual({
      nextMatchId: `ko-${tid}-sf-1`,
      playerField: 'player1Id',
    });
    expect(koAdvanceTarget(`ko-${tid}-qf-3`, tid)).toEqual({
      nextMatchId: `ko-${tid}-sf-1`,
      playerField: 'player2Id',
    });
  });
  it('Semifinal → Final', () => {
    expect(koAdvanceTarget(`ko-${tid}-sf-0`, tid)).toEqual({
      nextMatchId: `ko-${tid}-fn-0`,
      playerField: 'player1Id',
    });
    expect(koAdvanceTarget(`ko-${tid}-sf-1`, tid)).toEqual({
      nextMatchId: `ko-${tid}-fn-0`,
      playerField: 'player2Id',
    });
  });
});

describe('koDownstreamMatchIds', () => {
  it('incluye semifinal y final desde cuartos', () => {
    const d = koDownstreamMatchIds(`ko-${tid}-qf-0`, tid);
    expect(d).toContain(`ko-${tid}-sf-0`);
    expect(d).toContain(`ko-${tid}-fn-0`);
  });
});

describe('computeKoOutcome', () => {
  it('W.O. con score B gana player2', () => {
    const m = qfMatch(0);
    const o = computeKoOutcome(m, { status: 'walkover', score: 'B' });
    expect(o).toMatchObject({ kind: 'terminal', winnerId: 'p2', loserId: 'p1' });
  });
  it('suspendido no define ganador', () => {
    const m = qfMatch(0);
    const o = computeKoOutcome(m, { status: 'suspended', score: '' });
    expect(o).toEqual({ kind: 'non_terminal' });
  });
  it('played con marcador válido', () => {
    const m = qfMatch(0);
    const o = computeKoOutcome(m, { status: 'played', score: '6-4 6-3' });
    expect(o).toMatchObject({ kind: 'terminal', winnerId: 'p1' });
  });
  it('played inválido lanza BadRequestKoError', () => {
    const m = qfMatch(0);
    expect(() => computeKoOutcome(m, { status: 'played', score: '6-6' })).toThrow(BadRequestKoError);
  });
});

describe('isMaterialKoEdit', () => {
  it('bloquea si cambia ganador en partido cerrado', () => {
    const match = { completed: true, winnerId: 'p1' } as Match;
    const preview = {
      kind: 'terminal' as const,
      winnerId: 'p2',
      loserId: 'p1',
      scoreLine: '6-0 6-0',
      status: 'played' as const,
    };
    expect(isMaterialKoEdit(match, preview)).toBe(true);
  });
  it('no material si mismo ganador', () => {
    const match = { completed: true, winnerId: 'p1' } as Match;
    const preview = {
      kind: 'terminal' as const,
      winnerId: 'p1',
      loserId: 'p2',
      scoreLine: '6-4 6-3',
      status: 'played' as const,
    };
    expect(isMaterialKoEdit(match, preview)).toBe(false);
  });
});

describe('isKnockoutEliminationMatch', () => {
  it('detecta por stage con liga', () => {
    expect(
      isKnockoutEliminationMatch({
        tournamentLeagueId: 'x',
        stage: 'semifinal',
        roundLabel: null,
      }),
    ).toBe(true);
  });
  it('detecta por roundLabel interzonal + Cuartos', () => {
    expect(
      isKnockoutEliminationMatch({
        tournamentLeagueId: 'x',
        stage: 'interzonal',
        roundLabel: 'Cuartos de final',
      }),
    ).toBe(true);
  });
});
